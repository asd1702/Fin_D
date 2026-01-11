import { useState, useEffect, useRef } from 'react';
import { newsApi, NewsItem } from '@/services/api/newsApi';
import './NewsSection.css';

export default function NewsSection() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    useEffect(() => {
        const fetchNews = async () => {
            try {
                console.log('[NewsSection] Fetching news...');
                const data = await newsApi.getFavoriteNews();
                console.log('[NewsSection] Received data:', data);
                setNews(data);
            } catch (error) {
                console.error('[NewsSection] Failed to fetch news:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    const handleItemClick = (id: number) => {
        const isCurrentlyExpanded = expandedId === id;
        setExpandedId(isCurrentlyExpanded ? null : id);

        // 확장할 때만 컨테이너 내부에서 스크롤
        if (!isCurrentlyExpanded && listRef.current && itemRefs.current[id]) {
            setTimeout(() => {
                const container = listRef.current;
                const element = itemRefs.current[id];
                if (container && element) {
                    const offsetTop = element.offsetTop - container.offsetTop;
                    container.scrollTo({ top: offsetTop, behavior: 'smooth' });
                }
            }, 50);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, id: number) => {
        const item = itemRefs.current[id];
        if (!item) return;

        const rect = item.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        item.style.setProperty('--mouse-x', `${x}px`);
        item.style.setProperty('--mouse-y', `${y}px`);
    };

    if (loading) return <div className="news-loading">Loading news...</div>;

    if (!news || news.length === 0) {
        return (
            <div className="news-section">
                <h3 className="news-section-title">관심 기업 최신 뉴스</h3>
                <div className="news-empty">
                    <p>관심 기업 뉴스가 없습니다.</p>
                    <p className="news-empty-sub">기업 상세 페이지에서 관심기업을 추가해보세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="news-section">
            <h3 className="news-section-title">관심 기업 최신 뉴스</h3>
            <div className="news-list" ref={listRef}>
                {news.map((item) => {
                    const isExpanded = expandedId === item.id;

                    return (
                        <div
                            key={item.id}
                            ref={(el) => { itemRefs.current[item.id] = el; }}
                            className={`news-item ${isExpanded ? 'expanded' : ''}`}
                            onMouseMove={(e) => handleMouseMove(e, item.id)}
                        >
                            <div className="news-gradient-border"></div>
                            <div className="news-spotlight"></div>

                            {/* 기사 헤더 (클릭 가능) */}
                            <div
                                className="news-header"
                                onClick={() => handleItemClick(item.id)}
                            >
                                <div className="news-logo">
                                    {item.logo_url ? (
                                        <img src={item.logo_url} alt={item.ticker} onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }} />
                                    ) : (
                                        <div className="news-logo-placeholder">{item.ticker?.[0]}</div>
                                    )}
                                </div>
                                <div className="news-headline">
                                    <span className="news-title">{item.title}</span>
                                    <span className="news-meta">
                                        • {new Date(item.publishedDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className={`news-expand-icon ${isExpanded ? 'rotated' : ''}`}>
                                    ▼
                                </div>
                            </div>

                            {/* 확장된 내용 (클릭 시 표시) */}
                            {isExpanded && (
                                <div className="news-expanded">
                                    <p className="news-summary">{item.summary}</p>
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="news-link"
                                    >
                                        원문 기사 보기
                                    </a>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
