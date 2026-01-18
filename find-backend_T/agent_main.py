# agent_main.py
# AI 에이전트 전용 서버 (포트 8001)

import os
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 공통 모듈 임포트
from app.routers import agent, market, auth, company, user, user_data, news
from app.database import engine
from app.config import OPENAI_API_KEY
import time
from fastapi import Request
import sys
from openai import AsyncOpenAI

# FastAPI 앱 객체 생성
app = FastAPI(title="Fin:D Agent Service")

# 로그 즉시 출력을 위한 표준 출력 설정 (Windows 버퍼링 방지)
sys.stdout.reconfigure(line_buffering=True)

# [NEW] 요청 로깅 미들웨어
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    path = request.url.path
    method = request.method
    print(f"--- [Agent API Start] {method} {path} ---")
    
    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000
    print(f"--- [Agent API End] {method} {path} - {response.status_code} ({process_time:.2f}ms) ---")
    return response

# CORS 설정 (프론트엔드 연결 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 에이전트 전용 라우터만 등록
app.include_router(agent.router)
# 프론트엔드에서 필요한 공통 API 라우터도 추가 (market, auth, company, user, user_data, news)
app.include_router(market.router)
app.include_router(auth.router)
app.include_router(company.router)
app.include_router(user.router)
app.include_router(user_data.router)
app.include_router(news.router)

@app.on_event("startup")
async def startup_event():
    app.state.httpx_client = httpx.AsyncClient()
    app.state.openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    print("🚀 Fin:D AI 에이전트 서버가 시작되었습니다. (Port: 8001)")
    print("💡 이 터미널에서 채팅 처리 과정과 토큰 사용량을 확인할 수 있습니다.")
    
    # DB 연결 확인용 간단 로그
    try:
        with engine.connect() as conn:
            print("✅ DB 연결 상태: 정상")
    except Exception as e:
        print(f"❌ DB 연결 실패: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    await app.state.httpx_client.aclose()
    await app.state.openai_client.close()
    print("💤 AI 에이전트 서버가 종료됩니다.")

@app.get("/")
def read_root():
    return {"message": "Fin:D Agent Server is running on port 8001"}
