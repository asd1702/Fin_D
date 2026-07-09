# Chart Server Docker

## Production Image 구조

`Dockerfile`은 Node.js 22 Alpine 기반 multi-stage build를 사용합니다.

| Stage | 역할 |
| --- | --- |
| `deps` | `npm ci`로 build/test 도구를 포함한 의존성 설치 |
| `build` | placeholder DB URL로 Prisma Client 생성 후 TypeScript를 `dist`로 컴파일 |
| `runtime` | production dependency, Prisma Client, `prisma/`, `dist/`만 포함 |

Runtime은 non-root `node` 사용자로 `node dist/server.js`를 실행합니다. TypeScript source, `ts-node`, 테스트, DB 관리 스크립트는 runtime 실행에 사용하지 않습니다.

## Build

```bash
npm run build
docker build -t find-chart-server:local .
```

Docker build 중 사용하는 `DATABASE_URL`은 Prisma Client 생성용 placeholder이며 실제 DB에 연결하지 않습니다. Runtime secret은 이미지에 포함하지 않습니다.

## Runtime 환경변수

필수 환경변수:

- `DATABASE_URL`
- `TWELVE_DATA_API_KEY`

주요 선택 환경변수:

- `NODE_ENV=production`
- `PORT=8080`
- `STREAM_SYMBOLS`
- `USE_REDIS`
- `REDIS_URL`
- `CORS_ORIGIN`

실제 값은 `docker run`, Compose `env_file`, CI/CD secret store 등 실행 환경에서 주입합니다. 실제 `.env`는 커밋하거나 Docker build context에 포함하지 않습니다.

## Local TimescaleDB 연결 Smoke Test

Host의 local TimescaleDB가 `5433`에서 실행 중인 예시입니다.

```bash
docker run --rm \
  --name find-chart-server-smoke \
  --add-host=host.docker.internal:host-gateway \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e DATABASE_URL="postgresql://find_chart:1234@host.docker.internal:5433/find_chart?schema=market" \
  -e TWELVE_DATA_API_KEY="replace-me" \
  -e STREAM_SYMBOLS="AAPL,MSFT" \
  -e USE_REDIS=false \
  find-chart-server:local
```

```bash
curl http://localhost:8080/
curl http://localhost:8080/health
```

`replace-me`는 HTTP/DB smoke test용 placeholder입니다. TwelveData streaming을 검증하려면 runtime에서 실제 key를 안전하게 주입해야 합니다.

## Compose

App image 실행용 `docker-compose.yml`과 local DB 전용 `docker-compose.db.yml`은 역할을 분리합니다.

```bash
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

App 컨테이너에서 host DB에 연결할 때 `DATABASE_URL`의 host는 `localhost`가 아니라 실행 환경에서 접근 가능한 DB host여야 합니다. Linux Docker에서 host DB를 사용할 경우 `host.docker.internal` 매핑이 필요할 수 있습니다.

## Migration

Runtime image는 애플리케이션 실행 전용입니다. Prisma migration과 TimescaleDB Continuous Aggregate SQL은 배포 전에 별도 host/CI 작업으로 적용합니다.

```bash
npm run migrate:deploy
```

자세한 local DB 및 Continuous Aggregate 절차는 [DB Setup](DB_SETUP.md)을 참고하세요.
