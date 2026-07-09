# Fin:D Chart API 문서

이 문서는 Chart Server 코드에 실제 등록된 REST API를 기준으로 정리한 문서입니다.

## 기본 정보

- 기본 REST prefix: `/api`
- WebSocket endpoint: `/ws`
- health check: `GET /health`

## Health

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/` | 서버 프로세스 상태 확인 |
| `GET` | `/health` | DB 연결을 포함한 readiness 확인 |

## Candle API

기본 경로: `/api/candles`

### 캔들 데이터 조회

```http
GET /api/candles/:symbol/:timeframe
```

| 항목 | 설명 |
| --- | --- |
| `symbol` | 1~20자의 영문자, 숫자, `.`, `-`, `_`, `/`. 예: `AAPL`, `BRK.B`, `BTC/USD` |
| `timeframe` | `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`, `1M` |
| `limit` | 선택 query. `1~5000` 범위의 정수, 기본값 `1000` |
| `from` | 선택 query. epoch seconds 또는 날짜 문자열 |
| `to` | 선택 query. epoch seconds 또는 날짜 문자열 |

`from`과 `to`를 함께 전달하면 `from <= to`여야 합니다.
`/`가 포함된 symbol은 path segment 충돌을 피하도록 URL encoding해서 전달합니다.

```http
GET /api/candles/BTC%2FUSD/1m
```

서버에서는 이를 `BTC/USD`로 처리합니다. `/api/candles/BTC/USD/1m`처럼 slash를 그대로 보내면 route segment가 분리되어 404 응답이 발생할 수 있습니다.

응답 예시:

```json
{
  "symbol": "BTC/USD",
  "timeframe": "15m",
  "data": [
    {
      "time": 1731400000,
      "open": 100,
      "high": 103,
      "low": 99,
      "close": 101,
      "volume": 9999
    }
  ]
}
```

## Aggregate API

기본 경로: `/api/aggregate`

### Continuous Aggregate 수동 새로고침

```http
POST /api/aggregate/refresh
```

1분봉 데이터를 백필한 뒤 TimescaleDB Continuous Aggregate View에 즉시 반영하고 싶을 때 사용합니다.
`timeframe`은 `5m`, `15m`, `1h`, `4h`, `1D`, `1W`, `1M` 중 하나여야 하며, `from <= to`여야 합니다.

요청 예시:

```json
{
  "timeframe": "5m",
  "from": 1638316800,
  "to": 1638403200
}
```

응답 예시:

```json
{
  "success": true,
  "timeframe": "5m",
  "message": "Continuous Aggregate 뷰가 새로고침되었습니다."
}
```

### Validation 오류

Chart Server의 실패 응답은 HTTP 상태와 함께 다음 공통 형식으로 전달됩니다.

```json
{
  "success": false,
  "errorCode": "INVALID_TIMEFRAME",
  "message": "Unsupported timeframe."
}
```

## Analysis API

기본 경로: `/api/analysis`

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/analysis/indicators/batch?symbols=QQQ,SPY,DIA` | 여러 심볼의 지표 요약 조회 |
| `GET` | `/api/analysis/feargreed?days=7` | Fear & Greed 데이터 조회 |
| `GET` | `/api/analysis/feargreed/stock` | CNN 주식 시장 Fear & Greed 조회 |
| `GET` | `/api/analysis/:symbol/performance` | 심볼 성과 조회 |
| `GET` | `/api/analysis/:symbol/seasonal` | 심볼 계절성 조회 |
| `GET` | `/api/analysis/:symbol/indicators` | 심볼 지표 요약 조회 |
| `GET` | `/api/analysis/:symbol/:timeframe/rsi` | RSI 조회 |
| `GET` | `/api/analysis/:symbol/:timeframe/macd` | MACD 조회 |
| `GET` | `/api/analysis/:symbol/:timeframe/bollinger` | Bollinger Bands 조회 |
| `GET` | `/api/analysis/:symbol/:timeframe/sma` | SMA 조회 |
| `GET` | `/api/analysis/:symbol/:timeframe/ema` | EMA 조회 |

## Summary API

기본 경로: `/api/summary`

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/summary/status` | 데이터 상태 확인 |
| `GET` | `/api/summary?symbols=QQQ,SPY` | 여러 심볼 요약 조회 |
| `GET` | `/api/summary/:symbol` | 단일 심볼 요약 조회 |

## Quote API

기본 경로: `/api/quotes`

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/quotes/summary` | 전체 시세 요약 |
| `GET` | `/api/quotes/ticker` | 티커 바 데이터 |
| `GET` | `/api/quotes/category/:category` | 카테고리별 시세 |
| `GET` | `/api/quotes/:symbol` | 개별 심볼 최신 시세 |

## User API

기본 경로: `/api/users`

Chart Server 코드에는 사용자 CRUD 라우트가 등록되어 있습니다. 차트 서버의 핵심 기능은 아니므로 연동 시 필요한 경우에만 사용합니다.

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/users/:id` | 사용자 조회 |
| `POST` | `/api/users` | 사용자 생성 |
| `PATCH` | `/api/users/:id` | 사용자 수정 |
| `DELETE` | `/api/users/:id` | 사용자 삭제 |

## WebSocket

```text
ws://<host>:<port>/ws
```

연결 직후 기본 구독은 없으며 서버가 다음 메시지를 전송합니다.

```json
{
  "type": "welcome",
  "message": "Connected to Chart WebSocket.",
  "subscriptionRequired": true
}
```

클라이언트는 symbol을 명시적으로 구독하거나 해제해야 합니다.

```json
{ "type": "subscribe", "symbols": ["AAPL", "BTC/USD"] }
```

```json
{ "type": "unsubscribe", "symbols": ["AAPL"] }
```

서버는 각각 `subscribed`, `unsubscribed` 메시지로 처리된 symbol을 응답합니다. 구독하지 않은 symbol의 `tick`과 `candle`은 전송하지 않습니다.

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

잘못된 메시지는 연결을 유지한 채 오류로 응답합니다.

```json
{
  "type": "error",
  "errorCode": "INVALID_WS_MESSAGE",
  "message": "Invalid WebSocket message."
}
```

`BTC/USD`는 WebSocket JSON에서는 그대로 사용합니다. URL encoding한 `BTC%2FUSD`가 필요한 곳은 REST path parameter뿐입니다. 현재 filtering은 Chart Server client별 구독에 적용되며 TwelveData upstream symbol 구독은 정적 설정을 유지합니다.

## 문서에서 제외한 API

- `/api/auth`: 현재 Chart Server 라우터에 등록되어 있지 않습니다.
- `/api/alerts`: Prisma 모델은 있지만 현재 Chart Server 라우터에 등록되어 있지 않습니다.
