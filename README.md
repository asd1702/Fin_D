# Fin:D

[![Chart Server CI](https://github.com/asd1702/Fin_D/actions/workflows/chart-server-ci.yml/badge.svg)](https://github.com/asd1702/Fin_D/actions/workflows/chart-server-ci.yml)

Fin:D는 금융 뉴스, 기업 정보, 실시간 시장 데이터를 통합해 투자 판단에 필요한 정보를 제공하는 금융 데이터 분석 서비스입니다.

사용자는 대시보드와 기업 상세 화면에서 재무·뉴스·차트 데이터를 확인하고, 팀에서 구현한 AI 질의응답 기능으로 기업과 시장 데이터를 탐색할 수 있습니다.

## 전체 아키텍처

![Fin:D 전체 아키텍처](docs/images/find-architecture.svg)

| 모듈 | 역할 | 주요 기술 | 담당 |
| --- | --- | --- | --- |
| `find-front_T` | 대시보드, 기업 상세, 차트, AI 질의응답 UI | React, TypeScript, Vite | 팀 |
| `find-backend_T` | 인증, 재무·뉴스 데이터 API, AI 질의응답 연동 | FastAPI, SQLAlchemy, MySQL/RDS | 팀 |
| `find-chart_T` | 실시간 가격 수신, 캔들 저장·조회, 실시간 차트 데이터 제공 | Node.js, TypeScript, TimescaleDB | @asd1702 |

## 주요 기능

- 기업 프로필, 재무제표, 주요 지표와 뉴스 조회
- 사용자 즐겨찾기와 일정 관리
- AI 질의응답을 통한 기업·시장 데이터 탐색
- 실시간 가격과 1분봉 OHLCV 캔들 제공
- TimescaleDB Continuous Aggregates 기반 다중 timeframe 조회

## 담당 기여 - Chart Server

- TwelveData WebSocket 기반 실시간 가격 데이터 수신
- tick 데이터를 1분봉 OHLCV candle로 변환하고 buffer로 일괄 저장
- TimescaleDB와 Continuous Aggregates 기반 `1m`~`1M` 조회 구조 구성
- REST Candle API와 WebSocket tick/candle 데이터 제공
- WebSocket을 클라이언트별 종목 구독 구조로 개선하고 heartbeat 정리 로직 추가
- API 입력값 검증, 공통 실패 응답, DB 파괴적 스크립트 안전장치 보강
- Vitest, strict typecheck, 다단계 Docker, 의존성 보안 검사, GitHub Actions CI 구성

자세한 담당 범위와 설계 판단은 [Chart Server Contribution](docs/chart/CONTRIBUTION.md)에 정리했습니다.

## 품질 검증

| 항목 | 결과 |
| --- | --- |
| 자동 테스트 | 6개 파일, 63개 테스트 통과 |
| TypeScript | strict mode 타입 검사 통과 |
| 의존성 보안 검사 | 전체 및 운영 의존성 취약점 0건 |
| 빌드 | TypeScript 및 운영 Docker 이미지 빌드 통과 |
| 로컬 DB | TimescaleDB 상태, Prisma migration, Continuous Aggregates 검증 |
| CI | GitHub Actions Chart Server 워크플로 통과 |

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | React, TypeScript, Vite, React Query, Zustand |
| 백엔드 / Agent API | Python, FastAPI, SQLAlchemy, MySQL/RDS, OpenAI SDK |
| Chart Server | Node.js, TypeScript, Express, ws, Prisma |
| 시계열 DB | PostgreSQL, TimescaleDB, Continuous Aggregates |
| 인프라 / 품질 | Docker, Docker Compose, Vitest, GitHub Actions |

## 실행

각 모듈은 독립적으로 실행됩니다. Chart Server의 로컬 실행과 환경 구성은 [Chart Server README](find-chart_T/README.md)를 참고하세요.

## 문서

| 문서 | 내용 |
| --- | --- |
| [Chart Server Contribution](docs/chart/CONTRIBUTION.md) | 개인 담당 범위, 설계 판단, 개선 과정과 한계 |
| [Chart Server README](find-chart_T/README.md) | 실행, 테스트, Docker, CI |
| [Chart API Documentation](find-chart_T/docs/API_DOCUMENTATION.md) | 실제 등록 REST API와 WebSocket 프로토콜 |
| [DB 설정](find-chart_T/docs/DB_SETUP.md) | 로컬 TimescaleDB, migration, DB 안전장치 |
| [의존성 보안 검사](find-chart_T/docs/DEPENDENCY_AUDIT.md) | 취약점 분류와 업데이트 판단 |
| [Docker](find-chart_T/docs/DOCKER.md) | 다단계 운영 이미지와 스모크 테스트 |
