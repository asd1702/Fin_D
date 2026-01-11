# app/services/news_scheduler.py
"""
뉴스 수집 및 번역 스케줄러
- 매일 1회 실행
- 사용자 즐겨찾기 티커의 뉴스를 FMP API에서 가져옴
- OpenAI로 한글 번역 후 DB에 저장
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Set

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import FMP_API_KEY
from app.database import SessionLocal
from app.services.translation_service import translate_news_article

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"


async def get_all_favorite_tickers(db: Session) -> Set[str]:
    """모든 사용자의 즐겨찾기 티커를 중복 제거하여 반환"""
    favorites = db.query(models.UserFavorite.ticker).distinct().all()
    return {f.ticker for f in favorites if f.ticker}


async def fetch_news_from_fmp(tickers: List[str], client: httpx.AsyncClient) -> List[dict]:
    """FMP API에서 뉴스 가져오기"""
    if not tickers:
        return []
    
    ticker_str = ",".join(tickers)
    url = f"{FMP_BASE_URL}/stock_news?tickers={ticker_str}&limit=50&apikey={FMP_API_KEY}"
    
    try:
        response = await client.get(url, timeout=30.0)
        response.raise_for_status()
        return response.json() or []
    except Exception as e:
        print(f"[NewsScheduler] FMP API 호출 실패: {e}")
        return []


async def process_and_save_news(news_items: List[dict], db: Session):
    """뉴스 번역 후 DB에 저장"""
    saved_count = 0
    translated_count = 0
    processed_urls = set()  # 배치 내 중복 체크용
    
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
        site = item.get("site", "Unknown")
        original_text = item.get("text") or ""
        original_summary = f"[{site}] {original_text}"
        
        # 한글 번역
        try:
            translated = await translate_news_article(original_title, original_summary)
            title = translated.get("title", original_title)
            summary = translated.get("summary", original_summary)
            translated_count += 1
        except Exception as e:
            print(f"[NewsScheduler] 번역 실패, 원본 사용: {e}")
            title = original_title
            summary = original_summary
        
        # DB 저장 (개별 커밋으로 에러 시에도 계속 진행)
        try:
            new_article = models.NewsArticle(
                url=url,
                title=title,
                publishedDate=item.get("publishedDate"),
                symbols=item.get("symbol"),
                summary=summary
            )
            db.add(new_article)
            db.commit()
            saved_count += 1
        except Exception as e:
            db.rollback()
            print(f"[NewsScheduler] 기사 저장 실패: {e}")
            continue
    
    print(f"[NewsScheduler] 신규 저장: {saved_count}건, 번역: {translated_count}건")


async def translate_existing_english_news(db: Session, tickers: Set[str], limit: int = 50):
    """기존 영어 기사들을 한글로 번역하여 업데이트"""
    
    # 영어로 된 기사 찾기 (한글이 아닌 기사)
    articles = db.query(models.NewsArticle).filter(
        models.NewsArticle.symbols.in_(tickers)
    ).order_by(models.NewsArticle.publishedDate.desc()).limit(limit).all()
    
    updated_count = 0
    
    for article in articles:
        # 이미 한글인지 체크
        title = article.title or ""
        if title and any('가' <= c <= '힣' for c in title[:20]):
            continue  # 이미 한글
        
        summary = article.summary or ""
        
        try:
            translated = await translate_news_article(title, summary)
            article.title = translated.get("title", title)
            article.summary = translated.get("summary", summary)
            updated_count += 1
        except Exception as e:
            print(f"[NewsScheduler] 기존 기사 번역 실패: {e}")
            continue
    
    try:
        db.commit()
        print(f"[NewsScheduler] 기존 기사 번역 업데이트: {updated_count}건")
    except Exception as e:
        db.rollback()
        print(f"[NewsScheduler] 기존 기사 업데이트 실패: {e}")


async def fetch_and_translate_favorite_news():
    """
    메인 스케줄러 함수
    - 모든 사용자의 즐겨찾기 티커 수집
    - FMP에서 뉴스 가져오기
    - 한글 번역 후 DB 저장
    - 기존 영어 기사도 한글로 번역
    """
    print(f"[NewsScheduler] 뉴스 수집 시작: {datetime.now()}")
    
    db = SessionLocal()
    try:
        # 1. 즐겨찾기 티커 수집
        tickers = await get_all_favorite_tickers(db)
        if not tickers:
            print("[NewsScheduler] 즐겨찾기된 티커 없음")
            return
        
        print(f"[NewsScheduler] 총 {len(tickers)}개 티커: {tickers}")
        
        # 2. FMP에서 뉴스 가져오기
        async with httpx.AsyncClient() as client:
            news_items = await fetch_news_from_fmp(list(tickers), client)
        
        if news_items:
            print(f"[NewsScheduler] FMP에서 {len(news_items)}개 뉴스 수신")
            # 3. 신규 뉴스 번역 및 저장
            await process_and_save_news(news_items, db)
        else:
            print("[NewsScheduler] 새 뉴스 없음")
        
        # 4. 기존 영어 기사 번역 (최근 50개)
        await translate_existing_english_news(db, tickers, limit=50)
        
    except Exception as e:
        print(f"[NewsScheduler] 에러: {e}")
    finally:
        db.close()
    
    print(f"[NewsScheduler] 완료: {datetime.now()}")


def run_news_scheduler():
    """동기 함수에서 비동기 스케줄러 실행"""
    asyncio.run(fetch_and_translate_favorite_news())


# 수동 테스트용
if __name__ == "__main__":
    asyncio.run(fetch_and_translate_favorite_news())

