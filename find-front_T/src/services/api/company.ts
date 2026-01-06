import apiClient from './client'
import type {
  Company,
  StockQuote,
  FinancialMetric,
  AnalystRating,
  AnalystCardWidget,
  MetricsGridWidget,
  IncomeStatement,
  FinancialStatementsView,
} from '@/types'

export const companyApi = {
  // 기업 프로필 조회
  getProfile: async (ticker: string): Promise<Company> => {
    const response = await apiClient.get(`/company/profile/${ticker}`)
    return response.data
  },

  getAllCompanies: async (limit: number = 100): Promise<Company[]> => {
    const response = await apiClient.get(`/company/list`, {
      params: { limit },
    })
    return response.data
  },

  // 주가 시세 조회
  getQuote: async (ticker: string): Promise<StockQuote> => {
    const response = await apiClient.get(`/company/quote/${ticker}`)
    return response.data
  },

  // 주요 재무 지표 조회
  getKeyMetrics: async (
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit: number = 5
  ): Promise<{ records: FinancialMetric[]; insights?: any; summary?: string }> => {
    const response = await apiClient.get(`/company/metrics/${ticker}`, {
      params: { period, limit },
    })
    return response.data
  },

  // 애널리스트 평가 조회
  getAnalystRatings: async (ticker: string): Promise<AnalystRating[]> => {
    const response = await apiClient.get(`/company/ratings/${ticker}`)
    return response.data
  },

  // 손익계산서 조회
  getIncomeStatements: async (
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit: number = 5
  ): Promise<IncomeStatement[]> => {
    const response = await apiClient.get(`/company/income-statement/${ticker}`, {
      params: { period, limit },
    })
    return response.data
  },

  // 대차대조표 조회
  getBalanceSheets: async (
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit: number = 5
  ) => {
    const response = await apiClient.get(`/company/balance-sheet/${ticker}`, {
      params: { period, limit },
    })
    return response.data
  },

  // 현금흐름표 조회
  getCashFlows: async (
    ticker: string,
    period: 'annual' | 'quarter' = 'annual',
    limit: number = 5
  ) => {
    const response = await apiClient.get(`/company/cash-flow/${ticker}`, {
      params: { period, limit },
    })
    return response.data
  },

  // 내부자 거래 조회
  getInsiderTrades: async (ticker: string, limit: number = 20) => {
    const response = await apiClient.get(`/company/insider-trading/${ticker}`, {
      params: { limit },
    })
    return response.data
  },

  // [NEW] Analyst Consensus Widget
  getAnalystConsensusWidget: async (ticker: string): Promise<AnalystCardWidget> => {
    const response = await apiClient.get(`/company/widgets/analyst-consensus/${ticker}`)
    return response.data
  },

  // [NEW] Metrics Grid Widget
  getMetricsGridWidget: async (ticker: string): Promise<MetricsGridWidget> => {
    const response = await apiClient.get(`/company/widgets/metrics-grid/${ticker}`)
    return response.data
  },

  // [NEW] Financial Statements View
  getFinancialStatementsView: async (
    ticker: string,
    subTab: string = 'income',
    period: string = 'annual',
    yearRange: number = 3
  ): Promise<FinancialStatementsView> => {
    const response = await apiClient.get(`/company/widgets/financial-statements/${ticker}`, {
      params: { sub_tab: subTab, period, year_range: yearRange },
    })
    return response.data
  },
  // [NEW] Health Analysis Widget
  getHealthAnalysisWidget: async (ticker: string) => {
    const response = await apiClient.get(`/company/widgets/health-analysis/${ticker}`)
    return response.data
  },
}
