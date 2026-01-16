# app/services/economic_insight_service.py
"""
경제지표 발표에 대한 AI 인사이트 생성 서비스
GPT-4o-mini를 활용하여 경제지표 해석 및 시장 영향 분석
"""

import asyncio
import json
from typing import Dict, Optional

from openai import OpenAI
from app.config import OPENAI_API_KEY

_client = OpenAI(api_key=OPENAI_API_KEY)

# 주요 경제지표 필터 (한국어 이름 매핑)
MAJOR_INDICATORS = {
    "CPI": "소비자물가지수(CPI)",
    "Core CPI": "근원 소비자물가지수",
    "PPI": "생산자물가지수(PPI)",
    "Core PPI": "근원 생산자물가지수",
    "Nonfarm Payrolls": "비농업 고용지표(NFP)",
    "Non-Farm Payrolls": "비농업 고용지표(NFP)",
    "Unemployment Rate": "실업률",
    "Initial Jobless Claims": "신규 실업수당 청구건수",
    "Continuing Jobless Claims": "계속 실업수당 청구건수",
    "Fed Interest Rate Decision": "연준 금리 결정",
    "FOMC Statement": "FOMC 성명서",
    "Federal Funds Rate": "연방기금금리",
    "GDP": "국내총생산(GDP)",
    "Core PCE": "근원 개인소비지출(PCE)",
    "PCE Price Index": "개인소비지출 물가지수",
    "Retail Sales": "소매판매",
    "ISM Manufacturing PMI": "ISM 제조업 PMI",
    "ISM Services PMI": "ISM 서비스업 PMI",
}


def is_major_indicator(event_name: str) -> bool:
    """주요 경제지표인지 확인"""
    event_lower = event_name.lower()
    for key in MAJOR_INDICATORS.keys():
        if key.lower() in event_lower:
            return True
    return False


def get_korean_name(event_name: str) -> str:
    """경제지표의 한국어 이름 반환"""
    for key, value in MAJOR_INDICATORS.items():
        if key.lower() in event_name.lower():
            return value
    return event_name


async def generate_economic_insight(
    event_name: str,
    actual: Optional[str],
    estimate: Optional[str],
    previous: Optional[str],
    date: str,
    country: str = "US"
) -> Dict[str, str]:
    """
    경제지표에 대한 AI 인사이트 생성
    
    Returns:
        {"title": "한글 제목", "content": "분석 내용 및 시장 영향"}
    """
    korean_name = get_korean_name(event_name)
    
    # 데이터 포맷팅
    data_summary = f"""
경제지표: {event_name} ({korean_name})
발표일: {date}
실제값: {actual or '미발표'}
예상치: {estimate or '없음'}
이전값: {previous or '없음'}
"""
    
    prompt = f"""다음 {country} 경제지표 발표에 대해 간결하고 전문적인 분석을 제공해주세요.
    (발표일의 연도해석에 주의하세요. FMP API의 release date가 {date}라면 해당 발표는 보통 직전 월의 데이터일 가능성이 높습니다. 미래 시점(예: 2026년 12월)으로 잘못 해석하지 마세요.)

{data_summary}

다음 형식으로 JSON 응답해주세요:
{{
    "title": "지표 결과 요약 (한 줄)",
    "content": "1-2문장의 시장 영향 분석. 주식/채권/달러에 미치는 영향 포함."
}}

응답은 반드시 JSON 형식으로만 해주세요.
"""
    
    def _call_openai() -> str:
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 전문 금융 애널리스트입니다. 경제지표를 분석하고 시장 영향을 간결하게 설명합니다. 한국어로 응답하며, 항상 JSON 형식으로만 답변합니다."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        if hasattr(response, 'usage') and response.usage:
            usage = response.usage
            print(f"[Token Usage] 경제지표 인사이트 - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")
        return response.choices[0].message.content or ""
    
    try:
        completion_text = await asyncio.to_thread(_call_openai)
        completion_text = completion_text.strip()
        
        # 코드 블록 형태 응답 처리
        if completion_text.startswith("```"):
            lines = completion_text.split("\n")
            if len(lines) > 2:
                completion_text = "\n".join(lines[1:-1])
            else:
                completion_text = completion_text.strip("`").strip()
                if completion_text.startswith("json"):
                    completion_text = completion_text[4:].strip()
        
        result = json.loads(completion_text)
        if isinstance(result, dict):
            return {
                "title": result.get("title", f"{korean_name} 발표"),
                "content": result.get("content", "분석 정보를 생성하지 못했습니다.")
            }
        
    except Exception as e:
        print(f"[EconomicInsight] 인사이트 생성 실패: {e}")
    
    # 실패 시 기본값 반환
    return {
        "title": f"{korean_name} 발표",
        "content": f"실제값: {actual or '미발표'}, 예상치: {estimate or '없음'}, 이전값: {previous or '없음'}"
    }
