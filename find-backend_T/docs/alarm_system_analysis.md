# Find-Backend 알림 시스템 분석

## 개요
`find-backend_T`의 알림 시스템은 사용자에게 두 가지 주요 유형의 알림을 제공하도록 설계되었습니다:
1.  **개인 일정 리마인더**: 사용자가 등록한 개인 일정에 대한 알림.
2.  **경제지표 알림**: AI가 생성한 인사이트를 포함한 주요 글로벌 경제지표 실시간 알림.

## 아키텍처

### 1. 데이터베이스 스키마 (`app/models.py`)
시스템은 관계형 데이터베이스(MySQL, SQLAlchemy 사용)를 사용합니다.

- **`Notification` 테이블**:
    - `id`: 기본 키 (Primary Key)
    - `user_id`: `User` 테이블 외래 키
    - `title`: 알림 제목
    - `content`: 상세 내용 (예: AI 요약)
    - `notification_type`: 구분 문자열 (`"calendar"` 또는 `"economic"`)
    - `is_read`: 읽음 상태 (0: 안읽음, 1: 읽음)
    - `related_event_id`: `UserEvent` 연결 ID (calendar 타입인 경우)
    - `economic_event`: 경제지표 이름 (economic 타입인 경우)
    - `created_at`: 생성 시간

### 2. 스케줄러 (`app/services/notification_scheduler.py` & `main.py`)
`main.py`에서 초기화된 `APScheduler` (`AsyncIOScheduler`)를 사용합니다.

#### 캘린더 리마인더
- **일정**: 매일 **오전 09:00**.
- **로직**:
    - `UserEvent` 테이블에서 **내일** 예정된 일정을 조회합니다.
    - 아직 알림이 생성되지 않은 경우 해당 사용자에 대한 알림을 생성합니다.
    - 제목 형식: `📅 내일 일정: {event.title}`

#### 경제지표 알림
- **일정**: **21:30, 22:30, 03:00 (KST)** (주요 미국 경제지표 발표 시간대).
- **로직**:
    - **FMP (Financial Modeling Prep) API**에서 경제지표 캘린더 데이터를 가져옵니다.
    - **주요 지표**만 필터링합니다 (`economic_insight_service.py`에 정의됨):
        - CPI, PPI, NFP (비농업 고용지수), 연준 금리 결정, GDP, 소매판매 등.
    - *실제값(Actual)*이 발표되었는지 확인합니다.
    - **AI 통합**: `generate_economic_insight` (OpenAI GPT-4o-mini)를 호출하여 다음을 수행합니다:
        - 지표 이름을 한국어로 변환.
        - 결과 분석 (실제값 vs 예상치).
        - 1-2문장의 시장 영향 분석(주식/채권/달러) 생성.
    - **전파 (Broadcasting)**: **모든 등록된 사용자**에게 알림을 생성합니다.
    - **중복 방지**: 동일한 발표에 대한 중복 알림을 피하기 위해 `_processed_economic_events` 세트를 사용합니다.

### 3. API 엔드포인트 (`app/routers/notification.py`)
- **GET `/api/v1/notifications`**: 로그인한 사용자의 알림 목록 조회.
- **GET `/api/v1/notifications/unread-count`**: 읽지 않은 알림 수 조회.
- **PUT `/api/v1/notifications/{id}/read`**: 특정 알림 읽음 처리.
- **PUT `/api/v1/notifications/read-all`**: 모든 알림 읽음 처리.
- **DELETE `/api/v1/notifications/{id}`**: 알림 삭제.
- **POST `/api/v1/notifications/trigger-calendar`**: 캘린더 체크 수동 실행 (테스트용).
- **POST `/api/v1/notifications/trigger-economic`**: 경제지표 체크 수동 실행 (테스트용).

## 주요 파일
- `app/models.py`: 데이터베이스 스키마 정의.
- `app/routers/notification.py`: API 엔드포인트.
- `app/services/notification_scheduler.py`: 알림 체크 및 생성을 위한 핵심 비즈니스 로직.
- `app/services/economic_insight_service.py`: FMP 데이터 필터링 및 OpenAI GPT-4o-mini 통합을 위한 헬퍼 서비스.
- `main.py`: 스케줄러 설정 및 작업 등록.

## 관찰 사항 및 제안
- **브로드캐스팅**: 현재 경제지표 알림은 *모든* 사용자에게 전송됩니다. 사용자 기반이 커지면 설정(예: "경제지표 알림 받기: On/Off")을 추가하는 것이 좋습니다.
- **타임존**: 스케줄러가 특정 시간(KST 기준 21:30 등)으로 하드코딩되어 있습니다. 서버의 시스템 시간이 KST로 설정되어 있는지 확인이 필요합니다 (Docker 컨테이너 타임존 등).
- **에러 처리**: 스케줄러는 앱이 중단되지 않도록 기본적인 try/except 블록을 가지고 있으며, 이는 좋은 방식입니다.
