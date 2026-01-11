import React, { useEffect, useState, useCallback } from 'react';
import './Calendar.css';
import { CalendarHeader } from './CalendarHeader';
import { CalendarDay } from './CalendarDay';
import { EventModal } from './EventModal';
import { useCalendar } from '../../hooks/useCalendar';
import { userDataApi } from '../../services/api/userDataApi';
import { CalendarEvent, CalendarDay as CalendarDayType } from '../../types/calendar';

export const Calendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const { currentDate, days, nextMonth, prevMonth, goToToday } = useCalendar(new Date(), events);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);

  // 백엔드에서 이벤트 가져오기
  const fetchEvents = useCallback(async () => {
    try {
      const data = await userDataApi.getEvents();
      // UserEvent를 CalendarEvent 형식으로 변환
      const calendarEvents: CalendarEvent[] = data.map(event => ({
        id: String(event.id),
        title: event.title,
        date: new Date(event.date),
        type: event.event_type as CalendarEvent['type'],
        time: event.time,
        description: event.description,
        companySymbol: event.ticker
      }));
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [currentDate, fetchEvents]);

  const handleDayClick = (day: CalendarDayType) => {
    setSelectedDate(day.date);
    setSelectedEvents(day.events);
    setIsModalOpen(true);
  };

  const handleEventAdded = () => {
    // 이벤트 추가 후 목록 새로고침
    fetchEvents();
    // 모달 닫기
    setIsModalOpen(false);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-container">
      <CalendarHeader
        currentDate={currentDate}
        onNext={nextMonth}
        onPrev={prevMonth}
        onToday={goToToday}
      />

      <div className="calendar-grid">
        {weekDays.map(day => (
          <div key={day} className="weekday-header">{day}</div>
        ))}

        {days.map((day, index) => (
          <CalendarDay
            key={index}
            day={day}
            onDayClick={handleDayClick}
          />
        ))}
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={selectedDate}
        events={selectedEvents}
        onEventAdded={handleEventAdded}
      />
    </div>
  );
};
