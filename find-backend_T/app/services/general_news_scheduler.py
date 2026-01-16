# app/services/general_news_scheduler.py
"""
일반/경제 뉴스 수집 및 번역 스케줄러
- FMP general-latest API에서 뉴스 가져옴
- OpenAI로 한글 번역 후 DB에 저장
"""

import asyncio
from datetime import datetime
from typing import List

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import FMP_API_KEY
from app.database import SessionLocal
from app.services.translation_service import translate_news_article

FMP_BASE_URL = "https://financialmodelingprep.com/stable"


async def fetch_general_news_from_fmp(client: httpx.AsyncClient, limit: int = 30) -> List[dict]:
    """FMP API에서 일반 뉴스 가져오기"""
    url = f"{FMP_BASE_URL}/news/general-latest?limit={limit}&apikey={FMP_API_KEY}"
    
    try:
        response = await client.get(url, timeout=30.0)
        response.raise_for_status()
        return response.json() or []
    except Exception as e:
        print(f"[GeneralNewsScheduler] FMP API 호출 실패: {e}")
        return []


async def process_and_save_general_news(news_items: List[dict], db: Session):
    """일반 뉴스 번역 후 DB에 저장"""
    saved_count = 0
    translated_count = 0
    processed_urls = set()
    
    for item in news_items:
        url = item.get("url")
        if not url:
            continue
        
        # 배치 내 중복 체크
        if url in processed_urls:
            continue
        processed_urls.add(url)
        
        # DB 중복 체크
        existing = db.query(models.NewsArticle).filter_by(url=url).first()
        if existing:
            continue
        
        # 원본 데이터
        original_title = item.get("title") or ""
        source = item.get("source", "Unknown")
        original_text = item.get("snippet") or item.get("text") or ""
        original_summary = f"[{source}] {original_text}"
        
        # 한글 번역
        try:
            translated = await translate_news_article(original_title, original_summary)
            title = translated.get("title", original_title)
            summary = translated.get("summary", original_summary)
            translated_count += 1
        except Exception as e:
            print(f"[GeneralNewsScheduler] 번역 실패, 원본 사용: {e}")
            title = original_title
            summary = original_summary
        
        # DB 저장
        try:
            new_article = models.NewsArticle(
                url=url,
                title=title,
                publishedDate=item.get("publishedDate") or datetime.now().isoformat(),
                symbols=None,  # 일반 뉴스는 특정 종목 없음
                summary=summary,
                news_type="general"  # 일반 뉴스로 표시
            )
            db.add(new_article)
            db.commit()
            saved_count += 1
        except Exception as e:
            db.rollback()
            print(f"[GeneralNewsScheduler] 기사 저장 실패: {e}")
            continue
    
    print(f"[GeneralNewsScheduler] 신규 저장: {saved_count}건, 번역: {translated_count}건")


async def fetch_and_translate_general_news():
    """
    일반 뉴스 스케줄러 메인 함수
    - FMP에서 뉴스 가져오기
    - 한글 번역 후 DB 저장
    """
    print(f"[GeneralNewsScheduler] 일반 경제 뉴스 수집 시작: {datetime.now()}")
    
    db = SessionLocal()
    try:
        async with httpx.AsyncClient() as client:
            news_items = await fetch_general_news_from_fmp(client, limit=30)
        
        if news_items:
            print(f"[GeneralNewsScheduler] FMP에서 {len(news_items)}개 뉴스 수신")
            await process_and_save_general_news(news_items, db)
        else:
            print("[GeneralNewsScheduler] 새 뉴스 없음")
        
    except Exception as e:
        print(f"[GeneralNewsScheduler] 에러: {e}")
    finally:
        db.close()
    
    print(f"[GeneralNewsScheduler] 완료: {datetime.now()}")


def run_general_news_scheduler():
    """동기 함수에서 비동기 스케줄러 실행"""
    asyncio.run(fetch_and_translate_general_news())


# 수동 테스트용
if __name__ == "__main__":
    asyncio.run(fetch_and_translate_general_news())
