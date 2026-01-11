import { useState, useEffect, useRef } from 'react';
import { newsApi, NewsItem } from '@/services/api/newsApi';
import './NewsSection.css'; // NewsSection과 동일한 스타일 사용

export default function EconomicNewsSection() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    useEffect(() => {
        const fetchNews = async () => {
            try {
                console.log('[EconomicNews] Fetching news...');
                const data = await newsApi.getGeneralNews();
                console.log('[EconomicNews] Received data:', data);
                setNews(data);
            } catch (error) {
                console.error('[EconomicNews] Failed to fetch news:', error);
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
                <h3 className="news-section-title">주요 경제 뉴스</h3>
                <div className="news-empty">
                    <p>경제 뉴스가 없습니다.</p>
                    <p className="news-empty-sub">뉴스 데이터를 불러오는 중이거나 아직 수집되지 않았습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="news-section">
            <h3 className="news-section-title">주요 경제 뉴스</h3>
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
                                    {/* 경제 뉴스는 로고 대신 뉴스 아이콘 */}
                                    <div className="news-logo-placeholder">📰</div>
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
