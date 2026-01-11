from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from app import models, schemas
from app.database import SessionLocal
from app.routers.auth import get_current_user

router = APIRouter(
    prefix="/api/v1/notifications",
    tags=["Notifications"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=List[schemas.NotificationResponse])
def get_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """사용자의 알림 목록을 조회합니다."""
    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(desc(models.Notification.created_at)).limit(limit).all()
    
    return notifications


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """읽지 않은 알림 수를 반환합니다."""
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == 0
    ).count()
    
    return {"unread_count": count}


@router.put("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """알림을 읽음 처리합니다."""
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = 1
    db.commit()
    
    return {"message": "Marked as read"}


@router.put("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """모든 알림을 읽음 처리합니다."""
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == 0
    ).update({"is_read": 1})
    db.commit()
    
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """알림을 삭제합니다."""
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Deleted successfully"}


@router.post("/trigger-calendar")
async def trigger_calendar_notifications(
    current_user: models.User = Depends(get_current_user)
):
    """캘린더 알림 스케줄러 수동 실행 (테스트용)"""
    from app.services.notification_scheduler import create_calendar_reminder_notifications
    
    try:
        await create_calendar_reminder_notifications()
        return {"status": "success", "message": "캘린더 알림 체크 완료"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/trigger-economic")
async def trigger_economic_notifications(
    current_user: models.User = Depends(get_current_user)
):
    """경제지표 알림 스케줄러 수동 실행 (테스트용)"""
    from app.services.notification_scheduler import check_economic_indicators
    
    try:
        await check_economic_indicators()
        return {"status": "success", "message": "경제지표 알림 체크 완료"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
