# Chart Server DB 설정

## 구성과 책임

Chart Server는 PostgreSQL과 TimescaleDB를 사용합니다.

| 구성 | 역할 |
| --- | --- |
| `prisma/schema.prisma` | 애플리케이션 모델과 Prisma Client 타입의 기준 |
| `prisma/migrations/` | 일반 테이블, 인덱스, TimescaleDB extension 및 hypertable 이력 |
| `prisma/migrations/continuous_aggregates.sql` | TimescaleDB Continuous Aggregate view와 refresh policy 관리 |

Prisma migration은 애플리케이션이 사용하는 일반 DB 객체의 변경 이력을 관리합니다. Continuous Aggregate SQL은 Prisma schema로 표현하기 어려운 TimescaleDB 전용 view와 policy를 관리합니다.
로컬 DB Compose는 이 문서에서 다루며 운영 애플리케이션 이미지의 빌드·실행 절차는 [Docker](DOCKER.md)를 참고하세요.

## 로컬 개발 DB 설정

이 Compose 환경은 로컬 개발 전용입니다. 기본 비밀번호 `1234`를 운영 또는 공유 DB에서 사용하지 않습니다.

```bash
npm install
npm run db:up
npm run db:ps
cp .env.example .env
```

`.env.example`의 로컬 연결 예시는 다음과 같습니다.

```dotenv
DATABASE_URL=postgresql://find_chart:1234@localhost:5432/find_chart?schema=market
```

`market` schema는 Prisma migration과 Continuous Aggregate SQL이 사용하는 실제 schema입니다. 실제 `.env`와 비밀 값은 커밋하지 않습니다.
호스트의 `5432`가 이미 사용 중이면 `POSTGRES_PORT`와 `DATABASE_URL`의 포트를 같은 값(예: `5433`)으로 변경합니다.

TimescaleDB 상태 검사가 healthy 상태가 되면 Prisma Client와 migration을 적용합니다.

```bash
npm run prisma:generate
npm run migrate:deploy
```

migration 적용 후 컨테이너의 `psql`로 Continuous Aggregate를 구성합니다.

```bash
docker exec -i find-chart-timescaledb \
  psql -U find_chart -d find_chart \
  < prisma/migrations/continuous_aggregates.sql
```

이 SQL은 기존 Continuous Aggregate materialized view를 drop 후 다시 생성하고 전체 refresh를 수행합니다. 운영 또는 공유 DB에서는 백업, 영향 범위, 실행 시간을 검토한 승인된 변경 작업으로만 실행해야 합니다.

### 로컬 검증

포트 충돌을 피하기 위해 호스트 `5433`을 사용한 로컬 검증 결과입니다.

- TimescaleDB 상태 검사: 정상
- Prisma migration 7개 적용 성공
- Continuous Aggregate 7개 생성 및 refresh policy 확인
- 적용 대기 중인 migration 없음

## 로컬 DB 상태와 종료

```bash
npm run db:ps
npm run db:logs
npm run db:down
```

`db:down`은 컨테이너와 네트워크를 내리지만 named volume의 데이터는 유지합니다. 로컬 데이터까지 완전히 삭제하려면 다음 명령을 직접 실행해야 합니다.

```bash
docker compose -f docker-compose.db.yml down -v
```

이 명령은 로컬 TimescaleDB volume과 데이터를 삭제하는 파괴적 작업입니다. 운영 또는 공유 DB 용도로 사용하지 않습니다.

## 초기 데이터, 백필, 재수집

다음 명령은 schema를 삭제하지 않지만 DB 데이터를 작성하고 외부 API를 호출합니다.

```bash
npm run seed
npm run seed:symbol -- AAPL
npm run fill-gaps -- --symbol AAPL
npm run refetch -- --symbol AAPL --from 2025-11-26 --to 2025-11-27
```

`refetch`는 지정한 symbol과 기간의 기존 캔들을 삭제한 뒤 재수집합니다. 실행 전에 `--dry-run`으로 범위를 확인할 수 있습니다.

백필 후 특정 Continuous Aggregate를 즉시 새로고침할 수 있습니다.

```bash
curl -X POST http://localhost:8080/api/aggregate/refresh \
  -H "Content-Type: application/json" \
  -d '{"timeframe":"5m"}'
```

## 파괴적 스크립트

다음 명령은 로컬 개발 DB 전용입니다.

```bash
CONFIRM_DB_RESET=YES npm run db:reset:dev
CONFIRM_DB_RESET=YES npm run db:setup:dev
```

- `db:reset:dev`는 Alert, User, Candle1m 데이터를 전체 삭제합니다.
- `db:setup:dev`는 `market` schema와 Prisma migration metadata를 삭제하고 DB 객체를 직접 다시 만듭니다.
- `db:setup:dev`는 Prisma migration을 우회하는 기존 복구 도구입니다. 일반 초기화에는 사용하지 않습니다.
- `NODE_ENV=production`에서는 실행할 수 없습니다.
- `CONFIRM_DB_RESET=YES`가 없으면 실행할 수 없습니다.
- RDS, AWS 또는 production으로 의심되는 `DATABASE_URL`에서는 실행할 수 없습니다.
- 운영, 공유, RDS DB에서는 실행하지 않습니다.
- 안전장치는 DB URL 전체를 로그나 오류 메시지에 출력하지 않습니다.

기존 `npm run reset`도 같은 안전장치를 거치지만, 명확한 용도의 `db:reset:dev` 사용을 권장합니다. 우회 플래그는 제공하지 않습니다.

## 운영 전 체크리스트

- `DATABASE_URL`이 의도한 대상 DB를 가리키는지 별도로 확인
- `npm run prisma:generate` 완료
- `npm run migrate:deploy` 완료
- TimescaleDB extension과 hypertable 적용 여부 확인
- Continuous Aggregate view와 policy 적용 여부 확인
- `npm test` 통과
- `npm run typecheck` 통과
- 파괴적 스크립트를 배포 및 운영 절차에서 실행하지 않음

## 관련 문서

- [Chart Server README](../README.md)
- [Docker](DOCKER.md)
- [의존성 보안 검사](DEPENDENCY_AUDIT.md)
