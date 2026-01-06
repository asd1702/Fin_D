"""기업의 재무 건전성을 월스트리트 기준으로 분석하는 서비스."""
# app/services/health_analysis_service.py

from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from app.services.key_metrics_service import fetch_company_key_metrics
from app.services.income_statement_service import fetch_company_income_statements

async def fetch_health_analysis_widget(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient
) -> Dict[str, Any]:
    """
    기업의 재무 건전성을 분석하여 점수와 분석 메시지를 반환합니다.
    분석 기준:
    1. 수익성 (Profitability): ROE, Net Margin
    2. 안정성 (Stability/Solvency): Debt-to-Equity, Current Ratio
    3. 성장성 (Growth): Revenue Growth, EPS Growth (YoY)
    """
    # 1. 필요 데이터 로드 (Key Metrics 2개, Income Statements 2개)
    metrics_data = await fetch_company_key_metrics(ticker, db, client, limit=2)
    metrics = metrics_data.get("records", [])
    
    income_data = await fetch_company_income_statements(ticker, db, client, limit=2)
    
    if not metrics or not income_data:
        return None
        
    latest_m = metrics[0]
    prev_m = metrics[1] if len(metrics) > 1 else None
    
    latest_i = income_data[0]
    prev_i = income_data[1] if len(income_data) > 1 else None
    
    # --- 1. 수익성 분석 (Profitability) ---
    # 기준: ROE(15% 이상 우수), Net Margin(10% 이상 우수)
    roe = (latest_m.get("return_on_equity") or 0) * 100
    net_income = latest_i.get("net_income") or 0
    revenue = latest_i.get("revenue") or 1 # 0 나누기 방지
    net_margin = (net_income / revenue) * 100
    
    prof_score = 0
    if roe > 15: prof_score += 5
    elif roe > 8: prof_score += 3
    else: prof_score += 1
    
    if net_margin > 12: prof_score += 5
    elif net_margin > 5: prof_score += 3
    else: prof_score += 1
    
    prof_msg = "보통"
    if prof_score >= 8: prof_msg = "우수"
    elif prof_score >= 5: prof_msg = "양호"
    else: prof_msg = "주의"
    
    # --- 2. 안정성 분석 (Stability) ---
    # 기준: D/E Ratio(1.0 이하 우수), Current Ratio(1.2 이상 우수)
    de = latest_m.get("debt_to_equity") or 2.0
    cr = latest_m.get("current_ratio") or 1.0
    
    stab_score = 0
    if de < 0.8: stab_score += 5
    elif de < 1.5: stab_score += 3
    else: stab_score += 1
    
    if cr > 1.5: stab_score += 5
    elif cr > 1.0: stab_score += 3
    else: stab_score += 1
    
    stab_msg = "보통"
    if stab_score >= 8: stab_msg = "매우 탄탄"
    elif stab_score >= 5: stab_msg = "안정적"
    else: stab_msg = "위험"
    
    # --- 3. 성장성 분석 (Growth) ---
    # 기준: Revenue Growth (5% 이상), Net Income Growth (5% 이상)
    rev_growth = 0
    if prev_i and prev_i.get("revenue"):
        rev_growth = ((latest_i.get("revenue", 0) - prev_i["revenue"]) / prev_i["revenue"]) * 100
        
    eps_growth = 0
    if prev_i and prev_i.get("eps"):
        eps_growth = ((latest_i.get("eps", 0) - prev_i["eps"]) / prev_i["eps"]) * 100
        
    grow_score = 0
    if rev_growth > 10: grow_score += 5
    elif rev_growth > 0: grow_score += 3
    else: grow_score += 1
    
    if eps_growth > 10: grow_score += 5
    elif eps_growth > 0: grow_score += 3
    else: grow_score += 1
    
    grow_msg = "정체"
    if grow_score >= 8: grow_msg = "고성장"
    elif grow_score >= 5: grow_msg = "완만한 성장"
    else: grow_msg = "역성장"

    # --- 최종 점수 및 분석 메시지 ---
    total_score = Math.round(((prof_score + stab_score + grow_score) / 30) * 100)
    
    # 종합 평가 메시지 생성
    summary_msg = ""
    if total_score >= 80: summary_msg = "재무 상태가 매우 건전하며 균형 잡힌 성장을 보여주고 있습니다."
    elif total_score >= 60: summary_msg = "전반적으로 안정적인 재무 구조를 유지하고 있습니다."
    elif total_score >= 40: summary_msg = "일부 지표에서 개선이 필요하나 사업 운영에는 체력이 충분합니다."
    else: summary_msg = "재무 지표가 불안정하므로 투자 시 부채 및 수익성 개선 여부를 면밀히 확인해야 합니다."

    return {
        "type": "health_analysis",
        "total": total_score,
        "summary": summary_msg,
        "profitability": {
            "score": prof_score,
            "label": prof_msg,
            "details": f"ROE {roe:.1f}%, 순이익률 {net_margin:.1f}%"
        },
        "stability": {
            "score": stab_score,
            "label": stab_msg,
            "details": f"부채비율 {de:.2f}, 유동비율 {cr:.2f}"
        },
        "growth": {
            "score": grow_score,
            "label": grow_msg,
            "details": f"매출성장 {rev_growth:.1f}%, 이익성장 {eps_growth:.1f}%"
        }
    }

class MathProxy:
    @staticmethod
    def round(val):
        return int(val + 0.5)

Math = MathProxy()
