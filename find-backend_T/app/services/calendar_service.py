"""캘린더 일정 자동 추가 서비스"""
# app/services/calendar_service.py

import httpx
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import logging

from app.config import FMP_API_KEY
from app import models

logger = logging.getLogger(__name__)
FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"

# 주요 경제 지표 필터
MAJOR_ECONOMIC_INDICATORS = [
    "CPI",
    "Consumer Price Index",
    "PPI",
    "Producer Price Index",
    "Nonfarm Payrolls",
    "NFP",
    "Employment Report",
    "Initial Jobless Claims",
    "Unemployment Claims",
    "GDP",
    "Gross Domestic Product",
    "Interest Rate Decision",
    "Fed Interest Rate",
    "FOMC",
    "Federal Open Market Committee"
]


def is_major_indicator(event_name: str) -> bool:
    """주요 경제 지표인지 확인"""
    if not event_name:
        return False
    event_lower = event_name.lower()
    for indicator in MAJOR_ECONOMIC_INDICATORS:
        if indicator.lower() in event_lower:
            return True
    return False


async def fetch_upcoming_earnings(
    ticker: str,
    client: httpx.AsyncClient,
    days_ahead: int
) -> List[Dict[str, Any]]:
    """특정 ticker의 향후 실적 발표 일정 조회"""
    from_date = datetime.now().date()
    to_date = from_date + timedelta(days=days_ahead)
    
    url = f"{FMP_BASE_URL}/earning_calendar"
    params = {
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "apikey": FMP_API_KEY
    }
    
    try:
        response = await client.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        
        # 🔍 디버깅: API 응답 확인
        logger.info(f"[FMP Earnings] Ticker: {ticker}, From: {from_date}, To: {to_date}")
        logger.info(f"[FMP Earnings] Total items returned: {len(data)}")
        
        # 해당 ticker 데이터만 필터링
        ticker_earnings = [
            item for item in data
            if item.get("symbol") == ticker.upper()
        ]
        
        # 🔍 디버깅: 필터링된 데이터 확인
        logger.info(f"[FMP Earnings] {ticker} matched items: {len(ticker_earnings)}")
        for item in ticker_earnings:
            logger.info(f"  - Date: {item.get('date')}, Symbol: {item.get('symbol')}, Fiscal: {item.get('fiscalDateEnding')}")
        
        result = []
        for item in ticker_earnings:
            try:
                event_date = datetime.strptime(item["date"], "%Y-%m-%d").date()
                
                # ✅ 과거 데이터 필터링 추가
                if event_date < from_date:
                    logger.warning(f"[FMP Earnings] Skipping past date: {event_date} for {ticker}")
                    continue
                
                result.append({
                    "date": event_date,
                    "company_name": item.get("companyName", ticker),
                    "time": item.get("time", "AMC"),
                    "fiscal_period": item.get("fiscalDateEnding", ""),  # 변경: period → fiscal_period
                    "eps_estimated": item.get("epsEstimated"),
                })
            except Exception as e:
                logger.warning(f"Failed to parse earning item for {ticker}: {e}")
                continue
        
        return result
    
    except Exception as e:
        logger.error(f"Failed to fetch earnings for {ticker}: {e}")
        raise


async def fetch_economic_events(
    client: httpx.AsyncClient,
    days_ahead: int
) -> List[Dict[str, Any]]:
    """FMP API로 미국(US) 주요 경제 이벤트 조회"""
    from_date = datetime.now().date()
    to_date = from_date + timedelta(days=days_ahead)
    
    url = f"{FMP_BASE_URL}/economic_calendar"
    params = {
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "apikey": FMP_API_KEY
    }
    
    try:
        response = await client.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        
        # 미국 이벤트 & 주요 지표만 필터링
        us_major_events = [
            event for event in data
            if event.get("country") == "US" and is_major_indicator(event.get("event", ""))
        ]
        
        result = []
        for item in us_major_events:
            try:
                event_date = datetime.strptime(item["date"], "%Y-%m-%d").date()
                result.append({
                    "date": event_date,
                    "title": f"🇺🇸 {item['event']}",
                    "time": item.get("time", "TBD"),
                    "description": f"예상: {item.get('estimate', 'N/A')} | 이전: {item.get('previous', 'N/A')}"
                })
            except Exception as e:
                logger.warning(f"Failed to parse economic event: {e}")
                continue
        
        return result
    
    except Exception as e:
        logger.error(f"Failed to fetch economic events: {e}")
        return []  # 경제 이벤트 실패해도 earnings는 계속 진행


async def import_earnings_to_calendar(
    user_id: int,
    db: Session,
    days_ahead: int = 30
) -> Dict[str, Any]:
    """
    1. 즐겨찾기 기업의 실적 발표 일정 추가
    2. 미국 주요 경제 이벤트 추가
    (중복 체크하여 기존 일정은 건너뜀)
    """
    
    # === Part 1: Earnings ===
    favorites = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == user_id
    ).all()
    
    earnings_added = 0
    earnings_skipped = 0
    failed_tickers = []
    
    if favorites:
        async with httpx.AsyncClient() as client:
            tasks = [
                fetch_upcoming_earnings(ticker.ticker, client, days_ahead)
                for ticker in favorites
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for favorite, earnings_data in zip(favorites, results):
            ticker = favorite.ticker
            
            if isinstance(earnings_data, Exception):
                failed_tickers.append(ticker)
                logger.error(f"Failed to fetch earnings for {ticker}: {earnings_data}")
                continue
            
            for earning in earnings_data:
                # 중복 체크: earnings_auto 타입만 체크
                existing = db.query(models.UserEvent).filter(
                    models.UserEvent.user_id == user_id,
                    models.UserEvent.ticker == ticker,
                    models.UserEvent.date == earning['date'],
                    models.UserEvent.event_type == 'earnings_auto'
                ).first()
                
                if existing:
                    earnings_skipped += 1
                    continue
                
                # 새 일정 추가
                eps_value = earning.get('eps_estimated', 'N/A')
                eps_display = f"${eps_value}" if eps_value != 'N/A' else 'N/A'
                
                new_event = models.UserEvent(
                    user_id=user_id,
                    title=f"{earning['company_name']} 실적발표",
                    date=earning['date'],
                    time=earning.get('time', 'AMC'),
                    ticker=ticker,
                    description=f"예상 주당순이익: {eps_display}",
                    event_type='earnings_auto'
                )
                db.add(new_event)
                earnings_added += 1
    
    # === Part 2: Economic Events (US only) ===
    economic_added = 0
    economic_skipped = 0
    
    async with httpx.AsyncClient() as client:
        economic_events = await fetch_economic_events(client, days_ahead)
    
    for event in economic_events:
        # 중복 체크: economic_event 타입만 체크
        existing = db.query(models.UserEvent).filter(
            models.UserEvent.user_id == user_id,
            models.UserEvent.date == event['date'],
            models.UserEvent.title == event['title'],
            models.UserEvent.event_type == 'economic_event'
        ).first()
        
        if existing:
            economic_skipped += 1
            continue
        
        new_event = models.UserEvent(
            user_id=user_id,
            title=event['title'],
            date=event['date'],
            time=event.get('time'),
            ticker=None,  # 경제 이벤트는 특정 기업과 무관
            description=event['description'],
            event_type='economic_event'
        )
        db.add(new_event)
        economic_added += 1
    
    db.commit()
    
    return {
        "success": True,
        "message": f"{earnings_added}개의 실적발표와 {economic_added}개의 경제 이벤트가 추가되었습니다. (중복 {earnings_skipped + economic_skipped}개 제외)",
        "summary": {
            "earnings": {
                "total_favorites": len(favorites) if favorites else 0,
                "events_added": earnings_added,
                "events_skipped": earnings_skipped,
                "failed_tickers": failed_tickers
            },
            "economic_events": {
                "events_added": economic_added,
                "events_skipped": economic_skipped
            }
        }
    }
