from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app import models, schemas
from app.database import SessionLocal
from app.routers.auth import get_current_user

router = APIRouter(
    prefix="/api/v1/user",
    tags=["User"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/favorite/{ticker}", response_model=schemas.FavoriteStatus)
def get_favorite_status(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """특정 기업의 즐겨찾기 여부를 확인합니다."""
    favorite = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == current_user.id,
        models.UserFavorite.ticker == ticker
    ).first()
    
    return schemas.FavoriteStatus(
        is_favorite=favorite is not None,
        ticker=ticker
    )

@router.post("/favorite/{ticker}", response_model=schemas.FavoriteStatus)
def toggle_favorite(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """즐겨찾기를 추가하거나 삭제(토글)합니다."""
    # 1. 기업 존재 여부 확인 필수 (외래키 제약 조건 보호)
    company = db.query(models.CompanyProfile).filter(models.CompanyProfile.ticker == ticker).first()
    if not company:
        raise HTTPException(status_code=404, detail="존재하지 않는 기업입니다.")

    # 2. 기존 즐겨찾기 확인
    favorite = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == current_user.id,
        models.UserFavorite.ticker == ticker
    ).first()

    if favorite:
        # 이미 있으면 삭제
        db.delete(favorite)
        db.commit()
        return schemas.FavoriteStatus(is_favorite=False, ticker=ticker)
    else:
        # 없으면 추가
        new_fav = models.UserFavorite(user_id=current_user.id, ticker=ticker)
        db.add(new_fav)
        db.commit()
        return schemas.FavoriteStatus(is_favorite=True, ticker=ticker)

