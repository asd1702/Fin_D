# Chart Server 의존성 보안 검사

## 실행 명령

```bash
npm audit
npm audit --omit=dev
npm test
npm run typecheck
npm run build
docker build -t find-chart-server:local .
```

분석용 JSON은 `/tmp`에만 생성했으며 저장소에는 추가하지 않았습니다. `npm audit fix --force`는 사용하지 않았습니다.
GitHub Actions에서도 `npm audit`과 `npm audit --omit=dev`를 실패 조건으로 실행하며, 실제 비밀 값이나 운영 DB 연결은 사용하지 않습니다.

## 검사 요약

초기 검사 결과는 전체 14건, 운영 의존성 설치 기준 10건이었습니다.

| 구분 | 패키지 수 | 처리 |
| --- | ---: | --- |
| 운영 직접 의존성 | 2 | `axios`, `ws`를 호환 가능한 minor 버전으로 업데이트 |
| 운영 전이 의존성 | 4 | Express, Axios, jsonwebtoken 하위 패키지를 lockfile에서 업데이트 |
| Prisma 도구 및 peer 의존성 | 4 | Prisma 6.x patch와 하위 패키지 업데이트 |
| 개발 전이 의존성 | 4 | nodemon, ts-node 하위 패키지 patch 업데이트 |

Prisma CLI는 개발 의존성이지만 `@prisma/client`의 peer 의존성 해석으로 운영 의존성 검사에도 나타났습니다. CLI와 Client 버전을 같은 6.19.3으로 맞췄습니다.

## 업데이트한 의존성

### 직접 의존성

| 패키지 | 변경 전 | 변경 후 | 범위 | 이유 |
| --- | --- | --- | --- | --- |
| `axios` | 1.13.2 | 1.18.1 | 운영 | SSRF, prototype pollution 및 request handling 보안 권고 해결 |
| `ws` | 8.18.3 | 8.21.0 | 운영 | memory disclosure 및 fragmentation DoS 보안 권고 해결 |
| `prisma` | 6.19.0 | 6.19.3 | 개발/peer | Prisma config 하위 의존성 보안 권고 해결 |
| `@prisma/client` | 6.19.0 | 6.19.3 | 운영 | Prisma CLI와 patch 버전 정렬 |

### 전이 의존성

| 의존성 경로 | 주요 업데이트 |
| --- | --- |
| `axios` | `follow-redirects` 1.16.0 |
| `express` | `body-parser` 2.3.0, `path-to-regexp` 8.4.2 |
| `jsonwebtoken` | `jws` 3.2.3 |
| `prisma` | `@prisma/config` 6.19.3, `effect` 3.21.0, `defu` 6.1.7 |
| `nodemon` | `minimatch` 3.1.5, `brace-expansion` 1.1.16, `picomatch` 2.3.2 |
| `ts-node` | `diff` 4.0.4 |

모든 변경은 기존 패키지의 major 버전 범위 안에서 적용했습니다.

## 보류한 취약점

없습니다. 업데이트 후 전체 검사와 운영 의존성 검사 모두 0건입니다. 향후 major 업그레이드는 기능 변경과 별도 검증이 필요한 독립 작업으로 다룹니다.

## 최종 검증

| 항목 | 결과 |
| --- | --- |
| `npm audit` | 취약점 0건 |
| `npm audit --omit=dev` | 취약점 0건 |
| 테스트 | 6개 파일, 63개 통과 |
| 타입 검사 / 빌드 | 통과 |
| 운영 Docker 빌드 | 통과 |

## 위험 관리 결정

- 운영 직접 의존성을 가장 먼저 처리했습니다.
- 실행 이미지는 `npm ci --omit=dev`로 운영 의존성만 설치합니다.
- 개발 의존성은 애플리케이션 실행 경로에 포함하지 않습니다.
- Prisma CLI/Client는 호환성을 위해 같은 patch 버전으로 유지합니다.
- 강제 major 업그레이드와 `npm audit fix --force`는 사용하지 않습니다.
- 검사 결과가 0건이어도 외부 입력 제한, 시간 제한, redirect 정책 같은 애플리케이션 수준 방어는 계속 필요합니다.

## 관련 문서

- [Chart Server README](../README.md)
- [Docker](DOCKER.md)
