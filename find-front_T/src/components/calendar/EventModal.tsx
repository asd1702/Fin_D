import React, { useState } from 'react';
import { CalendarEvent } from '../../types/calendar';
import { userDataApi } from '../../services/api/userDataApi';
import './EventModal.css';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  events: CalendarEvent[];
  onEventAdded?: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, date, events, onEventAdded }) => {
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateForApi = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await userDataApi.addEvent({
        title: title.trim(),
        date: formatDateForApi(date),
        time: time || undefined,
        description: description || undefined,
        event_type: eventType
      });

      // Reset form
      setTitle('');
      setTime('');
      setDescription('');
      setEventType('personal');
      setIsAddingEvent(false);

      // Notify parent to refresh events
      if (onEventAdded) {
        onEventAdded();
      }
    } catch (error) {
      console.error('Failed to add event:', error);
      alert('일정 추가에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) {
      return;
    }

    setDeletingEventId(eventId);
    try {
      await userDataApi.removeEvent(Number(eventId));
      
      // Notify parent to refresh events
      if (onEventAdded) {
        onEventAdded();
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('일정 삭제에 실패했습니다.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleClose = () => {
    setIsAddingEvent(false);
    setTitle('');
    setTime('');
    setDescription('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{formatDate(date)}</h3>
          <button className="close-btn" onClick={handleClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* 기존 이벤트 목록 */}
          {events.length === 0 && !isAddingEvent ? (
            <p className="no-events">이 날에 등록된 일정이 없습니다.</p>
          ) : (
            <div className="modal-events-list">
              {events.map(event => (
                <div key={event.id} className={`modal-event-item ${event.type}`}>
                  {event.companySymbol && (
                    <img 
                      src={`https://financialmodelingprep.com/images-New-jpg/${event.companySymbol}.jpg`}
                      alt={event.companySymbol}
                      className="company-logo"
                      onError={(e) => {
                        // 로고 로딩 실패 시 기본 이미지 또는 숨김 처리
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="event-details">
                    <h4 className="event-title">
                      {event.companySymbol && <span className="company-symbol">{event.companySymbol}</span>}
                      {event.title}
                    </h4>
                    {event.description && <p className="event-description">{event.description}</p>}
                    <span className="event-type-tag">{event.type === 'earnings_auto' ? 'EARNINGS' : event.type.toUpperCase()}</span>
                  </div>
                  <button
                    className="delete-event-btn"
                    onClick={() => handleDelete(event.id)}
                    disabled={deletingEventId === event.id}
                    title="일정 삭제"
                  >
                    {deletingEventId === event.id ? '...' : '×'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 일정 추가 폼 */}
          {isAddingEvent ? (
            <form className="add-event-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">제목 *</label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="일정 제목을 입력하세요"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="time">시간</label>
                <input
                  type="text"
                  id="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="예: 14:00, 오후 2시"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">설명</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="일정에 대한 설명 (선택사항)"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="eventType">유형</label>
                <select
                  id="eventType"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                >
                  <option value="personal">개인</option>
                  <option value="earnings">실적발표</option>
                  <option value="economic">경제지표</option>
                  <option value="conference">컨퍼런스</option>
                  <option value="dividend">배당</option>
                </select>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsAddingEvent(false)}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isSubmitting || !title.trim()}
                >
                  {isSubmitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="add-event-trigger"
              onClick={() => setIsAddingEvent(true)}
            >
              + 일정 추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
