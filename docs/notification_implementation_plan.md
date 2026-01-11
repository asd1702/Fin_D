# 알림 시스템 구현 계획

## 개요
캘린더 일정 알림(D-1)과 경제지표 발표 알림(실시간 + AI 인사이트)을 구현합니다.

---

## Proposed Changes

### [백엔드] 데이터베이스 모델

#### [MODIFY] models.py
- `Notification` 모델 추가
  - `id`, `user_id`, `title`, `content`, `notification_type` (calendar/economic)
  - `is_read`, `created_at`, `related_event_id`, `economic_event`

#### [MODIFY] schemas.py
- `NotificationCreate`, `NotificationResponse` 스키마 추가

---

### [백엔드] API 엔드포인트

#### [NEW] notification.py
- `GET /api/v1/notifications` - 사용자 알림 목록 조회
- `PUT /api/v1/notifications/{id}/read` - 읽음 처리
- `DELETE /api/v1/notifications/{id}` - 알림 삭제
- `GET /api/v1/notifications/unread-count` - 읽지 않은 알림 수

---

### [백엔드] 스케줄러 서비스

#### [NEW] notification_scheduler.py
**일정 알림 (매일 오전 9시 실행)**
- `user_event` 테이블에서 내일 일정 조회
- 각 사용자에게 `Notification` 생성

**경제지표 알림 (5분마다 폴링)**
- FMP `/stable/economic-calendar` API 호출
- 새로 발표된 지표 감지
- AI 인사이트 생성 → 모든 사용자에게 알림 생성

#### [NEW] economic_insight_service.py
- GPT-4o-mini를 활용한 경제지표 인사이트 생성
- 입력: 지표명, 실제값, 예상값, 이전값
- 출력: 한글 요약 + 시장 영향 분석

---

### [프론트엔드] 알림 페이지

#### [MODIFY] Alerts.tsx
- 알림 목록 UI 구현
- 읽음/안읽음 표시
- 클릭 시 상세 내용 표시
- 탭 구분: 전체 / 일정 / 경제지표

#### [NEW] Alerts.css
- 알림 카드 스타일

#### [NEW] notificationApi.ts
- 알림 API 호출 함수

---

## 데이터 흐름

```
[매일 오전 9시] user_event → 내일 일정 필터 → Notification 생성

[5분마다] FMP API → 새 경제지표 감지 → GPT-4o-mini 인사이트 → Notification 생성
```

---

## Verification Plan

1. **알림 API 테스트**: `curl http://localhost:8000/api/v1/notifications`
2. **프론트엔드 UI 테스트**: 알림 페이지에서 알림 목록 확인
3. **스케줄러 트리거 테스트**: 수동으로 스케줄러 실행하여 알림 생성 확인
