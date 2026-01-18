import { useState, useEffect } from 'react';
import { notificationApi, Notification } from '../../services/api/notificationApi';
import './Alerts.css';

type TabType = 'all' | 'calendar' | 'economic';

export default function Alerts() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await notificationApi.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleCardClick = (notification: Notification) => {
    if (notification.is_read === 0) {
      handleMarkAsRead(notification.id);
    }
    setExpandedId(expandedId === notification.id ? null : notification.id);
  };

  // Extract time string like "22:31" if available, or format strictly
  const getTimeString = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  // Format for display date/relative time 
  const getSubInfoString = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return '오늘';
    }
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  };




  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    return n.notification_type === activeTab;
  });

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  if (loading) {
    return (
      <div className="alerts-page">
        <div className="alerts-loading">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <h1 className="alerts-title">알림</h1>
        {unreadCount > 0 && (
          <div className="alerts-actions">
            <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
              모두 읽음 처리
            </button>
          </div>
        )}
      </div>

      <div className="alerts-tabs">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          전체
        </button>
        <button
          className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          일정
        </button>
        <button
          className={`tab-btn ${activeTab === 'economic' ? 'active' : ''}`}
          onClick={() => setActiveTab('economic')}
        >
          경제지표
        </button>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="alerts-empty">
          {/* Simple cleaner empty state */}
          <p className="alerts-empty-text">표시할 알림이 없습니다.</p>
        </div>
      ) : (
        <div className="alerts-list">
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`alert-card ${notification.is_read === 0 ? 'unread' : ''}`}
              onClick={() => handleCardClick(notification)}
            >
              <div className="alert-time-pill">
                {getTimeString(notification.created_at)}
              </div>

              <div className="alert-main-content">
                <div className="alert-header-row">
                  <h3 className="alert-title">{notification.title}</h3>
                  <button
                    className="alert-delete-btn"
                    onClick={(e) => handleDelete(notification.id, e)}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>

                {notification.content && (
                  <div className={`alert-body ${expandedId === notification.id ? 'expanded' : ''}`}>
                    {notification.content}
                  </div>
                )}

                <div className="alert-footer">
                  <span className="alert-sub-info">
                    {getSubInfoString(notification.created_at)} · {notification.notification_type === 'calendar' ? '일정' : '경제지표'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
