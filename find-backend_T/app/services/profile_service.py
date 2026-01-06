"""기업 프로필 조회 서비스 모듈."""
# app/services/profile_service.py

from typing import Any, Dict, Optional

import httpx
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.config import FMP_API_KEY, FMP_BASE_URL, STABLE_FMP_BASE_URL
from app import models
from app.mcp.decorators import register_tool
from app.services.translation_service import translate_company_profile


def _extract_profile(payload: Any) -> Optional[Dict[str, Any]]:
    if isinstance(payload, list):
        return payload[0] if payload else None
    if isinstance(payload, dict):
        data_field = payload.get("data")
        if isinstance(data_field, list) and data_field:
            return data_field[0]
        return payload
    return None


@register_tool
async def fetch_company_profile(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
) -> dict | None:
    """
    [AI용 설명] 특정 주식 티커(ticker)의 '회사 프로필'(설명, 산업)을 가져옵니다.
    (DB에 없거나 30일이 지났으면 API로 갱신합니다.)
    """
    db_profile = (
        db.query(models.CompanyProfile)
        .filter(models.CompanyProfile.ticker == ticker)
        .first()
    )

    needs_update = True
    if db_profile:
        thirty_days_ago = datetime.now() - timedelta(days=30)
        if db_profile.last_updated and db_profile.last_updated > thirty_days_ago:
            needs_update = False

    if needs_update:
        print(f"[Cache MISS] FMP API 호출: /profile/{ticker}")
        urls = [
            f"{STABLE_FMP_BASE_URL}/stable/profile/{ticker}?apikey={FMP_API_KEY}",
            f"{STABLE_FMP_BASE_URL}/stable/company-profile/{ticker}?apikey={FMP_API_KEY}",
            f"{FMP_BASE_URL}/profile/{ticker}?apikey={FMP_API_KEY}",
        ]

        fetched_profile: Optional[Dict[str, Any]] = None

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
                print(
                    f"fetch_company_profile HTTP 에러 (url={url}): "
                    f"{exc.response.status_code} - {exc.response.text}"
                )
            except Exception as exc:
                print(f"fetch_company_profile 예외 (url={url}): {exc}")

        if fetched_profile:
            try:
                # [성능 최적화] 실시간 번역 비활성화 (추후 필요 시 활성화)
                # translations = await translate_company_profile(fetched_profile)
                translations = {} # 임시로 빈 딕셔너리 처리

                # 로고 URL 처리 (FMP image 우선, 없으면 Clearbit fallback)
                logo_url = fetched_profile.get("image")
                if not logo_url:
                    website = fetched_profile.get("website")
                    if website:
                        domain = website.replace('https://', '').replace('http://', '').split('/')[0]
                        logo_url = f"https://logo.clearbit.com/{domain}"
                
                # 기존 DB에 k_name이 있으면 유지, 없으면 None
                existing_k_name = db_profile.k_name if db_profile else None
                
                # 번역된 데이터 사용 (번역 비활성화 상태이므로 원본 사용됨)
                profile_record = models.CompanyProfile(
                    ticker=fetched_profile.get("symbol"),
                    companyName=fetched_profile.get("companyName"),
                    k_name=existing_k_name,  # 기존 값 유지
                    description=translations.get("description") or fetched_profile.get("description"),
                    industry=translations.get("industry") or fetched_profile.get("industry"),
                    sector=translations.get("sector") or fetched_profile.get("sector"),
                    website=fetched_profile.get("website"),
                    logo_url=logo_url,
                    last_updated=datetime.now(),
                )
                db.merge(profile_record)
                # --- [핵심] 독립적인 서비스로 작동하도록 즉시 commit ---
                db.commit()
                # --- [수정 완료] ---

                db.refresh(profile_record)  # [NEW] 커밋된 객체를 다시 읽어옴
                db_profile = profile_record  # [NEW] db_profile 변수를 갱신

            except Exception as e:
                db.rollback()  # 에러 시 롤백
                print(f"fetch_company_profile DB 저장 에러: {e}")
                # API 호출이 실패해도, DB에 있던 오래된 데이터라도 반환
                if db_profile:
                    pass  # 오래된 데이터라도 반환 (commit 안 함)
                else:
                    return None  # 오래된 데이터도 없으면 None 반환
        else:
            # API가 데이터를 안 줌
            if not db_profile:
                return None
            # 오래된 데이터라도 반환

    if not db_profile:
        return None

    return {
        "ticker": db_profile.ticker,  # symbol -> ticker로 변경
        "companyName": db_profile.companyName,
        "k_name": db_profile.k_name,
        "description": db_profile.description,
        "industry": db_profile.industry,
        "sector": db_profile.sector,
        "website": db_profile.website,
        "logo_url": db_profile.logo_url,
    }
