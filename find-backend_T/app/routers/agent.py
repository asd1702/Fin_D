# app/routers/agent.py (Refactored)
# 이 파일은 API 경로를 정의하고, '신분증 검사'와 '입력값 검증'만 담당합니다.
# 실제 핵심 로직은 'app/mcp/service.py'로 분리되었습니다.

import httpx
from fastapi import APIRouter, Depends, Request, HTTPException, Body
from sqlalchemy.orm import Session

# --- 1. 우리가 만든 모듈들 임포트 ---
from app.database import SessionLocal
from app.routers.auth import get_current_user # (신분증 검사관)
from app import models, schemas
from app.mcp import service # [NEW] MCP 핵심 로직 임포트
from openai import AsyncOpenAI

# --- 2. DB 세션을 가져오는 함수 (동일) ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 3. httpx 클라이언트를 받아오는 함수 (동일) ---
def get_httpx_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.httpx_client

def get_openai_client(request: Request) -> AsyncOpenAI:
    return request.app.state.openai_client

# --- 4. AI 에이전트 라우터 생성 (동일) ---
router = APIRouter(
    prefix="/api/v1/agent",
    tags=["Agent (MCP)"]
)

# --- 5. [대폭 수정] 채팅 요청 처리 메인 엔드포인트 ---
@router.post("/chat", response_model=schemas.ChatResponse)
async def chat_with_agent(
    # 의존성 주입 (Dependency Injection)
    httpx_client: httpx.AsyncClient = Depends(get_httpx_client),
    openai_client: AsyncOpenAI = Depends(get_openai_client),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    request_body: schemas.ChatRequest = Body(...),
):
    """
    [로그인 필요] AI 에이전트와 대화합니다.
    핵심 로직은 mcp.service.run_mcp_agent 함수로 분리되었습니다.
    """
    
    # 1. 입력값 검증 (auth.py에서 복사해 온 안전장치)
    message_content = request_body.message
    if not message_content:
        raise HTTPException(
            status_code=400, 
            detail="Request body는 반드시 {\"message\": \"당신의 질문\"} 형식이어야 합니다."
        )

    try:
        # 2. [NEW] 모든 핵심 로직을 mcp.service로 위임
        # service.run_mcp_agent는 이제 {"content": "...", "widgets": [...]} 형태의 dict를 반환합니다.
        result = await service.run_mcp_agent(
            user_message=message_content,
            context_ticker=request_body.context_ticker,
            current_user=current_user,
            db=db,
            httpx_client=httpx_client,
            openai_client=openai_client
        )
        
        # 3. ChatResponse 객체 생성
        if isinstance(result, dict):
            return schemas.ChatResponse(
                response=result["content"],
                widgets=result.get("widgets")
            )
        else:
            # 하위 호환성 (혹시 str만 반환되는 경우)
            return schemas.ChatResponse(response=str(result))
    
    except Exception as e:
        # service.py에서 발생한 에러를 여기서 최종 처리
        print(f"Chat API 라우터 에러 발생: {e}")
        raise HTTPException(status_code=500, detail=f"AI 에이전트 처리 중 오류 발생: {e}")