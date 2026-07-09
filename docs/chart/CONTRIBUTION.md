# Chart Server Contribution

## Role

제가 담당한 영역은 `find-chart_T` Chart Server입니다.

Chart Server는 TwelveData에서 실시간 가격을 수신해 1분봉 candle로 저장하고, 과거 데이터는 REST API로, 실시간 tick/candle은 WebSocket으로 프론트엔드 차트에 제공합니다. Frontend, Backend API, AI Agent 영역은 팀원이 담당했습니다.

## Why This Server Was Needed

- 차트 화면에는 실시간 가격과 여러 timeframe의 candle 데이터가 필요했습니다.
- 외부 API를 화면 요청마다 직접 호출하면 응답 시간, 호출 비용, 외부 장애 의존성이 커질 수 있었습니다.
- 1분봉을 원천 데이터로 저장하고 상위 timeframe은 일관된 집계 결과로 제공할 구조가 필요했습니다.

## Main Contributions

### 1. Real-time Price Ingestion

- TwelveData WebSocket 연결, reconnect, 수신 heartbeat 감지 구현
- symbol별 tick 처리와 프론트엔드 실시간 전달
- `STREAM_SYMBOLS` 기반 upstream 구독 구성

### 2. Candle Generation and Buffering

- `CandleMaker`로 같은 minute의 open/high/low/close/volume 갱신
- 다음 minute tick 수신 시 완성된 1분봉 반환
- `CandleBuffer`로 batch flush, retry, Dead Letter 처리
- graceful shutdown 시 남은 buffer flush와 timer/listener cleanup 보강

### 3. TimescaleDB Storage and Aggregation

- Prisma 기반 `Candle1m` 원천 데이터 저장
- TimescaleDB Continuous Aggregates에 상위 timeframe 집계 위임
- `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`, `1M` 조회 지원
- Local TimescaleDB Compose, Prisma migration, Continuous Aggregate 적용 절차 검증

### 4. REST and WebSocket API

- `GET /api/candles/:symbol/:timeframe` 조회 API 제공
- symbol, timeframe, limit, from/to validation 및 공통 실패 응답 적용
- slash symbol 정책 정리: REST path는 `BTC%2FUSD`, WebSocket JSON은 `BTC/USD`
- WebSocket을 전체 broadcast에서 client별 `subscribe`/`unsubscribe` 구조로 개선
- 구독 symbol 기반 tick/candle filtering과 ping/pong dead client cleanup 추가

### 5. Reliability and Delivery

- CandleMaker, timeframe, CandleBuffer, REST/WebSocket 테스트 구축
- strict TypeScript typecheck 오류 정리
- DB reset/setup 스크립트에 production, confirmation, suspicious URL guard 적용
- multi-stage production image와 non-root `node dist/server.js` runtime 구성
- dependency 취약점 분류 후 major 변경 없이 전체/production audit 0건 확인
- GitHub Actions에서 install, audit, test, typecheck, build, Docker build 자동 검증

## Design Decisions

### Store 1-minute Source Data, Aggregate in TimescaleDB

애플리케이션에서 모든 timeframe을 직접 계산하면 중복 집계와 재처리 기준이 복잡해집니다. Chart Server는 1분봉을 저장하고 상위 candle은 Continuous Aggregates로 조회하도록 역할을 나눴습니다.

### Buffer Writes Instead of Inserting Every Tick

tick마다 DB insert를 실행하는 대신 완성된 candle을 buffer에 모아 batch 저장합니다. 실패 데이터는 제한된 retry 후 Dead Letter에 기록하도록 구성했습니다.

### Separate Historical and Real-time Delivery

초기 과거 candle은 REST로 조회하고, 이후 변경은 WebSocket으로 전달합니다. WebSocket client는 연결 후 필요한 symbol을 명시적으로 구독합니다.

## Verification

| 항목 | 결과 |
| --- | --- |
| Tests | 6 files, 63 passed |
| Typecheck | strict mode passed |
| TypeScript build | passed |
| npm audit | 전체/production 0 vulnerabilities |
| Docker build | multi-stage image build passed |
| Runtime smoke test | `GET /`, `GET /health` passed |
| Local TimescaleDB | healthy, 7 migrations and 7 Continuous Aggregates verified |
| GitHub Actions CI | passed |

## What I Improved During Portfolio Cleanup

초기 Chart Server는 주요 기능 구현에 집중된 상태였습니다. 포트폴리오 정리 과정에서 테스트 안전망을 먼저 만들고, API validation과 WebSocket 구독 구조를 보강했습니다. 이후 typecheck, DB 실행 안전장치, 재현 가능한 local DB, production Docker build, dependency audit, CI 순서로 검증 경로를 정리했습니다.

## Current Limitations

- TwelveData upstream symbol subscription은 `STREAM_SYMBOLS` 정적 설정 기반입니다.
- 장시간 운영을 위한 metrics, tracing, alerting은 별도 보강이 필요합니다.
- Memory Pub/Sub은 단일 instance에 적합하며 Redis 기반 multi-instance 동작은 운영 환경 검증이 필요합니다.

## Related Documents

- [Chart Server README](../../find-chart_T/README.md)
- [API Documentation](../../find-chart_T/docs/API_DOCUMENTATION.md)
- [DB Setup](../../find-chart_T/docs/DB_SETUP.md)
- [Dependency Audit](../../find-chart_T/docs/DEPENDENCY_AUDIT.md)
- [Docker](../../find-chart_T/docs/DOCKER.md)
