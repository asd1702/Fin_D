# Chart Server - 담당자 기여 (@asd1702)

> Fin:D 프로젝트에서 실시간 시장 데이터 제공 영역인 Chart Server를 담당했습니다.
> Chart Server는 외부 실시간 가격 데이터를 수신하고, 1분봉 캔들을 생성한 뒤, TimescaleDB에 저장하고 REST/WebSocket으로 프론트엔드에 제공합니다.

## 기여 요약

- TwelveData WebSocket 기반 실시간 가격 데이터 수신 흐름 구현
- tick 데이터를 1분봉 OHLCV 캔들로 조립하는 CandleMaker 구현
- CandleBuffer를 통한 배치 저장, 재시도, Dead Letter 처리 구조 구현
- TimescaleDB Continuous Aggregates 기반 상위 타임프레임 조회 구조 적용
- REST API(`/api/candles/:symbol/:timeframe`)와 WebSocket(`/ws`) 기반 차트 데이터 제공
- Docker 기반 실행 환경 구성
- CandleMaker, timeframe 유틸, CandleBuffer, 핵심 API 테스트 기반 구축
- 캔들 조회와 Aggregate refresh의 입력 검증 및 일관된 400 오류 응답 적용
- URL encoded symbol 처리와 공통 API 실패 응답 경로 테스트 추가
- WebSocket client별 symbol 구독/해제, 메시지 filtering, heartbeat cleanup 구현

## 담당 범위

| 영역 | 내용 |
| --- | --- |
| 실시간 수신 | TwelveData WebSocket 연결, reconnect, heartbeat 감지 |
| 캔들 생성 | tick -> 1m OHLCV 변환 |
| 저장 | Prisma + TimescaleDB 기반 Candle1m 저장 |
| 집계 | Continuous Aggregates 기반 5m/15m/1h/4h/1D/1W/1M 조회 |
| API | 캔들 조회 REST API, 실시간 WebSocket 브로드캐스트 |
| 안정성 | 배치 저장, retry, DLQ, graceful shutdown 시도 |

## 설계 의사결정

### 1. 애플리케이션은 1분봉만 저장하고, 상위 타임프레임은 DB에 위임

- Node.js에서 5m/15m/1h 집계를 직접 계산하면 중복 집계, race condition, 재처리 문제가 생길 수 있음
- 1분봉 원본만 저장하고, TimescaleDB Continuous Aggregates가 상위 봉을 생성하도록 설계
- 애플리케이션은 Continuous Aggregate View를 조회만 하도록 단순화

### 2. 실시간 저장은 즉시 DB insert가 아니라 버퍼 기반 배치 저장

- tick마다 DB insert를 수행하면 DB 부하가 커짐
- CandleBuffer로 일정 개수/주기 단위로 batch flush
- 실패 시 재시도하고, 반복 실패는 Dead Letter에 기록

### 3. REST와 WebSocket 역할 분리

- 과거 캔들 조회: REST API
- 실시간 가격/tick/candle 갱신: WebSocket
- 프론트엔드는 초기 로딩 시 REST로 과거 캔들을 받고, 이후 WebSocket으로 실시간 갱신

## 현재 한계와 개선 계획

- WebSocket client별 symbol 구독/해제와 통합 테스트를 추가했으며 TwelveData upstream 구독은 정적 설정 유지
- Vitest 기반 REST/WebSocket 핵심 회귀 테스트를 구축
- Prisma Client 재생성과 stale module export 정리로 strict typecheck 통과
- DB reset/setup 스크립트에 production/RDS 차단 guard를 적용하고 [DB Setup](../../find-chart_T/docs/DB_SETUP.md) 절차 문서화
- Dockerfile은 프로덕션 빌드 최적화가 필요
- DB 초기화 스크립트와 Prisma migration/TimescaleDB SQL 정리가 필요
