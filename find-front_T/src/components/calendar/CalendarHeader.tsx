import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { userDataApi } from '../../services/api/userDataApi';

interface CalendarHeaderProps {
  currentDate: Date;
  onNext: () => void;
  onPrev: () => void;
  onToday: () => void;
  onEventsImported?: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({ 
  currentDate, 
  onNext, 
  onPrev, 
  onToday,
  onEventsImported 
}) => {
  const [importing, setImporting] = useState(false);

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const formatDate = (date: Date) => {
    return `${monthNames[date.getMonth()].substring(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleImportFavorites = async () => {
    setImporting(true);
    try {
      const result = await userDataApi.importFavoriteEarnings(30);
      
      const earningsCount = result.summary.earnings.events_added;
      const economicCount = result.summary.economic_events.events_added;
      
      if (earningsCount === 0 && economicCount === 0) {
        toast.info('가져올 새로운 일정이 없습니다.');
      } else {
        toast.success(result.message);
      }
      
      // 캘린더 리프레시
      if (onEventsImported) {
        onEventsImported();
      }
    } catch (error) {
      console.error('Failed to import favorites:', error);
      toast.error('일정 가져오기 실패');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="calendar-header">
      <div className="header-left">
        <h2 className="current-month-title">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <span className="date-range-subtitle">
          {formatDate(startOfMonth)} - {formatDate(endOfMonth)}
        </span>
      </div>

      <div className="header-controls">
        <button 
          onClick={handleImportFavorites} 
          className="import-favorites-btn"
          disabled={importing}
        >
          {importing ? '가져오는 중...' : '관심기업 일정 추가'}
        </button>

        <input type="text" placeholder="Search" className="search-bar" />

        <div className="nav-group">
          <button onClick={onPrev} className="nav-btn">←</button>
          <button onClick={onToday} className="nav-btn" style={{ fontSize: '12px', fontWeight: 500 }}>Today</button>
          <button onClick={onNext} className="nav-btn">→</button>
        </div>
      </div>
    </div>
  );
};
