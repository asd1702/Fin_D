# app/services/news_service.py
import httpx, json
from sqlalchemy.orm import Session
from app.config import FMP_API_KEY
from app import models
from app.mcp.decorators import register_tool

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"

@register_tool
async def search_summarized_news(ticker: str, db: Session, client: httpx.AsyncClient) -> list:
    """
    특정 티커(ticker)와 연관된 요약 뉴스 목록을 조회합니다.
    Smart Caching: DB 뉴스가 6시간 이내면 DB 사용, 아니면 API 호출 후 DB 저장.
    """
    from datetime import datetime, timedelta
    
    print(f"[News Service] 뉴스 조회 시작 ({ticker})")
    
    # Step 1: DB에서 최신 뉴스 확인
    latest_news = db.query(models.NewsArticle)\
                    .filter(models.NewsArticle.symbols.like(f"%{ticker}%"))\
                    .order_by(models.NewsArticle.publishedDate.desc())\
                    .first()
    
    # Step 2: 신선도 체크 (6시간)
    needs_refresh = True
    if latest_news and latest_news.publishedDate:
        try:
            # publishedDate가 문자열이면 datetime으로 변환
            if isinstance(latest_news.publishedDate, str):
                latest_date = datetime.fromisoformat(latest_news.publishedDate.replace('Z', '+00:00'))
            else:
                latest_date = latest_news.publishedDate
            
            time_diff = datetime.now(latest_date.tzinfo) - latest_date
            if time_diff < timedelta(hours=6):
                needs_refresh = False
                print(f"[News Service] DB 캐시 사용 (최신 뉴스: {time_diff.seconds//3600}시간 전)")
        except Exception as e:
            print(f"[News Service] 날짜 파싱 에러: {e}, API 호출로 전환")
    
    # Step 3: 신선하면 DB에서 가져오기
    if not needs_refresh:
        db_news = db.query(models.NewsArticle)\
                    .filter(models.NewsArticle.symbols.like(f"%{ticker}%"))\
                    .order_by(models.NewsArticle.publishedDate.desc())\
                    .limit(20).all()
        
        result = []
        for n in db_news:
            p_date = n.publishedDate
            if hasattr(p_date, 'isoformat'):
                p_date = p_date.isoformat()
            result.append({
                "title": n.title,
                "summary": n.summary,
                "url": n.url,
                "publishedDate": p_date
            })
        print(f"[News Service] DB에서 {len(result)}개 뉴스 반환")
        return result
    
    # Step 4: 오래되었거나 없으면 API 호출
    print(f"[News Service] DB 캐시 만료 또는 없음, API 호출 중...")
    api_news = []
    try:
        url = f"{FMP_BASE_URL}/stock_news?tickers={ticker}&limit=20&apikey={FMP_API_KEY}"
        resp = await client.get(url, timeout=5.0)
        if resp.status_code == 200:
            api_data = resp.json() or []
            print(f"[News Service] API에서 {len(api_data)}개 뉴스 수신")
                
            # Step 5: DB에 저장 (중복 체크)
            for item in api_data:
                # 반환용 리스트에 추가
                site = item.get("site", "Unknown")
                text = item.get("text", "")
                # [Source Injection] AI가 출처를 알 수 있도록 summary에 site 정보 주입
                enriched_summary = f"[{site}] {text}"

                api_news.append({
                    "title": item.get("title"),
                    "summary": enriched_summary,
                    "url": item.get("url"),
                    "publishedDate": item.get("publishedDate")
                })
                
                # DB에 저장 (중복 체크)
                exists = db.query(models.NewsArticle).filter_by(url=item.get("url")).first()
                if not exists:
                    new_article = models.NewsArticle(
                        url=item.get("url"),
                        title=item.get("title") or "",
                        publishedDate=item.get("publishedDate"),
                        symbols=ticker,  # 현재 ticker 저장
                        summary=enriched_summary # DB에도 출처 포함된 텍스트 저장
                    )
                    db.add(new_article)
            
            # MCPAgent가 최종적으로 commit을 담당하므로, 여기서는 개별 commit을 제거하거나 flush만 수행
            db.flush()
            print(f"[News Service] DB에 신규 뉴스 캐싱 완료 (Flush)")
                
    except Exception as e:
        print(f"[News Service] API 호출 실패: {e}")
        db.rollback()
        # Fallback: DB에서라도 가져오기
        db_news = db.query(models.NewsArticle)\
                    .filter(models.NewsArticle.symbols.like(f"%{ticker}%"))\
                    .order_by(models.NewsArticle.publishedDate.desc())\
                    .limit(20).all()
        
        for n in db_news:
            p_date = n.publishedDate
            if hasattr(p_date, 'isoformat'):
                p_date = p_date.isoformat()
            api_news.append({
                "title": n.title,
                "summary": n.summary,
                "url": n.url,
                "publishedDate": p_date
            })
    
    return api_news


async def fetch_and_store_latest_news(db: Session, client: httpx.AsyncClient):
    print("[Celery Task] 최신 뉴스 수집 시작...")
    url = f"{FMP_BASE_URL}/stock_news?limit=100&apikey={FMP_API_KEY}"
    try:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        count = 0
        for item in data:
            exists = db.query(models.NewsArticle).filter_by(url=item.get("url")).first()
            if not exists:
                # title과 summary가 None이거나 빈 문자열인 경우 처리
                title = item.get("title") or ""
                site = item.get("site", "Unknown")
                text = item.get("text") or ""
                enriched_summary = f"[{site}] {text}"
                
                new_article = models.NewsArticle(
                    url=item.get("url"),
                    title=title,
                    publishedDate=item.get("publishedDate"),
                    symbols=item.get("symbols"),
                    summary=enriched_summary
                )
                db.add(new_article)
                count += 1
        db.commit()
        print(f"[Celery Task] 뉴스 {count}건 신규 저장 완료.")
    except Exception as e:
        db.rollback()
        print(f"[Celery Task] 뉴스 수집 중 에러: {e}") 

