import React from 'react';
import { CalendarDay as CalendarDayType } from '../../types/calendar';
import { EventChip } from './EventChip';

interface CalendarDayProps {
  day: CalendarDayType;
  onDayClick: (day: CalendarDayType) => void;
}

export const CalendarDay: React.FC<CalendarDayProps> = ({ day, onDayClick }) => {
  // 다른 달의 날짜는 렌더링하지 않음
  if (!day.isCurrentMonth) {
    return <div className="calendar-day other-month"></div>;
  }

  // 화면 크기에 따라 다르겠지만, 대략 2~3개 정도만 보여주고 나머지는 +N 처리
  const MAX_VISIBLE_EVENTS = 2;
  const visibleEvents = day.events.slice(0, MAX_VISIBLE_EVENTS);
  const hiddenCount = day.events.length - MAX_VISIBLE_EVENTS;

  return (
    <div 
      className={`calendar-day ${day.isToday ? 'today' : ''}`}
      onClick={() => onDayClick(day)}
    >
      <div className="day-number">{day.date.getDate()}</div>
      <div className="events-list">
        {visibleEvents.map(event => (
          <EventChip key={event.id} event={event} />
        ))}
        {hiddenCount > 0 && (
          <div className="more-events-indicator">
            + {hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
};
