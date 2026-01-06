# app/database.py

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import urllib.parse # 비밀번호에 특수문자가 있을 경우를 대비해 인코딩 필요
from app.config import RDS_HOST, RDS_USER, RDS_PASSWORD, RDS_DB_NAME, RDS_PORT

# 필수 환경 변수 검증
if not all([RDS_HOST, RDS_USER, RDS_PASSWORD, RDS_DB_NAME]):
    raise ValueError(
        "RDS 연결을 위한 환경 변수가 설정되지 않았습니다. "
        ".env 파일에 RDS_HOST, RDS_USER, RDS_PASSWORD, RDS_DB_NAME을 설정해주세요."
    )

# 비밀번호에 특수문자(@, !, # 등)가 포함된 경우 URL 인코딩 처리
encoded_password = urllib.parse.quote_plus(RDS_PASSWORD)

# 1. RDS MySQL DB 접속 URL 생성
# 형식: mysql+pymysql://USER:PASSWORD@HOST:PORT/DB_NAME
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{RDS_USER}:{encoded_password}@{RDS_HOST}:{RDS_PORT}/{RDS_DB_NAME}?charset=utf8mb4"

# 2. DB 연결 엔진 생성
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # 연결 끊김 방지 (클라우드 환경 필수)
    pool_recycle=3600,   # 1시간마다 연결 재생성
    echo=False           # 디버깅 시 True
)

# 3. DB와 통신할 세션 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. SQLAlchemy 모델들이 상속할 기본 클래스
Base = declarative_base()

# (참고) 연결 정보 출력 (실제 연결은 main.py의 startup 이벤트에서 테스트)
print(f"DB 설정 완료: {RDS_HOST}/{RDS_DB_NAME}")