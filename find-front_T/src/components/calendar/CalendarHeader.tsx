import React from 'react';

interface CalendarHeaderProps {
  currentDate: Date;
  onNext: () => void;
  onPrev: () => void;
  onToday: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({ currentDate, onNext, onPrev, onToday }) => {
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const formatDate = (date: Date) => {
    return `${monthNames[date.getMonth()].substring(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
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
