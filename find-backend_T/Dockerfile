# Python 3.11 slim 이미지 사용
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# mysqlclient 추가 설치 (MySQL 연결용)
RUN pip install mysqlclient

# 앱 소스 복사
COPY . .

# 포트 노출
EXPOSE 8000

# 기본 실행 명령 (main.py의 FastAPI 앱)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
