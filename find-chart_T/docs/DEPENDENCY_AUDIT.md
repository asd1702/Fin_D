# Chart Server Dependency Audit

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
GitHub Actions에서도 `npm audit`과 `npm audit --omit=dev`를 실패 조건으로 실행하며, 실제 secret이나 운영 DB 연결은 사용하지 않습니다.

## Audit Summary

초기 audit은 전체 14건, production install 기준 10건이었습니다.

| 구분 | Package 수 | 처리 |
| --- | ---: | --- |
| Production direct | 2 | `axios`, `ws`를 호환 가능한 minor 버전으로 업데이트 |
| Production transitive | 4 | Express, Axios, jsonwebtoken 하위 package를 lockfile에서 업데이트 |
| Prisma tooling/peer chain | 4 | Prisma 6.x patch와 하위 package 업데이트 |
| Dev transitive | 4 | nodemon, ts-node 하위 package patch 업데이트 |

Prisma CLI는 devDependency지만 `@prisma/client`의 peer resolution으로 production audit에도 나타났습니다. CLI와 Client 버전을 같은 6.19.3으로 맞췄습니다.

## Updated Dependencies

### Direct

| Package | Before | After | Scope | Reason |
| --- | --- | --- | --- | --- |
| `axios` | 1.13.2 | 1.18.1 | production | SSRF, prototype pollution 및 request handling advisory 해결 |
| `ws` | 8.18.3 | 8.21.0 | production | memory disclosure 및 fragmentation DoS advisory 해결 |
| `prisma` | 6.19.0 | 6.19.3 | dev/peer | Prisma config 하위 dependency advisory 해결 |
| `@prisma/client` | 6.19.0 | 6.19.3 | production | Prisma CLI와 patch version 정렬 |

### Transitive

| Dependency path | 주요 업데이트 |
| --- | --- |
| `axios` | `follow-redirects` 1.16.0 |
| `express` | `body-parser` 2.3.0, `path-to-regexp` 8.4.2 |
| `jsonwebtoken` | `jws` 3.2.3 |
| `prisma` | `@prisma/config` 6.19.3, `effect` 3.21.0, `defu` 6.1.7 |
| `nodemon` | `minimatch` 3.1.5, `brace-expansion` 1.1.16, `picomatch` 2.3.2 |
| `ts-node` | `diff` 4.0.4 |

모든 변경은 기존 package major 범위 안에서 적용했습니다.

## Deferred Vulnerabilities

없습니다. 업데이트 후 전체 audit과 production-only audit 모두 0건입니다. 향후 major upgrade는 기능 변경과 별도 검증이 필요한 독립 작업으로 다룹니다.

## Final Verification

| 항목 | 결과 |
| --- | --- |
| `npm audit` | 0 vulnerabilities |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Tests | 6 files, 63 passed |
| Typecheck / build | passed |
| Production Docker build | passed |

## Risk Decision

- Production direct dependency를 가장 먼저 처리했습니다.
- Runtime image는 `npm ci --omit=dev`로 production dependency만 설치합니다.
- Dev dependency는 runtime application 실행 경로에 포함하지 않습니다.
- Prisma CLI/Client는 호환성을 위해 같은 patch version으로 유지합니다.
- 강제 major upgrade와 `npm audit fix --force`는 사용하지 않습니다.
- Audit 결과가 0건이어도 외부 입력 제한, timeout, redirect 정책 같은 애플리케이션 수준 방어는 계속 필요합니다.

## Related Documents

- [Chart Server README](../README.md)
- [Docker](DOCKER.md)
