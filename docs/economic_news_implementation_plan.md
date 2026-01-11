# Implementation Plan - 대시보드 주요 경제 뉴스 섹션

## 개요
대시보드 하단에 "주요 경제 뉴스" 섹션을 추가하여 한글로 번역된 경제/국제 뉴스를 표시합니다. 기존 `NewsSection` 컴포넌트 패턴을 최대한 재활용합니다.

---

## Proposed Changes

### [백엔드] 뉴스 라우터/서비스 확장

#### [MODIFY] [news.py](file:///home/asd1702/FinD_Main/find-backend_T/app/routers/news.py)
- 새 엔드포인트 추가: `GET /api/v1/news/general`
- FMP `/stable/news/general-latest` API 호출하여 일반 뉴스 조회
- 인증 불필요 (공개 데이터)
- 응답: `List[schemas.GeneralNewsItem]`

#### [MODIFY] [news_service.py](file:///home/asd1702/FinD_Main/find-backend_T/app/services/news_service.py)
- 새 함수 추가: `fetch_general_news()`
- FMP API 호출 및 캐싱 로직 구현

#### [MODIFY] [schemas.py](file:///home/asd1702/FinD_Main/find-backend_T/app/schemas.py)
- 새 스키마 추가: `GeneralNewsItem` (title, summary, url, publishedDate, source)

---

### [프론트엔드] 경제 뉴스 컴포넌트 생성

#### [MODIFY] [newsApi.ts](file:///home/asd1702/FinD_Main/find-front_T/src/services/api/newsApi.ts)
- 새 함수 추가: `getGeneralNews(limit?: number)`
- 엔드포인트: `/news/general`

#### [NEW] [EconomicNewsSection.tsx](file:///home/asd1702/FinD_Main/find-front_T/src/components/dashboard/EconomicNewsSection.tsx)
- `NewsSection.tsx` 기반으로 생성
- API 호출을 `newsApi.getGeneralNews()`로 변경
- 타이틀: "주요 경제 뉴스"
- 로고 대신 뉴스 소스 아이콘/텍스트 표시

#### [NEW] [EconomicNewsSection.css](file:///home/asd1702/FinD_Main/find-front_T/src/components/dashboard/EconomicNewsSection.css)
- `NewsSection.css` 복사 후 필요 시 조정

#### [MODIFY] [Dashboard.tsx](file:///home/asd1702/FinD_Main/find-front_T/src/pages/Dashboard/Dashboard.tsx)
- `EconomicNewsSection` 컴포넌트 import 및 렌더링 추가 (하단에 배치)

---

## Verification Plan

### 수동 테스트 (Manual Test)

1. **백엔드 API 테스트**
   ```bash
   curl http://localhost:8000/api/v1/news/general?limit=5
   ```
   - 응답: JSON 배열로 일반 뉴스 5개 반환 확인

2. **프론트엔드 UI 테스트**
   - 대시보드 페이지 접속: `http://localhost:5173`
   - 페이지 하단에 "주요 경제 뉴스" 섹션 확인
   - 뉴스 아이템 클릭 시 확장 동작 확인
   - 마우스 호버 시 스포트라이트 효과 확인
   - "원문 기사 보기" 링크 동작 확인

---

## 고려 사항

> [!IMPORTANT]
> FMP `/stable/news/general-latest` 엔드포인트가 영어로만 제공될 경우, 기존 번역 서비스를 활용하여 한글로 번역할지 결정이 필요합니다.

> [!NOTE]
> 초기 구현은 영어 뉴스를 그대로 표시하고, 후속 작업으로 번역 기능을 추가할 수 있습니다.
