# Fin:D Chart Server

실시간 시장 가격 데이터를 수신해 캔들 데이터로 저장하고, 프론트엔드 차트에 REST/WebSocket으로 제공하는 서버입니다.

## 역할

- TwelveData WebSocket 가격 수신
- 1분봉 OHLCV 생성
- TimescaleDB 저장
- Continuous Aggregates 기반 상위 타임프레임 조회
- REST API 캔들 조회
- WebSocket 실시간 tick/candle 브로드캐스트

## Architecture

```mermaid
flowchart TB
    td["TwelveData WebSocket"] --> provider["TwelveData Provider"]
    provider --> maker["CandleMaker<br/>tick -> 1m OHLCV"]
    maker --> buffer["CandleBuffer<br/>batch flush / retry / DLQ"]
    buffer --> db[("TimescaleDB<br/>Candle1m")]
    db --> ca["Continuous Aggregates<br/>5m / 15m / 1h / 4h / 1D / 1W / 1M"]
    api["Express REST API"] --> db
    api --> ca
    provider --> ws["WebSocket /ws<br/>symbol subscription"]
    maker --> ws
    ws --> front["Frontend Chart"]
    api --> front
```

## Tech Stack

| 구분 | 기술 |
| --- | --- |
| Runtime | Node.js, TypeScript |
| Server | Express, ws |
| Database | PostgreSQL, TimescaleDB, Prisma |
| Data Source | TwelveData WebSocket/API |
| Infra | Docker, docker-compose |
| Utility | axios, envalid, winston, node-cron |

## Getting Started

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run migrate:deploy
npm run dev
```

TimescaleDB Continuous Aggregates는 `prisma/migrations/continuous_aggregates.sql`에 정리되어 있습니다. 백필이나 초기 데이터 적재 후에는 필요에 따라 해당 SQL 또는 `POST /api/aggregate/refresh`를 사용해 집계 뷰를 갱신합니다.

### Test

```bash
npm test
npm run typecheck
```

Vitest 회귀 테스트와 strict TypeScript typecheck를 모두 통과합니다.

## Environment Variables

| 변수 | 설명 |
| --- | --- |
| `NODE_ENV` | `development`, `production`, `test` |
| `PORT` | HTTP/WebSocket 서버 포트, 기본값 `8080` |
| `DATABASE_URL` | PostgreSQL/TimescaleDB 연결 URL |
| `TWELVE_DATA_API_KEY` | TwelveData API Key |
| `USE_REDIS` | Redis Pub/Sub 사용 여부, 기본값 `false` |
| `REDIS_URL` | Redis 연결 URL |
| `STREAM_SYMBOLS` | TwelveData WebSocket 구독 심볼 목록 |
| `CORS_ORIGIN` | 허용할 Origin 목록 |

## API

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/` | 서버 기본 상태 확인 |
| `GET` | `/health` | DB 연결을 포함한 readiness 확인 |
| `GET` | `/api/candles/:symbol/:timeframe` | 캔들 조회. `limit`, `from`, `to` query 지원 |
| `POST` | `/api/aggregate/refresh` | TimescaleDB Continuous Aggregate 수동 갱신 |
| `GET` | `/api/analysis/...` | 기술적 지표, 성과, 계절성, Fear & Greed 조회 |
| `GET` | `/api/summary` | 여러 심볼 요약 조회 |
| `GET` | `/api/summary/:symbol` | 단일 심볼 요약 조회 |
| `GET` | `/api/quotes/...` | 최신 시세, 티커, 카테고리별 시세 조회 |
| `GET/POST/PATCH/DELETE` | `/api/users` | 사용자 데이터 CRUD |

지원 타임프레임은 `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`, `1M`입니다.
캔들 조회의 `limit`은 `1~5000` 범위의 정수이며 기본값은 `1000`입니다. 잘못된 symbol, timeframe, limit, time range는 `errorCode`를 포함한 HTTP 400 응답을 반환합니다. Aggregate refresh는 `1m`을 제외한 지원 타임프레임만 허용합니다.
`BTC/USD`처럼 `/`를 포함한 symbol은 path에서 `BTC%2FUSD`로 URL encoding해야 합니다. 모든 실패 응답은 `{ success, errorCode, message }` 형식을 사용합니다.

## WebSocket

- endpoint: `/ws`
- 연결 직후 기본 구독은 없으며 `welcome` 메시지를 수신합니다.
- 클라이언트는 `subscribe`/`unsubscribe`로 symbol별 수신 범위를 관리합니다.
- server message type: `welcome`, `subscribed`, `unsubscribed`, `tick`, `candle`, `error`
- `tick`: TwelveData 실시간 가격 수신 시 브로드캐스트
- `candle`: 1분봉 완성 시 브로드캐스트
- 구독하지 않은 symbol의 `tick`/`candle`은 수신하지 않습니다.
- `BTC/USD`는 WebSocket JSON에서 URL encoding 없이 그대로 사용합니다.

```json
{ "type": "subscribe", "symbols": ["AAPL", "BTC/USD"] }
```

```json
{ "type": "unsubscribe", "symbols": ["AAPL"] }
```

예시:

```json
{ "type": "tick", "symbol": "BTC/USD", "price": 100.12, "timestamp": 1731400000 }
```

```json
{
  "type": "candle",
  "timeframe": "1m",
  "candle": {
    "symbol": "BTC/USD",
    "startTime": 1731400000,
    "open": 100,
    "high": 101,
    "low": 99,
    "close": 100.5,
    "volume": 0
  }
}
```

## 서버 구조

| 경로 | 역할 |
| --- | --- |
| `src/server.ts` | HTTP 서버 생성, WebSocket 초기화, TwelveData 연결, 스케줄러 시작 |
| `src/app.ts` | Express 앱, middleware, health check, `/api` 라우팅 |
| `src/modules/realtime/` | TwelveData provider, WebSocket broadcast, Pub/Sub |
| `src/modules/candle/` | CandleMaker, CandleBuffer, 캔들 조회/집계 API |
| `src/modules/analysis/` | 기술적 지표 및 시장 지표 API |
| `src/modules/summary/` | 심볼 요약 API |
| `src/modules/quote/` | 최신 시세 API |
| `prisma/schema.prisma` | `Candle1m`, `DeadLetter`, `User`, `Alert` 모델 |
| `prisma/migrations/continuous_aggregates.sql` | TimescaleDB Continuous Aggregates 정의 |

## Current Limitations

- CandleMaker, timeframe 유틸, CandleBuffer, 핵심 API의 테스트 기반을 구축했습니다.
- WebSocket filtering은 client-side 구독 기준이며 TwelveData upstream 구독은 정적입니다.
- Dockerfile은 프로덕션 빌드 최적화가 필요합니다.
- DB migration과 TimescaleDB 초기화 SQL 정리가 필요합니다.
