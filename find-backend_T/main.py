# main.py

import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 1. 분리한 라우터 파일을 가져옵니다
from app.routers import company 
from app.routers import market
from app.routers import auth
from app.routers import user
from app.routers import user_data
from app.routers import news
from app.routers import notification

from app.database import engine
from sqlalchemy import text

# APScheduler 설정
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.news_scheduler import fetch_and_translate_favorite_news

scheduler = AsyncIOScheduler()


# FastAPI 앱 객체 생성
app = FastAPI()

# CORS 설정 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 앱에 라우터들을 포함시킵니다
app.include_router(company.router)
app.include_router(market.router)
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(user_data.router)
app.include_router(news.router)
app.include_router(notification.router)

# 3. 비동기 API 호출을 위한 클라이언트 (앱 실행 시 생성, 종료 시 해제)
@app.on_event("startup")
async def startup_event():
    app.state.httpx_client = httpx.AsyncClient()
    print("FastAPI 앱이 시작되었습니다. API 클라이언트가 준비되었습니다.")
    
    # DB 연결 테스트
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            result.fetchone()
        print(f"✅ 데이터베이스 연결 성공: {engine.url.host}:{engine.url.port}/{engine.url.database}")
    except Exception as e:
        print(f"❌ 데이터베이스 연결 실패: {str(e)}")
        raise  # 연결 실패 시 앱 시작 중단
    
    # 뉴스 스케줄러 등록 (매일 오전 6시)
    scheduler.add_job(
        fetch_and_translate_favorite_news,
        'cron',
        hour=6,
        minute=0,
        id='news_translation_job',
        replace_existing=True
    )
    
    # 알림 스케줄러 등록
    from app.services.notification_scheduler import (
        create_calendar_reminder_notifications,
        check_economic_indicators
    )
    
    # 캘린더 일정 알림: 매일 오전 9시
    scheduler.add_job(
        create_calendar_reminder_notifications,
        'cron',
        hour=9,
        minute=0,
        id='calendar_reminder_job',
        replace_existing=True
    )
    
    # 경제지표 알림: 21:30, 22:30, 03:00 (KST)
    scheduler.add_job(
        check_economic_indicators,
        'cron',
        hour=21,
        minute=30,
        id='economic_alert_2130',
        replace_existing=True
    )
    scheduler.add_job(
        check_economic_indicators,
        'cron',
        hour=22,
        minute=30,
        id='economic_alert_2230',
        replace_existing=True
    )
    scheduler.add_job(
        check_economic_indicators,
        'cron',
        hour=3,
        minute=0,
        id='economic_alert_0300',
        replace_existing=True
    )
    
    scheduler.start()
    print("📰 뉴스 스케줄러 시작: 매일 오전 6시에 실행")
    print("🔔 알림 스케줄러 시작: 캘린더(09:00), 경제지표(21:30, 22:30, 03:00)")
    
    # 서버 시작 시 한 번 실행 (개발 환경에서는 비활성화)
    # 수동 실행: POST /api/v1/news/trigger-translation
    run_on_startup = os.getenv("RUN_NEWS_ON_STARTUP", "false").lower() == "true"
    if run_on_startup:
        import asyncio
        asyncio.create_task(fetch_and_translate_favorite_news())
        print("📰 서버 시작 시 뉴스 수집 및 번역 실행 중...")
    else:
        print("📰 뉴스 자동 수집 비활성화 (수동: POST /api/v1/news/trigger-translation)")

@app.on_event("shutdown")
async def shutdown_event():
    await app.state.httpx_client.aclose()
    scheduler.shutdown()
    print("FastAPI 앱이 종료됩니다.")


# 4. 메인 엔드포인트 (서버 생존 확인용)
@app.get("/")
def read_root():
    return {"message": "FIN:D Server (Local) is running!"}

# 5. DB 연결 상태 확인 엔드포인트
@app.get("/health/db")
def check_db_connection():
    """데이터베이스 연결 상태를 확인합니다."""
    try:
        # DB 연결 테스트
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            result.fetchone()
        
        # 연결 정보 가져오기
        db_url = str(engine.url).replace(engine.url.password, "***") if engine.url.password else str(engine.url)
        
        return {
            "status": "connected",
            "message": "데이터베이스 연결 성공",
            "database": engine.url.database,
            "host": engine.url.host,
            "port": engine.url.port,
            "connection_url": db_url
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "message": "데이터베이스 연결 실패",
            "error": str(e),
            "database": engine.url.database if engine.url else None,
            "host": engine.url.host if engine.url else None,
            "port": engine.url.port if engine.url else None
        }