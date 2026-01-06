# app/mcp/service.py
# MCP 에이전트의 핵심 진입점입니다. 

from typing import Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session
from app import models
from app.mcp.agent import MCPAgent
from openai import AsyncOpenAI

async def run_mcp_agent(
    user_message: str,
    context_ticker: Optional[str],
    current_user: models.User,
    db: Session,
    httpx_client: httpx.AsyncClient,
    openai_client: AsyncOpenAI
) -> Dict[str, Any]:
    """
    하위 호환성을 위해 유지되는 래퍼 함수입니다.
    실제 로직은 app.mcp.agent.MCPAgent 클래스에서 처리됩니다.
    """
    agent = MCPAgent(db=db, httpx_client=httpx_client, openai_client=openai_client)
    return await agent.run(user_message, current_user, context_ticker=context_ticker)