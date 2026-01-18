import apiClient from './client';

export interface UserFavorite {
    id: number;
    user_id: number;
    ticker: string;
    created_at: string;
}

export interface UserEvent {
    id: number;
    user_id: number;
    title: string;
    date: string; // YYYY-MM-DD
    time?: string;
    ticker?: string;
    description?: string;
    event_type: string;
}

export interface ImportFavoritesResponse {
    success: boolean;
    message: string;
    summary: {
        earnings: {
            total_favorites: number;
            events_added: number;
            events_skipped: number;
            failed_tickers: string[];
        };
        economic_events: {
            events_added: number;
            events_skipped: number;
        };
    };
}

export const userDataApi = {
    // Favorites
    getFavorites: async (): Promise<UserFavorite[]> => {
        const response = await apiClient.get('/user/favorites');
        return response.data;
    },

    addFavorite: async (ticker: string) => {
        const response = await apiClient.post('/user/favorites', { ticker });
        return response.data;
    },

    removeFavorite: async (ticker: string) => {
        const response = await apiClient.delete(`/user/favorites/${ticker}`);
        return response.data;
    },

    // Events
    getEvents: async (): Promise<UserEvent[]> => {
        const response = await apiClient.get('/user/events');
        return response.data;
    },

    addEvent: async (event: Omit<UserEvent, 'id' | 'user_id'>) => {
        const response = await apiClient.post('/user/events', event);
        return response.data;
    },

    removeEvent: async (eventId: number) => {
        const response = await apiClient.delete(`/user/events/${eventId}`);
        return response.data;
    },

    // Import Favorites to Calendar
    importFavoriteEarnings: async (daysAhead: number = 30): Promise<ImportFavoritesResponse> => {
        const response = await apiClient.post('/user/events/import-favorites', { days_ahead: daysAhead });
        return response.data;
    }
};
