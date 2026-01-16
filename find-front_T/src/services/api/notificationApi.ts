import apiClient from './client';

export interface Notification {
    id: number;
    user_id: number;
    title: string;
    content?: string;
    notification_type: 'calendar' | 'economic';
    is_read: number;
    related_event_id?: number;
    economic_event?: string;
    created_at: string;
}

export const notificationApi = {
    // 알림 목록 조회
    getNotifications: async (limit: number = 50): Promise<Notification[]> => {
        const response = await apiClient.get('/notifications', {
            params: { limit }
        });
        return response.data;
    },

    // 읽지 않은 알림 수
    getUnreadCount: async (): Promise<{ unread_count: number }> => {
        const response = await apiClient.get('/notifications/unread-count');
        return response.data;
    },

    // 알림 읽음 처리
    markAsRead: async (notificationId: number): Promise<void> => {
        await apiClient.put(`/notifications/${notificationId}/read`);
    },

    // 모든 알림 읽음 처리
    markAllAsRead: async (): Promise<void> => {
        await apiClient.put('/notifications/read-all');
    },

    // 알림 삭제
    deleteNotification: async (notificationId: number): Promise<void> => {
        await apiClient.delete(`/notifications/${notificationId}`);
    }
};
