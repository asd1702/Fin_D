import apiClient from './client';

export interface NewsItem {
    id: number;
    title: string;
    summary?: string;
    url: string;
    publishedDate: string;
    ticker?: string;
    logo_url?: string;
}

export const newsApi = {
    // 사용자의 관심 기업 뉴스 조회
    getFavoriteNews: async (limit: number = 20): Promise<NewsItem[]> => {
        const response = await apiClient.get('/news/favorites', {
            params: { limit }
        });
        return response.data;
    },

    // 일반 경제/국제 뉴스 조회
    getGeneralNews: async (limit: number = 20): Promise<NewsItem[]> => {
        const response = await apiClient.get('/news/general', {
            params: { limit }
        });
        return response.data;
    },

    // 일반 뉴스 수집 트리거 (관리자용)
    triggerGeneralNewsFetch: async (): Promise<{ status: string; message: string }> => {
        const response = await apiClient.post('/news/trigger-general-news');
        return response.data;
    }
};
