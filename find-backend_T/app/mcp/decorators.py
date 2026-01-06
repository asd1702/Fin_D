"""도구 등록 데코레이터와 헬퍼를 정의합니다."""

from __future__ import annotations

import inspect
from typing import Any, Callable, Dict, List, Optional, Union, get_origin, get_args
from enum import Enum
from pydantic import BaseModel

ToolCallable = Callable[..., Any]

_tool_registry: List[ToolCallable] = []


def register_tool(func: ToolCallable) -> ToolCallable:
    """
    MCP 도구 함수로 등록하는 데코레이터.
    동일 함수가 여러 번 등록되지 않도록 방지합니다.
    """
    if func not in _tool_registry:
        _tool_registry.append(func)
    return func


def get_registered_tools() -> List[ToolCallable]:
    """현재 등록된 모든 MCP 도구 함수 목록을 반환합니다."""
    return list(_tool_registry)


def _unwrap_optional(annotation: Any) -> Any:
    origin = get_origin(annotation)
    if origin in (Union, Optional):
        args = tuple(arg for arg in get_args(annotation) if arg is not type(None))
        if len(args) == 1:
            return args[0]
    return annotation


def type_to_json_schema(annotation: Any) -> Dict[str, Any]:
    """
    간단한 Python 타입 힌트를 OpenAI가 이해할 수 있는 JSON 스키마로 변환합니다.
    복잡한 타입(Optional, List 등)은 기본적인 형태만 지원하며,
    추가 타입이 필요하면 이 함수를 확장하세요.
    """
    annotation = _unwrap_optional(annotation)
    origin = get_origin(annotation)

    if annotation in (str,):
        return {"type": "string"}
    if annotation in (int,):
        return {"type": "integer"}
    if annotation in (float,):
        return {"type": "number"}
    if annotation in (bool,):
        return {"type": "boolean"}
    
    # [NEW] Enum 지원
    if inspect.isclass(annotation) and issubclass(annotation, Enum):
        return {
            "type": "string",
            "enum": [e.value for e in annotation]
        }
    
    # [NEW] Pydantic 모델 지원
    if inspect.isclass(annotation) and issubclass(annotation, BaseModel):
        # Pydantic v2 호환성 확인
        if hasattr(annotation, "model_json_schema"):
            schema = annotation.model_json_schema()
        else:
            schema = annotation.schema()
        
        # OpenAI 스키마에 불필요한 필드 제거
        schema.pop("title", None)
        schema.pop("definitions", None)
        schema.pop("$defs", None)
        return schema

    if origin in (list, List):
        item_args = get_args(annotation)
        item_schema = type_to_json_schema(item_args[0]) if item_args else {"type": "string"}
        return {"type": "array", "items": item_schema}
    if origin in (dict, Dict):
        return {"type": "object"}

    return {"type": "string"}


def build_tool_schema(func: ToolCallable) -> Dict[str, Any]:
    """
    등록된 함수의 시그니처, 독스트링을 기반으로 OpenAI tool 스키마를 생성합니다.
    """
    func_name = func.__name__
    func_doc = inspect.getdoc(func) or "No description provided."

    sig = inspect.signature(func)
    properties: Dict[str, Any] = {}
    required: List[str] = []

    for name, param in sig.parameters.items():
        if name in {"db", "client", "httpx_client", "current_user", "user_id", "current_user_id"}:
            continue

        annotation = param.annotation if param.annotation is not inspect.Parameter.empty else str
        properties[name] = type_to_json_schema(annotation)
        if param.default is inspect.Parameter.empty:
            required.append(name)

    return {
        "type": "function",
        "function": {
            "name": func_name,
            "description": func_doc,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }

