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
| `symbol` | 조회할 심볼. 예: `AAPL`, `QQQ`, `BTC/USD` |
| `timeframe` | `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`, `1M` |
| `limit` | 선택 query. 기본값 `1000` |
| `from` | 선택 query. epoch seconds 또는 날짜 문자열 |
| `to` | 선택 query. epoch seconds 또는 날짜 문자열 |

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

서버가 클라이언트로 브로드캐스트하는 주요 메시지는 다음과 같습니다.

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

현재 WebSocket은 전체 브로드캐스트 중심입니다. 클라이언트별 심볼 구독/해제 프로토콜은 별도 개선 대상입니다.

## 문서에서 제외한 API

- `/api/auth`: 현재 Chart Server 라우터에 등록되어 있지 않습니다.
- `/api/alerts`: Prisma 모델은 있지만 현재 Chart Server 라우터에 등록되어 있지 않습니다.
