# app/mcp/agent.py
import json
import inspect
import asyncio
import time
from typing import Dict, Any, List, Optional
from openai import AsyncOpenAI
from sqlalchemy.orm import Session
import httpx

from app import models, schemas
from app.config import OPENAI_API_KEY
from app.database import SessionLocal
from app.mcp.registry import tools_schema, available_tools
from app.mcp.prompts import (
    BASE_PERSONA, CORE_RULES, FORMATTING_RULES, INTENT_PROMPT_MAP
)

class MCPAgent:
    def __init__(
        self, 
        db: Session, 
        httpx_client: httpx.AsyncClient, 
        openai_client: Optional[AsyncOpenAI] = None,
        model: str = "gpt-4o-mini"
    ):
        # OpenAI 클라이언트 (전달받은 것을 우선 사용, 없으면 새로 생성)
        self.client = openai_client or AsyncOpenAI(api_key=OPENAI_API_KEY)
        self.db = db
        self.httpx_client = httpx_client
        self.model = model
        self.max_turns = 3
        self.tool_timeout = 15.0  # 도구 실행 최대 대기 시간 (초)

    async def run(self, user_message: str, current_user: models.User, context_ticker: Optional[str] = None) -> Dict[str, Any]:
        """AI 에이전트의 전체 사이클을 실행합니다."""
        start_time_all = time.time()
        print(f"\n{'='*20} [Chat Request Start] {'='*20}", flush=True)
        print(f"👤 User ({current_user.email}): {user_message[:100]}", flush=True)
        if context_ticker:
            print(f"📍 Context Ticker: {context_ticker}", flush=True)
        
        # 1. 메모리 및 컨텍스트 준비
        messages = self._prepare_messages(user_message, current_user, context_ticker=context_ticker)
        collected_widgets = []
        
        # 2. 사용자 질문 DB 저장
        self._save_chat_history(current_user.id, "user", user_message)

        # 3. Multi-Turn ReAct Loop
        turn_count = 0
        final_content = ""
        total_usage = {"prompt": 0, "completion": 0, "total": 0}

        try:
            while turn_count < self.max_turns:
                turn_count += 1
                print(f"\n[Turn {turn_count}/{self.max_turns}] AI Thinking...", flush=True)

                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=tools_schema,
                    tool_choice="auto"
                )
                
                msg = response.choices[0].message
                
                # 토큰 사용량 합산 및 로그
                if hasattr(response, 'usage') and response.usage:
                    u = response.usage
                    total_usage["prompt"] += u.prompt_tokens
                    total_usage["completion"] += u.completion_tokens
                    total_usage["total"] += u.total_tokens
                    print(f"📊 Tokens: {u.total_tokens} (P:{u.prompt_tokens}, C:{u.completion_tokens})", flush=True)

                # AI의 사고 내용 출력 (있는 경우)
                if msg.content:
                    print(f"🤖 AI Thought: {msg.content[:200]}...", flush=True)

                if msg.tool_calls:
                    print(f"🛠️ Tool Calls: {len(msg.tool_calls)} EA", flush=True)
                    for tc in msg.tool_calls:
                        print(f"   - {tc.function.name}({tc.function.arguments})", flush=True)
                    
                    # 메시지 리스트에 AI의 도구 호출 의도 추가
                    messages.append(self._format_assistant_tool_calls(msg))

                    # 도구 병렬 실행
                    results = await self._execute_tools_parallel(msg.tool_calls, current_user)
                    
                    for res in results:
                        if res:
                            collected_widgets.extend(res.pop("widgets", []))
                            messages.append(res)
                    continue
                else:
                    final_content = msg.content
                    break

            # Fail-safe: 루프 종료 후 답변이 없는 경우
            if not final_content:
                final_content = await self._generate_fail_safe_response(messages)

            # 4. 결과 정리 및 사후 처리
            unique_widgets = self._deduplicate_widgets(collected_widgets)
            self._save_chat_history(current_user.id, "assistant", final_content)
            self.db.commit()

            duration = time.time() - start_time_all
            print(f"\n{'*'*15} [Process Summary] {'*'*15}", flush=True)
            print(f"⏱️ Time: {duration:.2f}s", flush=True)
            print(f"📈 Total Tokens: {total_usage['total']} (P:{total_usage['prompt']}, C:{total_usage['completion']})", flush=True)
            print(f"✅ Widgets: {len(unique_widgets)} EA", flush=True)
            print(f"{'='*55}\n", flush=True)

            return {
                "content": final_content,
                "widgets": unique_widgets
            }

        except Exception as e:
            self.db.rollback()
            print(f"\n❌ [MCPAgent Error]: {e}", flush=True)
            print(f"{'='*55}\n", flush=True)
            raise e

    def _prepare_messages(self, user_message: str, current_user: models.User, context_ticker: Optional[str] = None) -> List[Dict[str, Any]]:
        """사용자 의도에 맞춰 시스템 프롬프트를 동적으로 조립합니다."""
        
        # 1. 의도 분석 (Intent Classification)
        intents = self._analyze_intents(user_message)
        
        # 2. 시스템 프롬프트 조립 (Prompt Diet)
        system_content = BASE_PERSONA + CORE_RULES
        for intent in intents:
            if intent in INTENT_PROMPT_MAP:
                system_content += INTENT_PROMPT_MAP[intent]
        
        # [NEW] 컨텍스트 티커 정보 주입 (가이드라인)
        if context_ticker:
            system_content += f"\n\n[CONTEXT_INFO]\n- 현재 사용자는 {context_ticker} 상세 페이지를 보고 있습니다."
        
        system_content += FORMATTING_RULES
        messages = [{"role": "system", "content": system_content}]
        
        # 3. 최근 대화 기록 로드 (최대 4개로 확대하여 맥락 유지)
        db_history = self.db.query(models.ChatHistory)\
                       .filter(models.ChatHistory.user_id == current_user.id)\
                       .order_by(models.ChatHistory.created_at.desc())\
                       .limit(4)\
                       .all()
        
        for msg in reversed(db_history):
            messages.append({"role": msg.role, "content": msg.content})
        
        # 4. [CRITICAL] 최종 컨텍스트 강조 주입
        # 이전 대화가 무엇이었든 현재 페이지 종목을 명시적으로 재강조
        final_message = user_message
        if context_ticker:
            final_message = f"[SYSTEM_REMINDER: 현재 사용자가 보고 있는 {context_ticker} 종목을 최우선 분석하세요]\n{user_message}"
            
        messages.append({"role": "user", "content": final_message})
        return messages

    def _analyze_intents(self, text: str) -> List[str]:
        """텍스트에서 사용자의 의도를 간단히 키워드 기반으로 추출합니다."""
        text = text.lower()
        found = []
        
        keywords = {
            "earnings": ["실적", "어닝", "earnings", "eps", "매출", "surprise", "순이익", "영업이익"],
            "valuation": ["밸류", "per", "pbr", "valuation", "적정주가", "비싼가", "싼가", "멀티플", "저평가", "고평가"],
            "why": ["왜", "이유", "원인", "why", "급락", "급등", "하락", "상승", "변동", "움직임"],
            "news": ["뉴스", "소식", "news", "최신", "이슈", "호재", "악재", "공시"]
        }
        
        for intent, kw_list in keywords.items():
            if any(kw in text for kw in kw_list):
                found.append(intent)
        
        # 기본값: 의도를 알 수 없을 때 모든 규칙 포함 (Safety Fallback)
        if not found:
            return ["earnings", "valuation", "why", "news"]
            
        return found

    def _format_assistant_tool_calls(self, msg) -> Dict[str, Any]:
        """OpenAI 응답 객체를 대화 이력 형식으로 변환합니다."""
        return {
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                } for tc in msg.tool_calls
            ]
        }

    async def _execute_tools_parallel(self, tool_calls, current_user: models.User) -> List[Dict[str, Any]]:
        """여러 도구를 비동기 병렬로 실행합니다."""
        tasks = [self._execute_single_tool(tc, current_user) for tc in tool_calls]
        return await asyncio.gather(*tasks)

    async def _execute_single_tool(self, tc, current_user: models.User) -> Optional[Dict[str, Any]]:
        """단일 도구를 실행하고 결과를 포맷팅합니다."""
        fn_name = tc.function.name
        fn_to_call = available_tools.get(fn_name)
        if not fn_to_call:
            return None

        args = self._parse_arguments(tc.function.arguments)
        
        # [NEW] 도구별 독립 세션 생성 (병렬 실행 시 세션 충돌 방지)
        tool_db = SessionLocal()
        self._inject_dependencies(fn_name, fn_to_call, args, current_user, tool_db)

        print(f"🛠️  Tool Start: {fn_name}...", flush=True)
        t_start = time.time()
        try:
            # [NEW] 타임아웃 적용 (비정상적인 무한 대기 방지)
            if inspect.iscoroutinefunction(fn_to_call):
                res = await asyncio.wait_for(fn_to_call(**args), timeout=self.tool_timeout)
            else:
                res = fn_to_call(**args)
            
            t_end = time.time()
            print(f"✅ Tool End: {fn_name} ({t_end - t_start:.2f}s)", flush=True)
            
            if hasattr(res, "dict"): res = res.dict()
            widgets = res.get("widgets", []) if isinstance(res, dict) else []
            
            # 성공 시 커밋
            tool_db.commit()
            
            return {
                "tool_call_id": tc.id,
                "role": "tool",
                "name": fn_name,
                "content": json.dumps(res, default=str, ensure_ascii=False),
                "widgets": widgets
            }
        except asyncio.TimeoutError:
            tool_db.rollback()
            print(f"[Timeout] {fn_name} 실행 시간 초과 ({self.tool_timeout}s)", flush=True)
            return {
                "tool_call_id": tc.id,
                "role": "tool",
                "name": fn_name,
                "content": json.dumps({"error": "조회 시간이 초과되었습니다. 다시 시도해 주세요."}, ensure_ascii=False),
                "widgets": []
            }
        except Exception as e:
            tool_db.rollback()
            print(f"[Tool Error] {fn_name}: {e}", flush=True)
            return {
                "tool_call_id": tc.id,
                "role": "tool",
                "name": fn_name,
                "content": json.dumps({"error": str(e)}, ensure_ascii=False),
                "widgets": []
            }
        finally:
            tool_db.close()

    def _parse_arguments(self, raw_args: str) -> Dict[str, Any]:
        try:
            args = json.loads(raw_args or "{}")
            return args if isinstance(args, dict) else {}
        except:
            return {}

    def _inject_dependencies(self, name: str, func, args: Dict[str, Any], current_user: models.User, tool_db: Session):
        """함수 시그니처에 맞춰 필요한 객체들을 주입합니다."""
        sig = inspect.signature(func)
        for pn in sig.parameters.keys():
            if pn == "db": args.setdefault("db", tool_db)
            elif pn in {"client", "httpx_client"}: args.setdefault(pn, self.httpx_client)
            elif pn == "openai_client": args.setdefault("openai_client", self.client)
            elif pn in {"user_id", "current_user_id"}: args.setdefault(pn, current_user.id)
            elif pn == "current_user": args.setdefault("current_user", current_user)

    async def _generate_fail_safe_response(self, messages: List[Dict[str, Any]]) -> str:
        print("[MCPAgent] MAX_TURNS 도달, 강제 답변 생성 중...", flush=True)
        resp = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tool_choice="none"
        )
        return resp.choices[0].message.content

    def _save_chat_history(self, user_id: int, role: str, content: str):
        msg = models.ChatHistory(user_id=user_id, role=role, content=content)
        self.db.add(msg)

    def _deduplicate_widgets(self, widgets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if len(widgets) <= 1:
            return widgets
        
        unique = []
        seen = set()
        for w in widgets:
            key = f"{w.get('type')}_{w.get('ticker', w.get('title', ''))}"
            if key not in seen:
                seen.add(key)
                unique.append(w)
        
        if len(unique) < len(widgets):
            print(f"[MCPAgent] 위젯 중복 제거: {len(widgets)} -> {len(unique)}", flush=True)
        return unique
