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

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const getIcon = (type: string) => {
    return type === 'calendar' ? '📅' : '📊';
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    return n.notification_type === activeTab;
  });

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  if (loading) {
    return (
      <div className="alerts-page">
        <div className="alerts-loading">알림을 불러오는 중...</div>
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
          <div className="alerts-empty-icon">🔔</div>
          <p className="alerts-empty-text">알림이 없습니다</p>
        </div>
      ) : (
        <div className="alerts-list">
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`alert-card ${notification.is_read === 0 ? 'unread' : ''}`}
              onClick={() => handleCardClick(notification)}
            >
              <button
                className="alert-delete-btn"
                onClick={(e) => handleDelete(notification.id, e)}
              >
                ×
              </button>

              <div className="alert-header">
                <span className="alert-icon">{getIcon(notification.notification_type)}</span>
                <span className="alert-title">{notification.title}</span>
                <span className="alert-time">{formatTime(notification.created_at)}</span>
              </div>

              {notification.content && (
                <div className={`alert-content ${expandedId !== notification.id ? 'collapsed' : ''}`}>
                  {notification.content}
                </div>
              )}

              <span className={`alert-type-tag ${notification.notification_type}`}>
                {notification.notification_type === 'calendar' ? '일정' : '경제지표'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
