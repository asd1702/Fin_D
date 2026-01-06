# app/config.py
import os
from dotenv import load_dotenv

# .env 파일의 경로를 명확히 지정해줍니다.
# 이 파일(config.py)의 상위 폴더(app)의 상위 폴더(find-backend)에 있는 .env 파일을 로드합니다.
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

# API 키 로드
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY")
FMP_API_KEY = os.getenv("FMP_API_KEY")

# API 기본 URL 로드
TWELVE_DATA_BASE_URL = "https://api.twelvedata.com"
FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"
STABLE_FMP_BASE_URL = "https://financialmodelingprep.com"

# API 키가 로드되었는지 간단히 확인 (터미널에 출력)
print(f"FMP Key Loaded: {FMP_API_KEY is not None}")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 40))

# RDS 데이터베이스 설정
RDS_HOST = os.getenv("RDS_HOST")
RDS_USER = os.getenv("RDS_USER")
RDS_PASSWORD = os.getenv("RDS_PASSWORD")
RDS_DB_NAME = os.getenv("RDS_DB_NAME")
RDS_PORT = os.getenv("RDS_PORT", "3306")