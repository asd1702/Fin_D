# app/models.py

from sqlalchemy import (
    Column, Integer, String, TIMESTAMP, TEXT, ForeignKey, 
    DECIMAL, BIGINT, JSON, Date, UniqueConstraint, DateTime, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# database.py에서 만든 Base 클래스를 가져옴
from .database import Base

# --- 1. 사용자 테이블 ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


    chat_history = relationship("ChatHistory", back_populates="owner")
    favorites = relationship("UserFavorite", back_populates="owner", cascade="all, delete-orphan")
    events = relationship("UserEvent", back_populates="owner", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="owner", cascade="all, delete-orphan")

# --- 2. AI 대화 기록 ---
class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False) # "user" or "assistant"
    content = Column(TEXT, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    owner = relationship("User", back_populates="chat_history")

# --- 11. 기업 즐겨찾기 ---
class UserFavorite(Base):
    __tablename__ = "user_favorites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String(20), ForeignKey("company_profiles.ticker", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    owner = relationship("User", back_populates="favorites")
    company = relationship("CompanyProfile")

    __table_args__ = (
        UniqueConstraint('user_id', 'ticker', name='unique_user_favorite'),
    )

# --- 3. FMP 기업 정보 ---
class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    ticker = Column(String(20), primary_key=True)
    companyName = Column(String(255), nullable=False)
    k_name = Column(String(255))  # 한글 기업명
    description = Column(TEXT)
    industry = Column(String(100))
    sector = Column(String(100))
    website = Column(String(255))
    logo_url = Column(String(500))  # FMP image URL 또는 Clearbit URL
    last_updated = Column(TIMESTAMP, nullable=False)

    income_statements = relationship("CompanyIncomeStatement", back_populates="company")
    balance_sheets = relationship("CompanyBalanceSheet", back_populates="company")
    cash_flows = relationship("CompanyCashFlow", back_populates="company")
    key_metrics = relationship("CompanyKeyMetrics", back_populates="company")
    ratings = relationship("AnalystRating", back_populates="company")
    earnings = relationship("EarningsCalendar", back_populates="company")
    insider_trades = relationship("InsiderTrade", back_populates="company")


# --- 4. 손익계산서 ---
class CompanyIncomeStatement(Base):
    __tablename__ = "company_income_statements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("company_profiles.ticker"), nullable=False)
    period = Column(String(20), nullable=False, default="annual")
    report_date = Column(Date, nullable=False)
    report_year = Column(Integer, nullable=False)
    revenue = Column(BIGINT)
    cost_of_revenue = Column(BIGINT)
    gross_profit = Column(BIGINT)
    operating_income = Column(BIGINT)
    net_income = Column(BIGINT)
    eps = Column(DECIMAL(18, 4))
    diluted_eps = Column(DECIMAL(18, 4))
    operating_expenses = Column(BIGINT)
    ebitda = Column(BIGINT)
    created_at = Column(TIMESTAMP, server_default=func.now())

    company = relationship("CompanyProfile", back_populates="income_statements")

    __table_args__ = (
        UniqueConstraint('ticker', 'period', 'report_date', name='_cis_ticker_period_date_uc'),
        Index('ix_income_ticker_date', 'ticker', 'report_date'),
    )


# --- 5. 대차대조표 ---
class CompanyBalanceSheet(Base):
    __tablename__ = "company_balance_sheets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("company_profiles.ticker"), nullable=False)
    period = Column(String(20), nullable=False, default="annual")
    report_date = Column(Date, nullable=False)
    report_year = Column(Integer, nullable=False)
    total_assets = Column(BIGINT)
    total_current_assets = Column(BIGINT)
    total_liabilities = Column(BIGINT)
    # 세부 부채 구조
    total_current_liabilities = Column(BIGINT)
    total_noncurrent_liabilities = Column(BIGINT)
    total_equity = Column(BIGINT)
    cash_and_short_term_investments = Column(BIGINT)
    inventory = Column(BIGINT)
    accounts_receivable = Column(BIGINT)
    accounts_payable = Column(BIGINT)
    long_term_debt = Column(BIGINT)
    short_term_debt = Column(BIGINT)
    created_at = Column(TIMESTAMP, server_default=func.now())

    company = relationship("CompanyProfile", back_populates="balance_sheets")

    __table_args__ = (
        UniqueConstraint('ticker', 'period', 'report_date', name='_cbs_ticker_period_date_uc'),
        Index('ix_balance_ticker_date', 'ticker', 'report_date'),
    )


# --- 6. 현금흐름표 ---
class CompanyCashFlow(Base):
    __tablename__ = "company_cash_flows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("company_profiles.ticker"), nullable=False)
    period = Column(String(20), nullable=False, default="annual")
    report_date = Column(Date, nullable=False)
    report_year = Column(Integer, nullable=False)
    operating_cash_flow = Column(BIGINT)
    investing_cash_flow = Column(BIGINT)
    financing_cash_flow = Column(BIGINT)
    capital_expenditure = Column(BIGINT)
    free_cash_flow = Column(BIGINT)
    # 주식 기반 보상, 자사주 매입, 배당 등 주주 관련 현금흐름 (DB 스키마와 매핑)
    stock_based_compensation = Column(BIGINT)
    common_stock_repurchased = Column(BIGINT)
    dividends_paid = Column(BIGINT)
    created_at = Column(TIMESTAMP, server_default=func.now())

    company = relationship("CompanyProfile", back_populates="cash_flows")

    __table_args__ = (
        UniqueConstraint('ticker', 'period', 'report_date', name='_ccf_ticker_period_date_uc'),
        Index('ix_cashflow_ticker_date', 'ticker', 'report_date'),
    )


# --- 7. 주요 재무 지표 ---
class CompanyKeyMetrics(Base):
    __tablename__ = "company_key_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("company_profiles.ticker"), nullable=False)
    period = Column(String(20), nullable=False, default="annual")
    report_date = Column(Date, nullable=False)
    report_year = Column(Integer, nullable=False)
    revenue_per_share = Column(DECIMAL(18, 4))
    net_income_per_share = Column(DECIMAL(18, 4))
    free_cash_flow_per_share = Column(DECIMAL(18, 4))
    shares_outstanding = Column(BIGINT)
    market_cap = Column(BIGINT)
    book_value_per_share = Column(DECIMAL(18, 4))
    pe_ratio = Column(DECIMAL(18, 4))
    forward_pe = Column(DECIMAL(18, 4))
    peg_ratio = Column(DECIMAL(18, 4))
    enterprise_value_to_ebitda = Column(DECIMAL(18, 4))
    price_to_sales_ratio = Column(DECIMAL(18, 4))
    price_to_book_ratio = Column(DECIMAL(18, 4))
    dividend_yield = Column(DECIMAL(18, 4))
    return_on_assets = Column(DECIMAL(18, 4))
    return_on_equity = Column(DECIMAL(18, 4))
    debt_to_equity = Column(DECIMAL(18, 4))
    current_ratio = Column(DECIMAL(18, 4))
    created_at = Column(TIMESTAMP, server_default=func.now())

    company = relationship("CompanyProfile", back_populates="key_metrics")

    __table_args__ = (
        UniqueConstraint('ticker', 'period', 'report_date', name='_ckm_ticker_period_date_uc'),
        Index('ix_metrics_ticker_date', 'ticker', 'report_date'),
    )

# --- 5. 뉴스 (AI 사전 요약) ---
class NewsArticle(Base):
    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(String(512), unique=True, nullable=False)
    title = Column(TEXT)  # 뉴스 제목이 길 수 있으므로 TEXT로 변경
    publishedDate = Column(TIMESTAMP, nullable=False)
    symbols = Column(TEXT)
    summary = Column(TEXT) # FMP가 제공한 요약본
    news_type = Column(String(20), default="company", index=True)  # "company" 또는 "general"

# --- 6. Twelve Data 차트/지수 ---
class MarketTimeSeries(Base):
    __tablename__ = "market_time_series"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(50), nullable=False)
    interval = Column(String(10), nullable=False)
    datetime = Column(TIMESTAMP, nullable=False)
    open = Column(DECIMAL(20, 6))
    high = Column(DECIMAL(20, 6))
    low = Column(DECIMAL(20, 6))
    close = Column(DECIMAL(20, 6))
    volume = Column(BIGINT)

    __table_args__ = (
        UniqueConstraint('symbol', 'interval', 'datetime', name='_symbol_interval_datetime_uc'),
    )

# --- 7. 단순/휘발성 캐시 ---
class ApiCache(Base):
    __tablename__ = "api_cache"

    cache_key = Column(String(255), primary_key=True)
    data = Column(JSON, nullable=False)
    expires_at = Column(TIMESTAMP, nullable=False)

# --- 8. 애널리스트 평가 (집계 데이터) ---
class AnalystRating(Base):
    __tablename__ = "analyst_ratings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("company_profiles.ticker"), nullable=False)
    date = Column(Date, nullable=False)
    # 집계 통계 데이터
    analyst_ratings_strong_buy = Column(Integer, default=0)
    analyst_ratings_buy = Column(Integer, default=0)
    analyst_ratings_hold = Column(Integer, default=0)
    analyst_ratings_sell = Column(Integer, default=0)
    analyst_ratings_strong_sell = Column(Integer, default=0)
    # 개별 평가 데이터 (향후 확장용, 현재는 NULL 가능)
    analyst_firm = Column(String(100), nullable=True)
    rating = Column(String(20), nullable=True)
    price_target = Column(DECIMAL(10, 2), nullable=True)

    company = relationship("CompanyProfile", back_populates="ratings")

    __table_args__ = (
        UniqueConstraint('ticker', 'date', name='_rating_ticker_date_uc'),
    )

# --- 9. 실적 발표 캘린더 ---
class EarningsCalendar(Base):
    __tablename__ = "earnings_calendar"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("company_profiles.ticker"), nullable=False)
    date = Column(Date, nullable=False)
    period = Column(String(10), nullable=False)
    market_time = Column(String(10))  # bmo, amc, dms

    eps_estimate = Column(DECIMAL(10, 4))
    eps_actual = Column(DECIMAL(10, 4))
    eps_surprise_percent = Column(DECIMAL(10, 4))

    revenue_estimate = Column(BIGINT)
    revenue_actual = Column(BIGINT)
    revenue_surprise_percent = Column(DECIMAL(10, 4))

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    company = relationship("CompanyProfile", back_populates="earnings")

    __table_args__ = (
        UniqueConstraint('ticker', 'date', 'period', name='_earning_uc'),
    )

# --- 10. 내부자 거래 ---
class InsiderTrade(Base):
    __tablename__ = "insider_trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("company_profiles.ticker"), nullable=False)
    transaction_date = Column(Date, nullable=False)
    insider_name = Column(String(255))
    transaction_type = Column(String(20))
    volume = Column(BIGINT)
    price = Column(DECIMAL(10, 2))

    company = relationship("CompanyProfile", back_populates="insider_trades")

    __table_args__ = (
        UniqueConstraint('ticker', 'transaction_date', 'insider_name', 'transaction_type', 'volume', name='_insider_uc'),
    )

# --- 12. 사용자 일정/이벤트 ---
class UserEvent(Base):
    __tablename__ = "user_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    date = Column(Date, nullable=False)
    time = Column(String(50))
    ticker = Column(String(20), ForeignKey("company_profiles.ticker", ondelete="SET NULL"))
    description = Column(TEXT)
    event_type = Column(String(50), default="personal")
    created_at = Column(TIMESTAMP, server_default=func.now())

    owner = relationship("User", back_populates="events")

# --- 13. 알림 ---
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(TEXT)
    notification_type = Column(String(50), nullable=False)  # "calendar" 또는 "economic"
    is_read = Column(Integer, default=0)  # 0: 안읽음, 1: 읽음
    related_event_id = Column(Integer)  # 관련 일정 ID (calendar 타입일 때)
    economic_event = Column(String(100))  # 경제지표 이름 (economic 타입일 때)
    created_at = Column(TIMESTAMP, server_default=func.now())

    owner = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index('ix_notifications_user_created', 'user_id', 'created_at'),
    )