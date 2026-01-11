import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userDataApi } from '@/services/api/userDataApi';
import { companyApi } from '@/services/api/company';
import CompanyCard from '@/components/company/CompanyCard';
import type { Company, StockQuote } from '@/types';
import './FavoriteCompanies.css';

interface FavoriteItem {
    company: Company;
    quote: StockQuote | null;
}

export default function FavoriteCompanies() {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchFavorites = async () => {
            try {
                const userFavs = await userDataApi.getFavorites();

                if (userFavs && userFavs.length > 0) {
                    const promises = userFavs.map(async (fav) => {
                        if (!fav.ticker) return null;
                        try {
                            const [profile, quote] = await Promise.all([
                                companyApi.getProfile(fav.ticker),
                                companyApi.getQuote(fav.ticker).catch(() => null)
                            ]);
                            return profile ? { company: profile, quote } : null;
                        } catch {
                            return null;
                        }
                    });

                    const results = await Promise.all(promises);
                    setFavorites(results.filter((item): item is FavoriteItem => item !== null));
                }
            } catch (error) {
                console.error('Failed to fetch favorite companies:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFavorites();
    }, []);

    const handleCompanyClick = (ticker: string) => {
        navigate(`/company/${ticker}`);
    };

    if (loading) {
        return (
            <div className="favorite-companies-section">
                <h3 className="section-title">관심 기업 리스트</h3>
                <div className="favorite-companies-loading">Loading favorites...</div>
            </div>
        );
    }

    if (favorites.length === 0) {
        return (
            <div className="favorite-companies-section">
                <h3 className="section-title">관심 기업 리스트</h3>
                <div className="favorite-companies-empty">
                    <p>관심 기업이 없습니다.</p>
                    <p className="empty-sub">기업 상세 페이지에서 관심 기업을 추가해보세요.</p>
                </div>
            </div>
        );
    }

    // 무한 루프를 위해 카드 복제 (3배로 복제하여 더 부드러운 루프)
    const duplicatedFavorites = [...favorites, ...favorites, ...favorites];

    return (
        <div className="favorite-companies-section">
            <h3 className="section-title">관심 기업 리스트</h3>
            <div className="favorite-companies-carousel">
                <div
                    className={`carousel-track ${isPaused ? 'paused' : ''}`}
                    ref={trackRef}
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                    style={{ '--card-count': favorites.length } as React.CSSProperties}
                >
                    {duplicatedFavorites.map((item, index) => (
                        <div
                            key={`${item.company.ticker}-${index}`}
                            className="favorite-card-wrapper"
                        >
                            <CompanyCard
                                company={item.company}
                                quote={item.quote}
                                onClick={() => handleCompanyClick(item.company.ticker)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}