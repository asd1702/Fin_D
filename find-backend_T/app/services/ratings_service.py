# app/services/ratings_service.py  -- 에널리스트 평가가
import httpx, json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.config import FMP_API_KEY
from app import models
from app.mcp.decorators import register_tool

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"


@register_tool
async def fetch_analyst_ratings(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    limit: int = 10,
) -> list:
    """
    특정 티커(ticker)의 최신 애널리스트 평가 정보(투자의견, 목표주가)를 조회합니다.
    """
    cache_key = f"analyst_ratings_{ticker}"
    now = datetime.utcnow()

    cache_hit = (
        db.query(models.ApiCache)
        .filter(
            models.ApiCache.cache_key == cache_key,
            models.ApiCache.expires_at > now,
        )
        .first()
    )

    # [디버깅] 캐시 상태 확인
    if cache_hit:
        print(f"[Cache HIT] 애널리스트 평가 캐시 존재 (만료: {cache_hit.expires_at}), DB에서 조회만 수행: {ticker}")
    else:
        print(f"[Cache MISS] 캐시 없음, API 호출 필요: {ticker}")

    if not cache_hit:
        print(f"[Cache MISS] FMP API 호출: analyst-stock-recommendations & price-target-consensus/{ticker}")
        
        # [최적화] API 호출 병렬화 함수
        async def fetch_with_fallback(urls: list):
            for api_url in urls:
                try:
                    resp = await client.get(api_url, timeout=5.0)
                    if resp.status_code == 404: continue
                    resp.raise_for_status()
                    return resp.json()
                except Exception as exc:
                    print(f"[Warning] API 호출 실패 ({api_url}): {exc}")
            return None

        recommendations_urls = [
            f"https://financialmodelingprep.com/stable/analyst-stock-recommendations/{ticker}?limit={limit}&apikey={FMP_API_KEY}",
            f"{FMP_BASE_URL}/analyst-stock-recommendations/{ticker}?limit={limit}&apikey={FMP_API_KEY}",
        ]
        price_target_urls = [
            f"https://financialmodelingprep.com/api/v4/price-target-consensus?symbol={ticker}&apikey={FMP_API_KEY}",
            f"{FMP_BASE_URL.replace('v3', 'v4')}/price-target-consensus?symbol={ticker}&apikey={FMP_API_KEY}",
        ]

        # 병렬 호출 실행
        import asyncio
        results = await asyncio.gather(
            fetch_with_fallback(recommendations_urls),
            fetch_with_fallback(price_target_urls)
        )
        recommendations_data, price_target_data = results
        
        if recommendations_data is None:
            print(f"[Error] analyst-stock-recommendations API 실패: {ticker}")
            recommendations_data = []
        
        current_consensus_target = None
        if price_target_data and isinstance(price_target_data, list) and len(price_target_data) > 0:
            current_consensus_target = price_target_data[0].get("targetConsensus")
        
        data = []
        for idx, rec_item in enumerate(recommendations_data):
            merged_item = rec_item.copy()
            if idx == 0 and current_consensus_target:
                merged_item["price_target"] = current_consensus_target
            else:
                merged_item["price_target"] = None
            data.append(merged_item)
        
        try:
            
            if not data or not isinstance(data, list):
                print(f"[Warning] 애널리스트 평가 데이터가 비어있거나 형식이 잘못됨: {ticker}")
                # 빈 데이터라도 캐시를 저장하여 24시간 동안 재호출 방지
                db.merge(
                    models.ApiCache(
                        cache_key=cache_key,
                        data={"refreshed_at": now.isoformat(), "empty": True},
                        expires_at=now + timedelta(hours=24),
                    )
                )
                db.commit()
            else:
                print(f"[Info] 애널리스트 평가 데이터 {len(data)}건 수신: {ticker}")
                # [디버깅] 첫 번째 항목의 키 확인
                if len(data) > 0:
                    print(f"[Debug] 첫 번째 항목 키: {list(data[0].keys())}")
                    print(f"[Debug] 첫 번째 항목 샘플: {json.dumps(data[0], indent=2, ensure_ascii=False, default=str)}")
                else:
                    print(f"[Warning] 데이터가 비어있습니다: {ticker}")
                
                saved_count = 0
                for item in data:
                    try:
                        # date 파싱 (문자열을 Date로 변환)
                        date_str = item.get("date")
                        if not date_str:
                            print(f"[Warning] date가 없는 항목 건너뜀: {item}")
                            continue
                        
                        # ISO 형식 또는 YYYY-MM-DD 형식 파싱
                        if isinstance(date_str, str):
                            from datetime import datetime as dt
                            try:
                                rating_date = dt.fromisoformat(date_str.replace("Z", "+00:00")).date()
                            except ValueError:
                                try:
                                    rating_date = dt.strptime(date_str, "%Y-%m-%d").date()
                                except ValueError:
                                    print(f"[Warning] 날짜 파싱 실패: {date_str}, 건너뜀")
                                    continue
                        else:
                            rating_date = date_str
                        
                        # company_profiles에 ticker가 있는지 확인 (Foreign Key 제약조건)
                        ticker_symbol = item.get("symbol") or ticker
                        db_profile = db.query(models.CompanyProfile).filter_by(ticker=ticker_symbol).first()
                        if not db_profile:
                            print(f"[Warning] company_profiles에 {ticker_symbol}가 없어서 건너뜀 (FK 제약조건)")
                            continue
                        
                        # [수정] FMP API는 집계 통계 데이터를 제공함
                        # 필드명: analystRatingsStrongBuy, analystRatingsbuy, analystRatingsHold, etc.
                        # None 체크를 위해 int() 변환 사용
                        strong_buy = int(item.get("analystRatingsStrongBuy") or 0)
                        buy = int(item.get("analystRatingsbuy") or 0)  # 소문자 'b' 주의!
                        hold = int(item.get("analystRatingsHold") or 0)
                        sell = int(item.get("analystRatingsSell") or 0)
                        strong_sell = int(item.get("analystRatingsStrongSell") or 0)
                        
                        # price_target 추출 (병합된 데이터에서)
                        price_target = item.get("price_target")
                        if price_target:
                            try:
                                price_target = float(price_target)
                            except (ValueError, TypeError):
                                price_target = None
                        else:
                            price_target = None
                        
                        # [디버깅] 필드값 확인 (첫 번째 항목만 상세 로그)
                        if saved_count == 0:
                            print(f"[Debug] API 응답 필드: {list(item.keys())}")
                            print(f"[Debug] 원본 값 - StrongBuy: {item.get('analystRatingsStrongBuy')}, Buy: {item.get('analystRatingsbuy')}, Hold: {item.get('analystRatingsHold')}")
                            print(f"[Debug] 변환 후 - StrongBuy: {strong_buy}, Buy: {buy}, Hold: {hold}, Sell: {sell}, StrongSell: {strong_sell}")
                            print(f"[Debug] Price Target: {price_target}")
                        
                        # ticker와 date로 기존 레코드 확인 (집계 데이터이므로 날짜별로 하나만 존재)
                        exists = (
                            db.query(models.AnalystRating)
                            .filter_by(
                                ticker=ticker_symbol,
                                date=rating_date,
                            )
                            .first()
                        )
                        if exists:
                            # 기존 레코드 업데이트
                            print(f"[Debug] 기존 레코드 업데이트: {ticker_symbol} {rating_date}")
                            exists.analyst_ratings_strong_buy = strong_buy
                            exists.analyst_ratings_buy = buy
                            exists.analyst_ratings_hold = hold
                            exists.analyst_ratings_sell = sell
                            exists.analyst_ratings_strong_sell = strong_sell
                            exists.price_target = price_target  # 목표주가도 업데이트
                            saved_count += 1
                        else:
                            # 새 레코드 추가
                            print(f"[Debug] 새 레코드 추가: {ticker_symbol} {rating_date} - StrongBuy: {strong_buy}, Buy: {buy}, Hold: {hold}")
                            new_record = models.AnalystRating(
                                ticker=ticker_symbol,
                                date=rating_date,
                                analyst_ratings_strong_buy=strong_buy,
                                analyst_ratings_buy=buy,
                                analyst_ratings_hold=hold,
                                analyst_ratings_sell=sell,
                                analyst_ratings_strong_sell=strong_sell,
                                # 개별 평가 필드는 NULL (집계 데이터만 저장)
                                analyst_firm=None,
                                rating=None,
                                price_target=price_target,  # price-target-consensus에서 가져온 값
                            )
                            db.add(new_record)
                            saved_count += 1
                    except Exception as item_exc:
                        print(f"[Error] 항목 저장 중 오류 (건너뜀): {item_exc}, 항목: {item}")
                        import traceback
                        traceback.print_exc()
                        continue

                print(f"[Info] 애널리스트 평가 {saved_count}건 저장 완료: {ticker}")
                db.merge(
                    models.ApiCache(
                        cache_key=cache_key,
                        data={"refreshed_at": now.isoformat()},
                        expires_at=now + timedelta(hours=24),
                    )
                )
                db.commit()
        except Exception as e:
            db.rollback()
            print(f"fetch_analyst_ratings 에러: {e}")
            import traceback
            traceback.print_exc()

    final_ratings = (
        db.query(models.AnalystRating)
        .filter_by(ticker=ticker)
        .order_by(models.AnalystRating.date.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "date": str(r.date),
            "strong_buy": r.analyst_ratings_strong_buy,
            "buy": r.analyst_ratings_buy,
            "hold": r.analyst_ratings_hold,
            "sell": r.analyst_ratings_sell,
            "strong_sell": r.analyst_ratings_strong_sell,
            # 개별 평가 데이터 (향후 확장용)
            "firm": r.analyst_firm,
            "rating": r.rating,
            "price_target": float(r.price_target) if r.price_target else None,
        }
        for r in final_ratings
    ]


@register_tool
async def fetch_analyst_consensus_card(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient
) -> dict:
    """
    [Dashboard] 애널리스트 종합 투자의견 카드용 데이터를 생성합니다.
    """
    # [최적화] 투자의견과 현재 주가를 병렬로 조회
    import asyncio
    from app.services.market_service import fetch_stock_quote
    
    results = await asyncio.gather(
        fetch_analyst_ratings(ticker, db, client, limit=1),
        fetch_stock_quote(ticker, db, client)
    )
    ratings, quote = results

    if not ratings:
        return None
    
    latest = ratings[0]
    current_price = quote.get("close") if quote else 0
    
    # 3. 데이터 가공
    strong_buy = latest.get("strong_buy", 0) or 0
    buy = latest.get("buy", 0) or 0
    hold = latest.get("hold", 0) or 0
    sell = latest.get("sell", 0) or 0
    strong_sell = latest.get("strong_sell", 0) or 0
    
    total_analysts = strong_buy + buy + hold + sell + strong_sell
    
    # Consensus Score (5.0 만점)
    # Strong Buy(5), Buy(4), Hold(3), Sell(2), Strong Sell(1)
    score = 0
    consensus_label = "Neutral"
    if total_analysts > 0:
        weighted_sum = (strong_buy * 5) + (buy * 4) + (hold * 3) + (sell * 2) + (strong_sell * 1)
        score = round(weighted_sum / total_analysts, 2)
        
        if score >= 4.5: consensus_label = "Strong Buy"
        elif score >= 3.5: consensus_label = "Buy"
        elif score >= 2.5: consensus_label = "Hold"
        elif score >= 1.5: consensus_label = "Sell"
        else: consensus_label = "Strong Sell"
        
    # Upside Potential
    target_price = latest.get("price_target") or 0
    upside_percent = 0
    if current_price > 0 and target_price > 0:
        upside_percent = round(((target_price - current_price) / current_price) * 100, 2)
        
    return {
        "type": "analyst_card",
        "consensus_rating": consensus_label,
        "consensus_score": score,
        "target_price": target_price,
        "current_price": current_price,
        "upside_percent": upside_percent,
        "analyst_count": total_analysts,
        "distribution": {
            "strong_buy": strong_buy,
            "buy": buy,
            "hold": hold,
            "sell": sell,
            "strong_sell": strong_sell
        }
    }
