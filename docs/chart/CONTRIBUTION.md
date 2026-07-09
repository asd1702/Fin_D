# Chart Server 담당 기여

## 담당 역할

담당한 영역은 `find-chart_T` Chart Server입니다.

Chart Server는 TwelveData에서 실시간 가격을 수신해 1분봉 캔들로 저장하고, 과거 데이터는 REST API로, 실시간 틱과 캔들은 WebSocket으로 프론트엔드 차트에 제공합니다.

## Chart Server가 필요했던 이유

- 차트 화면에는 실시간 가격과 여러 시간 단위의 캔들 데이터가 필요했습니다.
- 외부 API를 화면 요청마다 직접 호출하면 응답 시간, 호출 비용, 외부 장애 의존성이 커질 수 있었습니다.
- 1분봉을 원천 데이터로 저장하고 상위 시간 단위는 일관된 집계 결과로 제공할 구조가 필요했습니다.

## 주요 기여

### 1. 실시간 가격 수집

- TwelveData WebSocket 연결, 재연결, 수신 heartbeat 감지 구현
- 종목별 틱 처리와 프론트엔드 실시간 전달
- `STREAM_SYMBOLS` 기반 상류 데이터 구독 구성

### 2. 캔들 생성과 버퍼링

- `CandleMaker`로 같은 분의 시가·고가·저가·종가·거래량 갱신
- 다음 분의 틱 수신 시 완성된 1분봉 반환
- `CandleBuffer`로 일괄 저장, 재시도, Dead Letter 처리
- 정상 종료 시 남은 버퍼 저장과 타이머·리스너 정리 보강

### 3. TimescaleDB 저장과 집계

- Prisma 기반 `Candle1m` 원천 데이터 저장
- TimescaleDB Continuous Aggregates에 상위 시간 단위 집계 위임
- `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`, `1M` 조회 지원
- 로컬 TimescaleDB Compose, Prisma migration, Continuous Aggregate 적용 절차 검증

### 4. REST 및 WebSocket API

- `GET /api/candles/:symbol/:timeframe` 조회 API 제공
- 종목, 시간 단위, 조회 개수, 시작·종료 시각 검증 및 공통 실패 응답 적용
- 슬래시 종목 정책 정리: REST 경로는 `BTC%2FUSD`, WebSocket JSON은 `BTC/USD`
- WebSocket을 전체 전송 방식에서 클라이언트별 `subscribe`/`unsubscribe` 구조로 개선
- 구독 종목 기반 틱·캔들 필터링과 ping/pong 비정상 클라이언트 정리 추가

### 5. 안정성과 배포

- CandleMaker, timeframe, CandleBuffer, REST/WebSocket 테스트 구축
- TypeScript strict mode 타입 검사 오류 정리
- DB 초기화·설정 스크립트에 운영 환경, 사용자 확인, 의심스러운 URL 방지 로직 적용
- 다단계 운영 이미지와 비루트 사용자 기반 `node dist/server.js` 실행 환경 구성
- 의존성 취약점 분류 후 major 변경 없이 전체 및 운영 의존성 취약점 0건 확인
- GitHub Actions에서 설치, 보안 검사, 테스트, 타입 검사, 빌드, Docker 이미지 빌드 자동 검증

## 주요 설계 결정

### 1분봉 원천 데이터 저장과 TimescaleDB 집계

애플리케이션에서 모든 시간 단위를 직접 계산하면 중복 집계와 재처리 기준이 복잡해집니다. Chart Server는 1분봉을 저장하고 상위 캔들은 Continuous Aggregates로 조회하도록 역할을 나눴습니다.

### 개별 틱 저장 대신 버퍼 기반 일괄 저장

틱마다 DB 저장을 실행하는 대신 완성된 캔들을 버퍼에 모아 일괄 저장합니다. 실패 데이터는 제한된 재시도 후 Dead Letter에 기록하도록 구성했습니다.

### 과거 데이터와 실시간 데이터 전달 분리

초기 과거 캔들은 REST로 조회하고, 이후 변경은 WebSocket으로 전달합니다. WebSocket 클라이언트는 연결 후 필요한 종목을 명시적으로 구독합니다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| 테스트 | 6개 파일, 63개 테스트 통과 |
| 타입 검사 | strict mode 통과 |
| TypeScript 빌드 | 통과 |
| npm 보안 검사 | 전체 및 운영 의존성 취약점 0건 |
| Docker 빌드 | 다단계 이미지 빌드 통과 |
| 실행 환경 스모크 테스트 | `GET /`, `GET /health` 통과 |
| 로컬 TimescaleDB | 정상 상태, migration 7개 및 Continuous Aggregate 7개 검증 |
| GitHub Actions CI | 통과 |

## 포트폴리오 정리 과정에서 개선한 내용

초기 Chart Server는 주요 기능 구현에 집중된 상태였습니다. 포트폴리오 정리 과정에서 테스트 안전망을 먼저 만들고, API 입력값 검증과 WebSocket 구독 구조를 보강했습니다. 이후 타입 검사, DB 실행 안전장치, 재현 가능한 로컬 DB, 운영 Docker 빌드, 의존성 보안 검사, CI 순서로 검증 경로를 정리했습니다.

## 현재 한계

- TwelveData 상류 종목 구독은 `STREAM_SYMBOLS` 정적 설정 기반입니다.
- 장시간 운영을 위한 메트릭, 추적, 알림 기능은 별도 보강이 필요합니다.
- 메모리 기반 Pub/Sub은 단일 인스턴스에 적합하며 Redis 기반 다중 인스턴스 동작은 운영 환경 검증이 필요합니다.

## 관련 문서

- [Chart Server README](../../find-chart_T/README.md)
- [API 문서](../../find-chart_T/docs/API_DOCUMENTATION.md)
- [DB 설정](../../find-chart_T/docs/DB_SETUP.md)
- [의존성 보안 검사](../../find-chart_T/docs/DEPENDENCY_AUDIT.md)
- [Docker 문서](../../find-chart_T/docs/DOCKER.md)
