# Chart Server Docker

## 운영 이미지 구조

`Dockerfile`은 Node.js 22 Alpine 기반 다단계 빌드를 사용합니다.

| 단계 | 역할 |
| --- | --- |
| `deps` | `npm ci`로 빌드·테스트 도구를 포함한 의존성 설치 |
| `build` | 대체 DB URL로 Prisma Client 생성 후 TypeScript를 `dist`로 컴파일 |
| `runtime` | 운영 의존성, Prisma Client, `prisma/`, `dist/`만 포함 |

실행 이미지는 비루트 `node` 사용자로 `node dist/server.js`를 실행합니다. TypeScript 소스, `ts-node`, 테스트, DB 관리 스크립트는 실행에 사용하지 않습니다.

## 빌드

```bash
npm run build
docker build -t find-chart-server:local .
```

Docker 빌드 중 사용하는 `DATABASE_URL`은 Prisma Client 생성용 대체 값이며 실제 DB에 연결하지 않습니다. 실행 환경의 비밀 값은 이미지에 포함하지 않습니다.

## 실행 환경 변수

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

실제 값은 `docker run`, Compose `env_file`, CI/CD 비밀 값 저장소 등 실행 환경에서 주입합니다. 실제 `.env`는 커밋하거나 Docker 빌드 컨텍스트에 포함하지 않습니다.

## 로컬 TimescaleDB 연결 스모크 테스트

호스트의 로컬 TimescaleDB가 `5433`에서 실행 중인 예시입니다.

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

`replace-me`는 HTTP/DB 스모크 테스트용 대체 값입니다. TwelveData 스트리밍을 검증하려면 실행 환경에서 실제 키를 안전하게 주입해야 합니다.

## Compose 실행

애플리케이션 이미지 실행용 `docker-compose.yml`과 로컬 DB 전용 `docker-compose.db.yml`은 역할을 분리합니다.

```bash
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

애플리케이션 컨테이너에서 호스트 DB에 연결할 때 `DATABASE_URL`의 호스트는 `localhost`가 아니라 실행 환경에서 접근 가능한 DB 호스트여야 합니다. Linux Docker에서 호스트 DB를 사용할 경우 `host.docker.internal` 매핑이 필요할 수 있습니다.

## Migration 적용

실행 이미지는 애플리케이션 실행 전용입니다. Prisma migration과 TimescaleDB Continuous Aggregate SQL은 배포 전에 별도 호스트 또는 CI 작업으로 적용합니다.

```bash
npm run migrate:deploy
```

자세한 로컬 DB 및 Continuous Aggregate 절차는 [DB 설정](DB_SETUP.md)을 참고하세요.

GitHub Actions는 실제 비밀 값이나 DB 연결 없이 동일한 운영 이미지 빌드를 검증합니다. 실행 환경의 `/` 및 `/health` 스모크 테스트는 로컬 TimescaleDB 환경에서 별도로 통과했습니다.

## 관련 문서

- [Chart Server README](../README.md)
- [DB 설정](DB_SETUP.md)
- [의존성 보안 검사](DEPENDENCY_AUDIT.md)
