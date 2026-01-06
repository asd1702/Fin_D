# app/schemas.py

from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any

# --- Token (로그인 응답) ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- User (사용자) ---
class UserBase(BaseModel):
    username: str
    name: str
    age: int
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None

class UserCreate(UserBase):
    password: str # 회원가입 시에는 비밀번호를 받음

class User(UserBase):
    id: int

    # DB에서 읽어올 때, 이 객체를 SQLAlchemy 모델처럼 다룰 수 있게 함
    class Config:
        orm_mode = True
# app/schemas.py

from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any

# --- Token (로그인 응답) ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- User (사용자) ---
class UserBase(BaseModel):
    username: str
    name: str
    age: int
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None

class UserCreate(UserBase):
    password: str # 회원가입 시에는 비밀번호를 받음

class User(UserBase):
    id: int

    # DB에서 읽어올 때, 이 객체를 SQLAlchemy 모델처럼 다룰 수 있게 함
    class Config:
        orm_mode = True


class ChatRequest(BaseModel):
    message: str # 프론트엔드가 보낼 "새 질문"
    context_ticker: Optional[str] = None # [NEW] 현재 페이지의 종목 티커

class ChatResponse(BaseModel):
    response: str # 서버가 반환할 "AI의 답변"
    widgets: Optional[List[Dict[str, Any]]] = None # [NEW] 시각화 위젯 데이터

# --- Dashboard Widgets (High Density) ---

class AnalystCardWidget(BaseModel):
    type: str = "analyst_card"
    consensus_rating: str  # "Strong Buy", "Hold", etc.
    consensus_score: float # 1.0 ~ 5.0
    target_price: float
    current_price: float
    upside_percent: float
    analyst_count: int
    distribution: Dict[str, int] # {"buy": 10, "hold": 5, ...}

class MetricItem(BaseModel):
    label: str
    value: Any
    formatted: str
    sub_text: Optional[str] = None # "코스피 1위", "업종 평균 대비 High"
    status: Optional[str] = None # "good", "bad", "neutral", "warning"
    trend: Optional[str] = None # "up", "down", "flat"

class MetricsGridWidget(BaseModel):
    type: str = "metrics_grid"
    items: List[MetricItem]