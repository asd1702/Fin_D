from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app import models, schemas
from app.database import SessionLocal
# Auth dependency import
from app.routers.auth import get_current_user

router = APIRouter(
    prefix="/api/v1/user",
    tags=["User Data"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Favorites ---

@router.get("/favorites", response_model=List[schemas.UserFavoriteResponse])
def get_favorites(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """사용자의 즐겨찾기 목록을 조회합니다."""
    print(f"[Favorite] User ID: {current_user.id}")
    favs = db.query(models.UserFavorite).filter(models.UserFavorite.user_id == current_user.id).all()
    print(f"[Favorite] Found {len(favs)} items")
    for f in favs:
        print(f"  - id={f.id}, ticker={f.ticker}")
    return favs

@router.post("/favorites", response_model=schemas.UserFavoriteResponse)
def add_favorite(
    fav: schemas.UserFavoriteCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """즐겨찾기를 추가합니다."""
    # 이미 존재하는지 확인
    existing = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == current_user.id,
        models.UserFavorite.ticker == fav.ticker
    ).first()
    
    if existing:
        return existing

    new_fav = models.UserFavorite(
        user_id=current_user.id,
        ticker=fav.ticker
    )
    db.add(new_fav)
    db.commit()
    db.refresh(new_fav)
    return new_fav

@router.delete("/favorites/{ticker}")
def delete_favorite(
    ticker: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """즐겨찾기를 삭제합니다."""
    fav = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == current_user.id,
        models.UserFavorite.ticker == ticker
    ).first()
    
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    db.delete(fav)
    db.commit()
    return {"message": "Deleted successfully"}

# --- Events ---

@router.get("/events", response_model=List[schemas.UserEventResponse])
def get_events(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """사용자의 일정 목록을 조회합니다."""
    return db.query(models.UserEvent).filter(models.UserEvent.user_id == current_user.id).all()

@router.post("/events", response_model=schemas.UserEventResponse)
def add_event(
    event: schemas.UserEventCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """일정을 추가합니다."""
    new_event = models.UserEvent(
        user_id=current_user.id,
        title=event.title,
        date=event.date,
        time=event.time,
        ticker=event.ticker,
        description=event.description,
        event_type=event.event_type
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@router.delete("/events/{event_id}")
def delete_event(
    event_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """일정을 삭제합니다."""
    event = db.query(models.UserEvent).filter(
        models.UserEvent.user_id == current_user.id,
        models.UserEvent.id == event_id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    db.delete(event)
    db.commit()
    return {"message": "Deleted successfully"}
