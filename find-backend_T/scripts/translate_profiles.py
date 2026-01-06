"""
기존 company_profiles의 영어 데이터를 한국어로 번역하여 업데이트하는 스크립트
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import httpx
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import SessionLocal
from app import models
from app.services.translation_service import translate_company_profile
from app.config import FMP_API_KEY, FMP_BASE_URL, STABLE_FMP_BASE_URL, OPENAI_API_KEY
from datetime import datetime
from openai import OpenAI


def _extract_profile(payload):
    """API 응답에서 프로필 데이터 추출"""
    if isinstance(payload, list):
        return payload[0] if payload else None
    if isinstance(payload, dict):
        data_field = payload.get("data")
        if isinstance(data_field, list) and data_field:
            return data_field[0]
        return payload
    return None


def _is_english_text(text: str) -> bool:
    """텍스트가 영어인지 간단히 판단 (한글이 없으면 영어로 간주)"""
    if not text:
        return False
    # 한글 유니코드 범위 체크
    has_korean = any('\uac00' <= char <= '\ud7a3' for char in text)
    return not has_korean


async def translate_company_name(company_name: str) -> str:
    """회사 이름을 한국어로 번역"""
    if not company_name:
        return ""
    
    # 이미 한글이 포함되어 있으면 그대로 반환
    if not _is_english_text(company_name):
        return company_name
    
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        prompt = (
            f"다음 회사 이름을 한국에서 일반적으로 사용되는 한글 이름으로 번역해 주세요. "
            f"예: 'Apple Inc.' -> '애플', 'Microsoft Corporation' -> '마이크로소프트', "
            f"'NVIDIA Corporation' -> '엔비디아'. "
            f"회사 이름만 간단하게 반환하세요 (예: '애플', '마이크로소프트').\n\n"
            f"회사 이름: {company_name}"
        )
        
        def _call_openai() -> str:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "당신은 회사 이름을 한국어로 번역하는 전문가입니다. 회사 이름만 간단하게 반환하세요."
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
            )
            return response.choices[0].message.content or ""
        
        translated = await asyncio.to_thread(_call_openai)
        translated = translated.strip()
        # 따옴표 제거
        translated = translated.strip('"').strip("'").strip()
        return translated
    except Exception as e:
        print(f"    [k_name 번역 실패: {e}]")
        return ""


async def translate_existing_profile(company: models.CompanyProfile, client: httpx.AsyncClient) -> bool:
    """
    기존 프로필 데이터를 번역하여 업데이트
    API에서 최신 데이터를 가져와서 번역 후 저장
    """
    ticker = company.ticker
    
    try:
        # FMP API에서 최신 프로필 데이터 가져오기
        urls = [
            f"{STABLE_FMP_BASE_URL}/stable/profile/{ticker}?apikey={FMP_API_KEY}",
            f"{STABLE_FMP_BASE_URL}/stable/company-profile/{ticker}?apikey={FMP_API_KEY}",
            f"{FMP_BASE_URL}/profile/{ticker}?apikey={FMP_API_KEY}",
        ]
        
        fetched_profile = None
        for url in urls:
            try:
                response = await client.get(url)
                if response.status_code == 404:
                    continue
                response.raise_for_status()
                payload = response.json()
                fetched_profile = _extract_profile(payload)
                if fetched_profile:
                    break
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 404:
                    continue
                continue
            except Exception:
                continue
        
        if not fetched_profile:
            print(f"  ⚠️  API에서 데이터를 가져올 수 없음")
            return False
        
        # 번역 수행
        translations = await translate_company_profile(fetched_profile)
        
        if not translations:
            print(f"  ⚠️  번역 결과가 없음")
            return False
        
        # DB 업데이트
        updated = False
        
        # k_name 업데이트 (NULL이거나 비어있는 경우)
        if not company.k_name and company.companyName:
            k_name_translated = await translate_company_name(company.companyName)
            if k_name_translated:
                company.k_name = k_name_translated
                updated = True
        
        # description, industry, sector 번역 업데이트
        if translations.get("description"):
            company.description = translations["description"]
            updated = True
        if translations.get("industry"):
            company.industry = translations["industry"]
            updated = True
        if translations.get("sector"):
            company.sector = translations["sector"]
            updated = True
        
        if updated:
            company.last_updated = datetime.now()
            return True
        
        return False
        
    except Exception as e:
        print(f"  ❌ 오류: {e}")
        return False


async def update_profiles_translation():
    """영어로 저장된 프로필들을 한국어로 번역하여 업데이트"""
    
    db: Session = SessionLocal()
    
    try:
        # 영어로 저장된 프로필 찾기 (description, industry, sector 중 하나라도 영어인 경우)
        all_companies = db.query(models.CompanyProfile).all()
        
        companies_to_translate = []
        for company in all_companies:
            needs_translation = False
            
            # k_name이 NULL이거나 비어있는 경우
            if not company.k_name:
                needs_translation = True
            
            # description이 영어인지 확인
            if company.description and _is_english_text(company.description):
                needs_translation = True
            # industry가 영어인지 확인
            if company.industry and _is_english_text(company.industry):
                needs_translation = True
            # sector가 영어인지 확인
            if company.sector and _is_english_text(company.sector):
                needs_translation = True
            
            if needs_translation:
                companies_to_translate.append(company)
        
        if not companies_to_translate:
            print("✅ 번역이 필요한 회사가 없습니다. (모든 프로필이 이미 한글이거나 NULL)")
            return
        
        # 엔비디아(NVDA)가 포함되어 있는지 확인
        nvda_included = any(c.ticker == "NVDA" for c in companies_to_translate)
        if not nvda_included:
            # NVDA가 리스트에 없으면 추가
            nvda_company = db.query(models.CompanyProfile).filter(models.CompanyProfile.ticker == "NVDA").first()
            if nvda_company:
                companies_to_translate.append(nvda_company)
                print("ℹ️  엔비디아(NVDA)를 처리 목록에 추가했습니다.")
        
        print(f"📊 총 {len(companies_to_translate)}개 회사의 프로필을 번역합니다...\n")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            updated_count = 0
            failed_count = 0
            skipped_count = 0
            
            for idx, company in enumerate(companies_to_translate, 1):
                ticker = company.ticker
                company_name = company.companyName or ticker
                print(f"[{idx}/{len(companies_to_translate)}] {ticker} ({company_name})... ", end='', flush=True)
                
                try:
                    success = await translate_existing_profile(company, client)
                    
                    if success:
                        db.commit()
                        print("✅ 번역 완료")
                        updated_count += 1
                    else:
                        print("⚠️  번역 실패 (데이터 유지)")
                        failed_count += 1
                    
                except Exception as e:
                    print(f"❌ 오류: {e}")
                    db.rollback()
                    failed_count += 1
                
                # API Rate Limit 방지 및 번역 API 부하 방지
                await asyncio.sleep(1.0)  # 1초 대기
        
        print(f"\n{'='*60}")
        print(f"✅ 번역 완료: {updated_count}개")
        print(f"❌ 실패: {failed_count}개")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"\n오류 발생: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("="*60)
    print("Company Profiles 번역 업데이트 스크립트")
    print("영어로 저장된 기업 프로필을 한국어로 번역합니다.")
    print("="*60)
    print()
    asyncio.run(update_profiles_translation())
