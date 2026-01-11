# app/services/notification_scheduler.py
"""
알림 스케줄러
1. 캘린더 일정 알림: 매일 오전 9시에 내일 일정 체크
2. 경제지표 알림: 21:30, 22:30, 03:00 (KST)에 FMP 폴링
"""

import asyncio
from datetime import datetime, timedelta, date
from typing import List, Set

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import FMP_API_KEY
from app.database import SessionLocal
from app.services.economic_insight_service import (
    is_major_indicator,
    generate_economic_insight,
    get_korean_name
)

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"

# 이미 처리한 경제지표 캐시 (중복 알림 방지)
_processed_economic_events: Set[str] = set()


async def create_calendar_reminder_notifications():
    """
    내일 있는 일정에 대해 알림 생성 (매일 오전 9시 실행)
    """
    print(f"[NotificationScheduler] 캘린더 알림 체크 시작: {datetime.now()}")
    
    db = SessionLocal()
    try:
        tomorrow = date.today() + timedelta(days=1)
        
        # 내일의 모든 사용자 일정 조회
        events = db.query(models.UserEvent).filter(
            models.UserEvent.date == tomorrow
        ).all()
        
        if not events:
            print("[NotificationScheduler] 내일 일정 없음")
            return
        
        print(f"[NotificationScheduler] 내일 일정 {len(events)}개 발견")
        
        for event in events:
            # 이미 알림이 생성되었는지 확인
            existing = db.query(models.Notification).filter(
                models.Notification.user_id == event.user_id,
                models.Notification.related_event_id == event.id,
                models.Notification.notification_type == "calendar"
            ).first()
            
            if existing:
                continue
            
            # 알림 생성
            time_str = f" ({event.time})" if event.time else ""
            notification = models.Notification(
                user_id=event.user_id,
                title=f"📅 내일 일정: {event.title}",
                content=f"{tomorrow.strftime('%Y년 %m월 %d일')}{time_str}\n{event.description or ''}",
                notification_type="calendar",
                related_event_id=event.id
            )
            db.add(notification)
        
        db.commit()
        print(f"[NotificationScheduler] 캘린더 알림 생성 완료")
        
    except Exception as e:
        db.rollback()
        print(f"[NotificationScheduler] 캘린더 알림 에러: {e}")
    finally:
        db.close()


async def fetch_economic_calendar(client: httpx.AsyncClient) -> List[dict]:
    """FMP에서 오늘/어제 경제지표 발표 조회"""
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    url = f"{FMP_BASE_URL}/economic_calendar?from={yesterday}&to={today}&apikey={FMP_API_KEY}"
    
    try:
        response = await client.get(url, timeout=30.0)
        response.raise_for_status()
        return response.json() or []
    except Exception as e:
        print(f"[NotificationScheduler] FMP 경제지표 API 호출 실패: {e}")
        return []


async def check_economic_indicators():
    """
    경제지표 발표 체크 및 알림 생성
    한국 시간 21:30, 22:30, 03:00에 실행
    """
    print(f"[NotificationScheduler] 경제지표 체크 시작: {datetime.now()}")
    
    db = SessionLocal()
    try:
        async with httpx.AsyncClient() as client:
            events = await fetch_economic_calendar(client)
        
        if not events:
            print("[NotificationScheduler] 경제지표 이벤트 없음")
            return
        
        # 주요 지표만 필터링 & 실제값이 있는 것만
        major_events = [
            e for e in events 
            if is_major_indicator(e.get("event", "")) 
            and e.get("actual") is not None
        ]
        
        if not major_events:
            print("[NotificationScheduler] 새로운 주요 경제지표 발표 없음")
            return
        
        print(f"[NotificationScheduler] 주요 경제지표 {len(major_events)}개 발견")
        
        # 모든 사용자 조회 (알림 대상)
        users = db.query(models.User).all()
        
        for event in major_events:
            event_name = event.get("event", "Unknown")
            event_date = event.get("date", "")
            actual = event.get("actual")
            estimate = event.get("estimate")
            previous = event.get("previous")
            
            # 중복 체크 키
            event_key = f"{event_name}_{event_date}_{actual}"
            if event_key in _processed_economic_events:
                continue
            
            _processed_economic_events.add(event_key)
            
            # AI 인사이트 생성
            insight = await generate_economic_insight(
                event_name=event_name,
                actual=str(actual) if actual else None,
                estimate=str(estimate) if estimate else None,
                previous=str(previous) if previous else None,
                date=event_date
            )
            
            korean_name = get_korean_name(event_name)
            
            # 모든 사용자에게 알림 생성
            for user in users:
                notification = models.Notification(
                    user_id=user.id,
                    title=f"📊 {insight['title']}",
                    content=insight['content'],
                    notification_type="economic",
                    economic_event=korean_name
                )
                db.add(notification)
            
            print(f"[NotificationScheduler] 경제지표 알림 생성: {korean_name}")
        
        db.commit()
        print(f"[NotificationScheduler] 경제지표 알림 생성 완료")
        
    except Exception as e:
        db.rollback()
        print(f"[NotificationScheduler] 경제지표 알림 에러: {e}")
    finally:
        db.close()


async def run_all_notification_jobs():
    """모든 알림 작업 수동 실행 (테스트용)"""
    await create_calendar_reminder_notifications()
    await check_economic_indicators()


# 수동 테스트용
if __name__ == "__main__":
    asyncio.run(run_all_notification_jobs())
