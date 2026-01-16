import './Dashboard.css';
import { Calendar } from '../../components/calendar/Calendar';
import NewsSection from '../../components/dashboard/NewsSection';
import FavoriteCompanies from '../../components/dashboard/FavoriteCompanies';
import EconomicNewsSection from '../../components/dashboard/EconomicNewsSection';

export default function Dashboard() {
  return (
    <div className="dashboard">
      {/* 페이지 헤더 */}
      <div className="dashboard-header">
        <h1 className="dashboard-title"></h1>
        <p className="dashboard-subtitle"></p>
      </div>

      <div className="dashboard-content" style={{ minHeight: 'calc(100vh - 150px)', paddingBottom: '20px' }}>
        <div id="section-news">
          <NewsSection />
        </div>
        <div id="section-favorites">
          <FavoriteCompanies />
        </div>
        <div id="section-calendar">
          <Calendar />
        </div>
        <div id="section-economic">
          <EconomicNewsSection />
        </div>
        {/* 스크롤 여유 공간 */}
        <div style={{ height: '60vh' }} />
      </div>
    </div>
  );
}

