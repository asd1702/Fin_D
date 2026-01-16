from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import List, Optional
from datetime import datetime, timedelta
import httpx

from app import models, schemas
from app.database import SessionLocal
# Auth dependency
from app.routers.auth import get_current_user
# Service
from app.services.news_service import fetch_news_for_tickers

router = APIRouter(
    prefix="/api/v1/news",
    tags=["News"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_httpx_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.httpx_client

@router.get("/favorites", response_model=List[schemas.NewsItem])
async def get_favorite_news(
    limit: int = 20, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    client: httpx.AsyncClient = Depends(get_httpx_client)
):
    """
    관심 기업들의 최신 뉴스를 가져옵니다.
    최신(48시간 이내) 뉴스가 없으면 FMP API를 통해 가져옵니다.
    """
    # 1. 사용자의 관심 기업 리스트 조회
    favorites = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == current_user.id
    ).all()
    
    print(f"[News Router] Request by User {current_user.id} ({current_user.username})")
    if favorites:
        print(f"[News Router] Favorites: {[f.ticker for f in favorites]}")
    else:
        print(f"[News Router] No favorites found for user {current_user.id}")

    if not favorites:
        return []
    
    fav_tickers = [f.ticker for f in favorites]
    
    # logo map 생성
    ticker_logo_map = {f.ticker: f.company.logo_url for f in favorites if f.company}
    
    # 2. DB에서 최근 7일 뉴스 조회 (범위 확대)
    filter_date = datetime.now() - timedelta(days=7)
    
    # symbols 필터링: 정확히 일치하거나 쉼표로 구분된 목록에 포함
    ticker_conditions = [models.NewsArticle.symbols == t for t in fav_tickers]
    ticker_conditions.extend([models.NewsArticle.symbols.like(f"%{t}%") for t in fav_tickers])
    
    news_query = db.query(models.NewsArticle).filter(
        models.NewsArticle.publishedDate >= filter_date,
        or_(*ticker_conditions)
    ).order_by(desc(models.NewsArticle.publishedDate))
    
    news_items = news_query.limit(limit).all()
    print(f"[News Router] Found {len(news_items)} items in DB (since {filter_date})")

    # 3. 데이터가 없으면 API 호출 시도 (Fetch on Miss)
    if not news_items:
        print(f"[News Router] No recent news found for {fav_tickers}, fetching from FMP...")
        await fetch_news_for_tickers(fav_tickers, db, client)
        
        # 다시 조회
        news_items = news_query.limit(limit).all()
        print(f"[News Router] After fetch: found {len(news_items)} items")
    
    # 4. 결과 변환 (logo_url 추가)
    result = []
    for item in news_items:
        logo = None
        # symbols 매칭 (API는 'AAPL' 식으로 단일일 수도, 콤마일 수도 있음)
        # 여기선 간단히 ticker_logo_map에 있는지 확인
        if item.symbols in ticker_logo_map:
            logo = ticker_logo_map[item.symbols]
        
        result.append(schemas.NewsItem(
            id=item.id,
            title=item.title,
            summary=item.summary,
            url=item.url,
            publishedDate=item.publishedDate,
            ticker=item.symbols,
            logo_url=logo
        ))
        
    return result


@router.post("/trigger-translation")
async def trigger_news_translation(
    current_user: models.User = Depends(get_current_user)
):
    """
    수동으로 뉴스 번역 스케줄러를 실행합니다 (테스트용).
    실제 환경에서는 관리자만 접근 가능하도록 제한해야 합니다.
    """
    from app.services.news_scheduler import fetch_and_translate_favorite_news
    
    try:
        await fetch_and_translate_favorite_news()
        return {"status": "success", "message": "뉴스 번역 작업이 완료되었습니다."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/general", response_model=List[schemas.NewsItem])
async def get_general_news(
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    일반 경제/국제 뉴스를 가져옵니다.
    인증 불필요 (공개 데이터)
    """
    # DB에서 일반 뉴스 조회 (최신순)
    news_items = db.query(models.NewsArticle).filter(
        models.NewsArticle.news_type == "general"
    ).order_by(desc(models.NewsArticle.publishedDate)).limit(limit).all()
    
    # 결과 변환
    result = []
    for item in news_items:
        result.append(schemas.NewsItem(
            id=item.id,
            title=item.title,
            summary=item.summary,
            url=item.url,
            publishedDate=item.publishedDate,
            ticker=None,
            logo_url=None
        ))
    
    return result


@router.post("/trigger-general-news")
async def trigger_general_news_fetch(
    current_user: models.User = Depends(get_current_user)
):
    """
    수동으로 일반 경제 뉴스 수집을 실행합니다 (테스트용).
    """
    from app.services.general_news_scheduler import fetch_and_translate_general_news
    
    try:
        await fetch_and_translate_general_news()
        return {"status": "success", "message": "일반 경제 뉴스 수집이 완료되었습니다."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

