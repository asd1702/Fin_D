"""
번역된 기업 프로필 데이터 확인 스크립트
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app import models

def check_translated_profiles():
    """번역된 프로필 데이터 확인"""
    
    db = SessionLocal()
    
    try:
        # 번역이 필요한 주요 티커들 확인
        tickers_to_check = ["AAPL", "AMD", "AMZN", "INTC", "NVDA", "GOOGL", "AVGO", "COST", "JNJ", "JPM", "LLY"]
        
        print("="*80)
        print("번역된 기업 프로필 확인")
        print("="*80)
        print()
        
        for ticker in tickers_to_check:
            company = db.query(models.CompanyProfile).filter(
                models.CompanyProfile.ticker == ticker
            ).first()
            
            if not company:
                print(f"❌ {ticker}: DB에 없음")
                continue
            
            print(f"📊 {ticker} ({company.companyName})")
            print(f"   k_name: {company.k_name or 'NULL'}")
            
            # description 확인 (처음 100자만)
            desc_preview = company.description[:100] + "..." if company.description and len(company.description) > 100 else (company.description or "NULL")
            print(f"   description: {desc_preview}")
            
            print(f"   industry: {company.industry or 'NULL'}")
            print(f"   sector: {company.sector or 'NULL'}")
            print(f"   last_updated: {company.last_updated}")
            print()
        
        # 전체 통계
        print("="*80)
        print("전체 통계")
        print("="*80)
        
        total = db.query(models.CompanyProfile).count()
        with_k_name = db.query(models.CompanyProfile).filter(
            models.CompanyProfile.k_name.isnot(None)
        ).count()
        
        print(f"전체 기업 수: {total}")
        print(f"k_name이 있는 기업: {with_k_name}")
        print(f"k_name이 없는 기업: {total - with_k_name}")
        
    except Exception as e:
        print(f"오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_translated_profiles()
