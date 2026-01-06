// 공통 타입 정의

export interface Company {
  ticker: string
  companyName: string
  k_name?: string  // 한글 기업명
  description?: string
  industry?: string
  sector?: string
  website?: string
  logo_url?: string  // FMP image URL 또는 Clearbit URL
}

export interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap?: number
}

export interface FinancialMetric {
  report_date: string
  pe_ratio?: number
  price_to_book_ratio?: number
  return_on_equity?: number
  return_on_assets?: number
  debt_to_equity?: number
  dividend_yield?: number
  current_ratio?: number
  peg_ratio?: number
  forward_pe?: number
  price_to_sales_ratio?: number
  market_cap?: number
}

export interface IncomeStatement {
  report_date: string
  report_year?: number
  revenue?: number
  net_income?: number
  gross_profit?: number
  operating_income?: number
  eps?: number
}

export interface AnalystRating {
  date: string
  strong_buy: number
  buy: number
  hold: number
  sell: number
  strong_sell: number
  price_target?: number
}

export interface NewsArticle {
  title: string
  summary: string
  url: string
  publishedDate: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  widgets?: Widget[] // [NEW] 시각화 위젯 데이터
}

// --- Server-Driven UI Widgets ---

export type WidgetType =
  | 'gauge_chart'
  | 'sparkline_card'
  | 'donut_chart'
  | 'data_table'
  | 'markdown_text'
  | 'comprehensive_valuation'
  | 'analyst_card'
  | 'metrics_grid'
  | 'insight_card'
  | 'financial_chart'
  | 'financial_table'
  | 'health_analysis'

export interface Widget {
  type: WidgetType
  title?: string
  description?: string
}

export interface GaugeChart extends Widget {
  type: 'gauge_chart'
  min: number
  max: number
  value: number
  average?: number
  color: string
  label: string
}

export interface SparklineCard extends Widget {
  type: 'sparkline_card'
  label: string
  value: string | number
  trend_history: number[]
  change?: string
  status: 'good' | 'bad' | 'neutral'
}

export interface DonutChart extends Widget {
  type: 'donut_chart'
  segments: { label: string; value: number; color: string }[]
  total_label?: string
  total_value?: string
}

export interface DataTable extends Widget {
  type: 'data_table'
  columns: { key: string; label: string }[]
  rows: Record<string, any>[]
}

export interface MarkdownText extends Widget {
  type: 'markdown_text'
  content: string
}

export interface ValuationMetric {
  label: string
  value: string
  comparison?: string
  trend: 'up' | 'down' | 'flat'
  status: 'good' | 'bad' | 'neutral'
}

export interface ComprehensiveValuationWidget extends Widget {
  type: 'comprehensive_valuation'
  ticker: string
  price: string
  change: string
  badges: string[]
  score: number
  status: 'good' | 'neutral' | 'bad' | 'warning'
  summary: string
  metrics: ValuationMetric[]
}


// --- Dashboard Widgets ---

export interface AnalystCardWidget extends Widget {
  type: "analyst_card";
  consensus_rating: string;
  consensus_score: number;
  target_price: number;
  current_price: number;
  upside_percent: number;
  analyst_count: number;
  distribution: {
    strong_buy: number;
    buy: number;
    hold: number;
    sell: number;
    strong_sell: number;
  };
}

export interface MetricItem {
  label: string;
  value: any;
  formatted: string;
  sub_text?: string;
  status?: "good" | "bad" | "neutral" | "warning";
  trend?: "up" | "down" | "flat";
}

export interface MetricsGridWidget extends Widget {
  type: "metrics_grid";
  items: MetricItem[];
}

// --- Financial Statements Widgets ---

export interface InsightCardWidget extends Widget {
  type: "insight_card";
  title?: string;
  highlights: string[];
  metrics: Array<{
    label: string;
    value: string;
    status: "good" | "bad" | "neutral" | "warning";
    trend?: "up" | "down" | "flat";
  }>;
}

export interface FinancialChartSeries {
  id: string;
  label: string;
  type: "bar" | "line" | "area";
  axis: "left" | "right";
  color: string;
  value_key: string;
}

export interface FinancialChartWidget extends Widget {
  type: "financial_chart";
  chart_type: "composed" | "bar" | "line" | "stacked";
  metric: "income" | "balance" | "cash_flow";
  x_key: string;
  series: FinancialChartSeries[];
  data: Record<string, any>[];
}

export interface FinancialTableColumn {
  key: string;
  label: string;
  width?: number;
  pin?: "left" | "right";
  format?: "currency" | "percent" | "number";
  muted?: boolean;
}

export interface FinancialTableRow {
  id: string;
  label: string;
  [key: string]: any; // Dynamic columns (2024, 2023, etc.)
  children?: FinancialTableRow[];
}

export interface FinancialTableWidget extends Widget {
  type: "financial_table";
  metric: "income" | "balance" | "cash_flow";
  period_type: "annual" | "quarter";
  columns: FinancialTableColumn[];
  rows: FinancialTableRow[];
}

export interface HealthScoreComponent {
  score: number;
  label: string;
  details: string;
}

export interface HealthAnalysisWidget extends Widget {
  type: "health_analysis";
  total: number;
  summary: string;
  profitability: HealthScoreComponent;
  stability: HealthScoreComponent;
  growth: HealthScoreComponent;
}

export interface FinancialStatementsView {
  view_type: "financial_report";
  sub_tabs: Array<{ id: string; label: string }>;
  active_sub_tab: string;
  as_of?: string;
  currency?: string;
  widgets: Array<InsightCardWidget | FinancialChartWidget | FinancialTableWidget>;
}
