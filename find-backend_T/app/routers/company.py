# app/routers/company.py (Stable API 버전)

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal
from app.services.income_statement_service import fetch_company_income_statements
from app.services.balance_sheet_service import fetch_company_balance_sheets
from app.services.cash_flow_service import fetch_company_cash_flows
from app.services.profile_service import fetch_company_profile
from app.services.search_service import search_company_by_name
from app.services.key_metrics_service import fetch_company_key_metrics
from app.services.market_service import fetch_stock_quote
from app.services.ratings_service import fetch_analyst_ratings
from app.services.insider_service import fetch_insider_trades
from app.services.health_analysis_service import fetch_health_analysis_widget


# APIRouter 객체 생성
router = APIRouter(
    prefix="/api/v1/company",
    tags=["Company (Stable)"] # 태그 이름을 바꿔서 구별
)

# 3. main.py에서 httpx 클라이언트를 받아오는 함수
def get_httpx_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.httpx_client

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 4. 'Stable' API 엔드포인트 테스트 (기업 검색)
@router.get("/search/{query}")
async def get_company_stable_search(
    query: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db)
):
    """
    FMP 'Stable' API의 'search-name' 엔드포인트를 테스트합니다.
    """
    results = await search_company_by_name(query, db, client)
    if not results:
        raise HTTPException(status_code=404, detail="검색 결과가 없습니다.")
    return results

# 5. 'Stable' API로 기업 프로필 가져오기 테스트
# (무료 플랜은 '/stable/profile'을 사용)
@router.get("/profile/{ticker}")
async def get_company_stable_profile(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db)
):
    """
    FMP 'Stable' API의 'company-profile' 엔드포인트를 테스트합니다.
    (v3/profile 대체)
    """
    profile = await fetch_company_profile(ticker, db, client)
    if not profile:
        raise HTTPException(status_code=404, detail="데이터를 찾을 수 없습니다.")
    return profile


@router.get("/quote/{ticker}")
async def get_company_quote(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db)
):
    """
    특정 티커의 현재 주가 시세를 조회합니다.
    """
    quote_data = await fetch_stock_quote(ticker, db, client)
    if not quote_data:
        raise HTTPException(status_code=404, detail="주가 시세를 찾을 수 없습니다.")
    
    # Twelve Data API 응답을 프론트엔드 형식으로 변환
    # Twelve Data 응답: {"symbol": "AAPL", "name": "...", "exchange": "...", "currency": "USD", 
    #                    "datetime": "...", "timestamp": ..., "open": "...", "high": "...", 
    #                    "low": "...", "close": "...", "volume": "...", "previous_close": "..."}
    
    try:
        close_price = float(quote_data.get("close", 0))
        previous_close = float(quote_data.get("previous_close", close_price))
        change = close_price - previous_close
        change_percent = (change / previous_close * 100) if previous_close > 0 else 0
        
        return {
            "symbol": quote_data.get("symbol", ticker),
            "price": close_price,
            "change": change,
            "changePercent": change_percent,
            "volume": int(float(quote_data.get("volume", 0))),
            "open": float(quote_data.get("open", 0)),
            "high": float(quote_data.get("high", 0)),
            "low": float(quote_data.get("low", 0)),
            "previous_close": previous_close,
            "currency": quote_data.get("currency", "USD"),
            "datetime": quote_data.get("datetime"),
            "marketCap": quote_data.get("marketCap"), # [NEW] 시가총액 전달
        }
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=500, detail=f"주가 데이터 파싱 오류: {str(e)}")

# 6. 'Stable' API로 재무제표(손익계산서) 가져오기 (새로운 테스트!)
@router.get("/income-statement/{ticker}")
async def get_company_income_statement(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db),
    period: str = "annual",
    limit: int = 5,
):
    statements = await fetch_company_income_statements(
        ticker=ticker,
        db=db,
        client=client,
        period=period,
        limit=limit,
    )
    if not statements:
        raise HTTPException(status_code=404, detail="손익계산서를 찾을 수 없습니다.")
    return statements


@router.get("/balance-sheet/{ticker}")
async def get_company_balance_sheet(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db),
    period: str = "annual",
    limit: int = 5,
):
    records = await fetch_company_balance_sheets(
        ticker=ticker,
        db=db,
        client=client,
        period=period,
        limit=limit,
    )
    if not records:
        raise HTTPException(status_code=404, detail="대차대조표 데이터를 찾을 수 없습니다.")
    return records


@router.get("/cash-flow/{ticker}")
async def get_company_cash_flow(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db),
    period: str = "annual",
    limit: int = 5,
):
    records = await fetch_company_cash_flows(
        ticker=ticker,
        db=db,
        client=client,
        period=period,
        limit=limit,
    )
    if not records:
        raise HTTPException(status_code=404, detail="현금흐름표 데이터를 찾을 수 없습니다.")
    return records


@router.get("/metrics/{ticker}")
async def get_company_key_metrics(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db),
    period: str = "annual",
    limit: int = 3,
):
    metrics_payload = await fetch_company_key_metrics(
        ticker=ticker,
        db=db,
        client=client,
        period=period,
        limit=limit,
    )
    records = metrics_payload.get("records") if isinstance(metrics_payload, dict) else None
    if not records:
        raise HTTPException(status_code=404, detail="주요 재무 지표를 찾을 수 없습니다.")
    return metrics_payload


@router.get("/ratings/{ticker}")
async def get_company_ratings(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db),
    limit: int = 10,
):
    """
    특정 티커의 애널리스트 평가 정보를 조회합니다.
    """
    ratings = await fetch_analyst_ratings(ticker=ticker, db=db, client=client, limit=limit)
    if not ratings:
        raise HTTPException(status_code=404, detail="애널리스트 평가를 찾을 수 없습니다.")
    return ratings


@router.get("/insider-trading/{ticker}")
async def get_company_insider_trades(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db),
    limit: int = 20,
):
    """
    특정 티커의 내부자 거래 내역을 조회합니다.
    """
    trades = await fetch_insider_trades(ticker=ticker, db=db, client=client, limit=limit)
    # 데이터가 없으면 빈 리스트 반환 (에러 아님)
    return trades or []


@router.get("/list")
async def get_all_companies(
    db: Session = Depends(get_db),
    limit: int = 100
):
    """
    DB에 있는 모든 기업 목록 가져옵니다.
    """
    companies = db.query(models.CompanyProfile).limit(limit).all()
    
    if not companies:
        raise HTTPException(status_code=404, detail="기업 목록을 찾을 수 없습니다.")

    result = []
    for comp in companies:
        result.append({
            "ticker": comp.ticker,
            "companyName": comp.companyName,
            "k_name": comp.k_name,
            "description": comp.description,
            "industry": comp.industry,
            "sector": comp.sector,
            "website": comp.website,
            "logo_url": comp.logo_url,   
        })

    return result

# --- Dashboard Widgets ---

from app.services.ratings_service import fetch_analyst_consensus_card
from app.services.key_metrics_service import fetch_metrics_grid_widget
from app.services.financial_statements_service import fetch_financial_statements_view
import json
from datetime import datetime, timedelta

@router.get("/widgets/analyst-consensus/{ticker}")
async def get_analyst_consensus_widget(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db)
):
    # [최적화] 위젯 레벨 캐싱 제거 -> '현재 주가'의 실시간 반영을 위해
    # 데이터 레벨(fetch_analyst_ratings)에서는 캐시가 작동하므로 성능 저하는 최소화됨
    widget = await fetch_analyst_consensus_card(ticker, db, client)
    if not widget:
        raise HTTPException(status_code=404, detail="위젯 데이터를 생성할 수 없습니다.")
    
    return widget

@router.get("/widgets/metrics-grid/{ticker}")
async def get_metrics_grid_widget(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db)
):
    # [최적화] 위젯 캐싱 도입 (1시간)
    cache_key = f"widget_metrics_{ticker}"
    cache = db.query(models.ApiCache).filter(
        models.ApiCache.cache_key == cache_key,
        models.ApiCache.expires_at > datetime.now()
    ).first()
    if cache:
        return cache.data

    widget = await fetch_metrics_grid_widget(ticker, db, client)
    if not widget:
        raise HTTPException(status_code=404, detail="위젯 데이터를 생성할 수 없습니다.")
    
    # 캐시 저장
    db.merge(models.ApiCache(
        cache_key=cache_key,
        data=widget,
        expires_at=datetime.now() + timedelta(hours=1)
    ))
    db.commit()
    return widget

@router.get("/widgets/health-analysis/{ticker}")
async def get_health_analysis_widget(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db)
):
    """
    [Dashboard] 재무 건전성 분석 위젯 데이터를 반환합니다.
    [최적화] 위젯 캐싱 도입 (24시간)
    """
    cache_key = f"widget_health_{ticker}"
    cache = db.query(models.ApiCache).filter(
        models.ApiCache.cache_key == cache_key,
        models.ApiCache.expires_at > datetime.now()
    ).first()
    if cache:
        return cache.data

    widget = await fetch_health_analysis_widget(ticker, db, client)
    if not widget:
        raise HTTPException(status_code=404, detail="건전성 분석 데이터를 생성할 수 없습니다.")
    
    # 캐시 저장
    db.merge(models.ApiCache(
        cache_key=cache_key,
        data=widget,
        expires_at=datetime.now() + timedelta(hours=24)
    ))
    db.commit()
    return widget

@router.get("/widgets/financial-statements/{ticker}")
async def get_financial_statements_view_endpoint(
    ticker: str,
    sub_tab: str = "income",
    period: str = "annual",
    year_range: int = 3,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db)
):
    """
    재무제표 뷰 위젯을 반환합니다.
    [최적화] 위젯 캐싱 도입 (24시간)
    """
    # sub_tab, period, year_range에 따라 캐시 키 분리
    cache_key = f"widget_fin_{ticker}_{sub_tab}_{period}_{year_range}"
    cache = db.query(models.ApiCache).filter(
        models.ApiCache.cache_key == cache_key,
        models.ApiCache.expires_at > datetime.now()
    ).first()
    if cache:
        return cache.data

    view = await fetch_financial_statements_view(ticker, db, client, sub_tab, period, year_range)
    if view:
        # 캐시 저장
        db.merge(models.ApiCache(
            cache_key=cache_key,
            data=view,
            expires_at=datetime.now() + timedelta(hours=24)
        ))
        db.commit()
    return view
