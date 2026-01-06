"""기업 검색 관련 서비스 모듈."""
# app/services/search_service.py
import asyncio
import httpx
import json
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from openai import AsyncOpenAI

from app.config import FMP_API_KEY, OPENAI_API_KEY
from app import models
from app.mcp.decorators import register_tool

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"


def _is_korean(text: str) -> bool:
    """텍스트에 한글이 포함되어 있는지 확인합니다."""
    return any("\uAC00" <= char <= "\uD7A3" for char in text)


async def _company_name_to_ticker(company_name: str, openai_client: AsyncOpenAI) -> Optional[str]:
    """회사명(한글/영어)을 티커 심볼로 직접 변환합니다."""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a financial data expert. Convert company names (Korean or English) to stock ticker symbols. Return ONLY the ticker symbol in uppercase (e.g., AAPL, GOOGL, MSFT), nothing else. If unsure, return the most common ticker.",
                },
                {"role": "user", "content": f"Convert this company name to ticker symbol: {company_name}"},
            ],
            temperature=0,
        )
        # [토큰 사용량 로깅] 티커 변환 API 호출
        if hasattr(response, 'usage') and response.usage:
            usage = response.usage
            print(f"[Token Usage] 티커 변환 API - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")
        
        ticker = response.choices[0].message.content or ""
        ticker = ticker.strip().upper()
        # 티커 형식 검증 (대문자 알파벳만, 1-5자)
        if ticker and ticker.isalpha() and 1 <= len(ticker) <= 5:
            print(f"[Ticker Conversion] '{company_name}' → '{ticker}'")
            return ticker
        else:
            print(f"[Ticker Conversion] 잘못된 형식: '{ticker}' (원본: {company_name})")
            return None
    except Exception as e:
        print(f"[Ticker Conversion Error] {e}, 원본: {company_name}")
        return None


async def _translate_to_english(korean_name: str, openai_client: AsyncOpenAI) -> str:
    """한글 회사명을 영어로 변환합니다. (Fallback용)"""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a translator. Translate Korean company names to English. Return ONLY the English name, nothing else.",
                },
                {"role": "user", "content": f"Translate this Korean company name to English: {korean_name}"},
            ],
            temperature=0,
        )
        # [토큰 사용량 로깅] 번역 API 호출
        if hasattr(response, 'usage') and response.usage:
            usage = response.usage
            print(f"[Token Usage] 번역 API - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")
        
        english_name = response.choices[0].message.content or korean_name
        english_name = english_name.strip()
        print(f"[Translation] '{korean_name}' → '{english_name}'")
        return english_name
    except Exception as e:
        print(f"[Translation Error] {e}, 원본 사용: {korean_name}")
        return korean_name


@register_tool
async def search_company_by_name(
    query: str, 
    db: Session, 
    client: httpx.AsyncClient,
    openai_client: Optional[AsyncOpenAI] = None
) -> list:
    """
    회사 이름(query)으로 티커 심볼을 검색합니다.
    한글 회사명도 지원합니다 (예: "애플" → "AAPL", "구글" → "GOOGL").
    """
    # [NEW] 의존성 주입된 openai_client가 없으면 로컬 생성 (Fallback)
    if not openai_client:
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    # 1. DB에서 먼저 검색 (한글명, 영문명, 티커 모두 시도)
    from sqlalchemy import or_
    db_results = db.query(models.CompanyProfile).filter(
        or_(
            models.CompanyProfile.companyName.like(f"%{query}%"),
            models.CompanyProfile.k_name.like(f"%{query}%"),
            models.CompanyProfile.ticker.like(f"%{query}%")
        )
    ).limit(5).all()
    
    if db_results:
        print(f"[Search] DB에서 {len(db_results)}개 결과 찾음")
        return [{
            "ticker": r.ticker,
            "companyName": r.companyName,
            "k_name": r.k_name,
            "industry": r.industry,
            "sector": r.sector,
            "website": r.website,
            "logo_url": r.logo_url,
            "next_step_hint": "Ticker found. NOW YOU MUST CALL 'fetch_company_key_metrics' (Valuation) OR 'fetch_earnings_surprises' (Earnings). DO NOT ANSWER YET."
        } for r in db_results]
    
    # 2. [NEW] DB 검색 실패 시, 한글이면 번역 후 재시도
    print(f"[Search] DB에 '{query}' 검색 결과 없음")
    
    # 한글 감지
    if any('\uac00' <= char <= '\ud7a3' for char in query):
        print(f"[Search] 한글 감지, 번역 시도: '{query}'")
        # [FIX] translate_korean_to_english -> _translate_to_english (NameError 수정)
        translated_query = await _translate_to_english(query, openai_client)
        
        # 번역된 이름으로 재검색
        db_results_translated = db.query(models.CompanyProfile).filter(
            or_(
                models.CompanyProfile.companyName.like(f"%{translated_query}%"),
                models.CompanyProfile.ticker.like(f"%{translated_query}%")
            )
        ).limit(5).all()
        
        if db_results_translated:
            print(f"[Search] 번역 후 DB에서 {len(db_results_translated)}개 결과 찾음")
            return [{
                "ticker": r.ticker,
                "companyName": r.companyName,
                "k_name": r.k_name,
                "industry": r.industry,
                "sector": r.sector,
                "website": r.website,
                "logo_url": r.logo_url,
                "next_step_hint": "Ticker found. NOW YOU MUST CALL 'fetch_company_key_metrics' (Valuation) OR 'fetch_earnings_surprises' (Earnings). DO NOT ANSWER YET."
            } for r in db_results_translated]
    
    # 3. 최종 실패 (AI에게 직접 물어보기 등 Fallback 로직 추가 가능)
    # 여기서는 검색 실패로 리턴
    print(f"[Search] 최종 검색 실패: '{query}'")
    return []
