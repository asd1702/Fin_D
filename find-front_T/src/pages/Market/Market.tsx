import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdvancedChartWidget } from '@/widgets/advanced-chart';
import { useQuoteSummary, useIndicatorSummary, useFearGreed, usePerformance, useSeasonal } from '@/shared/api/useQuotes';
import type { QuoteItem } from '@/shared/api/useQuotes';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Market.css';

// 심볼별 태그 매핑
const SYMBOL_TAGS: Record<string, string> = {
  'QQQ': 'ETF',
  'SPY': 'ETF',
  'DIA': 'ETF',
  'BTC/USD': 'Crypto',
};

// 숫자 포맷팅
const formatNumber = (num: number, decimals = 2): string => {
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

const formatChange = (change: number, decimals = 2): string => {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${formatNumber(change, decimals)}`;
};

export default function Market() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSymbol, setSelectedSymbol] = useState(searchParams.get('symbol') || '');
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: quotes, isLoading } = useQuoteSummary();
  const { data: indicators, isLoading: indicatorsLoading } = useIndicatorSummary(selectedSymbol);
  const { data: fearGreed, isLoading: fearGreedLoading } = useFearGreed(selectedSymbol);
  const { data: performance, isLoading: performanceLoading } = usePerformance(selectedSymbol);
  const { data: seasonal, isLoading: seasonalLoading } = useSeasonal(selectedSymbol, 3);

  const indices = quotes?.indices ?? [];
  const forex = quotes?.forex ?? [];
  const metals = quotes?.metals ?? [];
  const energy = quotes?.energy ?? [];

  // URL 파라미터 변경 시 선택된 심볼 업데이트
  useEffect(() => {
    const urlSymbol = searchParams.get('symbol');
    if (urlSymbol && urlSymbol !== selectedSymbol) {
      setSelectedSymbol(urlSymbol);
      setIsExpanded(true);
    }
  }, [searchParams, selectedSymbol]);

  // 심볼 변경 시 URL 업데이트 및 토글
  const handleSymbolChange = (symbol: string) => {
    if (selectedSymbol === symbol) {
      // 같은 버튼 클릭 시 접기
      setIsExpanded(!isExpanded);
    } else {
      // 다른 버튼 클릭 시 심볼 변경 및 펼치기
      setSelectedSymbol(symbol);
      setSearchParams({ symbol });
      setIsExpanded(true);
    }
  };

  // Recharts용 데이터 변환
  const chartData = useMemo(() => {
    if (!seasonal || !seasonal.years) return [];

    const dataMap = new Map<number, { day: number; [key: string]: number }>();
    
    seasonal.years.forEach(yearData => {
      yearData.data.forEach(point => {
        if (!dataMap.has(point.dayOfYear)) {
          dataMap.set(point.dayOfYear, { day: point.dayOfYear });
        }
        const entry = dataMap.get(point.dayOfYear)!;
        entry[yearData.year] = point.value;
      });
    });
    
    return Array.from(dataMap.values()).sort((a, b) => a.day - b.day);
  }, [seasonal]);

  const chartColors = ['#f0b90b', '#26a69a', '#2962ff'];

  return (
    <div className="market-analysis">
      {/* 페이지 헤더 */}
      <div className="market-header">
        <h1 className="market-title"></h1>
        <p className="market-subtitle"></p>
      </div>

      {/* 심볼 선택 버튼들 */}
      <div className="symbol-selector">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="symbol-button skeleton" />
          ))
        ) : (
          indices.map((item: QuoteItem) => (
            <div
              key={item.symbol}
              className={`symbol-button ${selectedSymbol === item.symbol ? 'active' : ''}`}
              onClick={() => handleSymbolChange(item.symbol)}
              style={{ cursor: 'pointer' }}
            >
              <div className="symbol-button-header">
                <span className="symbol-button-name">{item.name}</span>
                <span className="symbol-button-tag">{SYMBOL_TAGS[item.symbol]}</span>
              </div>
              <div className="symbol-button-value">{formatNumber(item.price)}</div>
              <div className={`symbol-button-change ${item.isUp ? 'up' : 'down'}`}>
                {item.isUp ? '▲' : '▼'} {formatChange(item.changePercent)}%
              </div>
            </div>
          ))
        )}
      </div>

      {/* 메인 차트 영역 */}
      {isExpanded && selectedSymbol && (
        <>
          <div className="chart-section">
            <AdvancedChartWidget key={selectedSymbol} symbol={selectedSymbol} />
          </div>

          {/* 퍼포먼스 & 시계열 데이터 */}
          <div className="analysis-section">
        {/* 퍼포먼스 카드 */}
        <div className="analysis-card">
          <div className="analysis-card-header">
            <span className="analysis-card-title">퍼포먼스</span>
          </div>
          <div className="analysis-card-content">
            {performanceLoading ? (
              <div className="performance-grid">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="performance-item skeleton" />
                ))}
              </div>
            ) : performance ? (
              <div className="performance-grid">
                <div className="performance-item">
                  <span className="performance-label">1주</span>
                  <span className={`performance-value ${(performance.performance['1W']?.value ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {(performance.performance['1W']?.value ?? 0) >= 0 ? '+' : ''}{(performance.performance['1W']?.value ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">1개월</span>
                  <span className={`performance-value ${(performance.performance['1M']?.value ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {(performance.performance['1M']?.value ?? 0) >= 0 ? '+' : ''}{(performance.performance['1M']?.value ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">3개월</span>
                  <span className={`performance-value ${(performance.performance['3M']?.value ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {(performance.performance['3M']?.value ?? 0) >= 0 ? '+' : ''}{(performance.performance['3M']?.value ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">6개월</span>
                  <span className={`performance-value ${(performance.performance['6M']?.value ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {(performance.performance['6M']?.value ?? 0) >= 0 ? '+' : ''}{(performance.performance['6M']?.value ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">YTD</span>
                  <span className={`performance-value ${(performance.performance.YTD?.value ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {(performance.performance.YTD?.value ?? 0) >= 0 ? '+' : ''}{(performance.performance.YTD?.value ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="performance-item">
                  <span className="performance-label">1년</span>
                  <span className={`performance-value ${(performance.performance['1Y']?.value ?? 0) >= 0 ? 'up' : 'down'}`}>
                    {(performance.performance['1Y']?.value ?? 0) >= 0 ? '+' : ''}{(performance.performance['1Y']?.value ?? 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-message">데이터 없음</div>
            )}
          </div>
        </div>

        {/* 시계열 데이터 카드 */}
        <div className="analysis-card">
          <div className="analysis-card-header">
            <span className="analysis-card-title">시계열</span>
          </div>
          <div className="analysis-card-content">
            {seasonalLoading ? (
              <div className="skeleton-line" style={{ width: '100%', height: '250px' }} />
            ) : seasonal && seasonal.years.length > 0 ? (
              <div className="timeseries-chart-container" style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      type="number" 
                      domain={[1, 365]} 
                      tickFormatter={(day) => {
                        const date = new Date(2024, 0, day);
                        return date.toLocaleDateString('ko-KR', { month: 'short' });
                      }}
                      stroke="#666"
                      tick={{ fontSize: 11 }}
                      ticks={[1, 91, 182, 274, 365]} // 분기별 표시
                    />
                    <YAxis 
                      stroke="#666" 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px' }}
                      labelStyle={{ color: '#888', marginBottom: '4px' }}
                      labelFormatter={(day) => {
                        const date = new Date(2024, 0, Number(day));
                        return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
                      }}
                      formatter={(value: number, name: string) => [`${(value ?? 0).toFixed(2)}%`, `${name}년`]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    {seasonal.years.map((yearData, idx) => (
                      <Line
                        key={yearData.year}
                        type="monotone"
                        dataKey={yearData.year}
                        name={String(yearData.year)}
                        stroke={chartColors[idx % chartColors.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-message">데이터 없음</div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 지표 위젯 (공포탐욕, RSI, MACD) */}
      <div className="indicator-widgets">
        {/* 공포탐욕 지수 */}
        <div className="widget-card">
          <div className="widget-header">
            <span>공포 및 탐욕 지수</span>
            <span className="widget-info">ⓘ</span>
          </div>
          <div className="widget-content fear-greed-content">
            {fearGreedLoading ? (
              <div className="fear-greed-loading">
                <div className="skeleton-line" style={{ width: '100%', height: '120px', borderRadius: '60px 60px 0 0' }} />
              </div>
            ) : fearGreed ? (
              <div className="fear-greed-gauge">
                <svg viewBox="0 0 200 120" className="gauge-svg" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="gaugeGradientMarket" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="25%" stopColor="#f97316" />
                      <stop offset="50%" stopColor="#eab308" />
                      <stop offset="75%" stopColor="#84cc16" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                  <path d="M 15 100 A 85 85 0 0 1 185 100" fill="none" stroke="url(#gaugeGradientMarket)" strokeWidth="14" strokeLinecap="round" />
                  {(() => {
                    const angle = Math.PI * (1 - (fearGreed.value || 0) / 100);
                    const radius = 85;
                    const cx = 100 + radius * Math.cos(angle);
                    const cy = 100 - radius * Math.sin(angle);
                    return (
                      <circle cx={cx} cy={cy} r="12" fill="#1a1a1a" stroke="#ffffff" strokeWidth="3" />
                    );
                  })()}
                </svg>
                <div className="gauge-value">{fearGreed.value}</div>
                <div className="gauge-label">{fearGreed.classificationKo}</div>
              </div>
            ) : (
              <div className="empty-message">데이터 없음</div>
            )}
          </div>
        </div>

        {/* RSI */}
        <div className="widget-card indicator-widget">
          <div className="widget-header">
            <span>RSI</span>
            <span className="widget-info">ⓘ</span>
          </div>
          <div className="widget-content indicator-display">
            {indicatorsLoading ? (
              <div className="indicator-loading">
                <div className="skeleton-line" style={{ width: '40%', height: '14px' }} />
                <div className="skeleton-line" style={{ width: '60%', height: '36px' }} />
                <div className="skeleton-line" style={{ width: '50%', height: '28px' }} />
              </div>
            ) : indicators ? (
              <>
                <div className="indicator-label">평균</div>
                <div className="indicator-value">{(indicators.rsi?.value ?? 0).toFixed(2)}</div>
                <div className={`indicator-signal ${indicators.rsi?.signal ?? 'neutral'}`}>
                  {indicators.rsi.signal === 'oversold' ? '과매도' : indicators.rsi.signal === 'overbought' ? '과매수' : '중간'}
                </div>
              </>
            ) : (
              <div className="empty-message">데이터 없음</div>
            )}
          </div>
        </div>

        {/* MACD */}
        <div className="widget-card indicator-widget">
          <div className="widget-header">
            <span>MACD</span>
            <span className="widget-info">ⓘ</span>
          </div>
          <div className="widget-content indicator-display">
            {indicatorsLoading ? (
              <div className="indicator-loading">
                <div className="skeleton-line" style={{ width: '40%', height: '14px' }} />
                <div className="skeleton-line" style={{ width: '60%', height: '36px' }} />
                <div className="skeleton-line" style={{ width: '50%', height: '28px' }} />
              </div>
            ) : indicators ? (
              <>
                <div className="indicator-label">평균</div>
                <div className="indicator-value">{(indicators.macd?.histogram ?? 0).toFixed(2)}</div>
                <div className={`indicator-signal ${indicators.macd?.trend ?? 'neutral'}`}>
                  {indicators.macd.trend === 'bullish' ? '긍정적' : indicators.macd.trend === 'bearish' ? '부정적' : '중립'}
                </div>
              </>
            ) : (
              <div className="empty-message">데이터 없음</div>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Forex, Metals, Energy 섹션 - 항상 표시 */}
      <div className="all-view-grid">
        {/* 환율 */}
        <div className="widget-card">
          <div className="widget-header">
            <span>환율 (Forex)</span>
            <span className="widget-info">ⓘ</span>
          </div>
          <div className="widget-content rate-list">
            {forex.length === 0 ? (
              <div className="empty-message">데이터 없음</div>
            ) : (
              forex.map((item: QuoteItem) => (
                <div key={item.symbol} className="rate-item">
                  <div className="rate-name">
                    <span>{item.name}</span>
                    <span className="rate-pair">{item.symbol}</span>
                  </div>
                  <div className="rate-value">
                    <span>{formatNumber(item.price)}</span>
                    <span className={`rate-change ${item.isUp ? 'up' : 'down'}`}>
                      {item.isUp ? '▲' : '▼'} {formatChange(item.change)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 금속 */}
        <div className="widget-card">
          <div className="widget-header">
            <span>금속 (Metals)</span>
            <span className="widget-info">ⓘ</span>
          </div>
          <div className="widget-content rate-list">
            {metals.length === 0 ? (
              <div className="empty-message">데이터 없음</div>
            ) : (
              metals.map((item: QuoteItem) => (
                <div key={item.symbol} className="rate-item">
                  <div className="rate-name">
                    <span>{item.name}</span>
                    <span className="rate-pair">{item.symbol}</span>
                  </div>
                  <div className="rate-value">
                    <span>${formatNumber(item.price)}</span>
                    <span className={`rate-change ${item.isUp ? 'up' : 'down'}`}>
                      {item.isUp ? '▲' : '▼'} {formatChange(item.change)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 에너지 */}
        <div className="widget-card">
          <div className="widget-header">
            <span>에너지 (Energy)</span>
            <span className="widget-info">ⓘ</span>
          </div>
          <div className="widget-content rate-list">
            {energy.length === 0 ? (
              <div className="empty-message">데이터 없음</div>
            ) : (
              energy.map((item: QuoteItem) => (
                <div key={item.symbol} className="rate-item">
                  <div className="rate-name">
                    <span>{item.name}</span>
                    <span className="rate-pair">{item.symbol}</span>
                  </div>
                  <div className="rate-value">
                    <span>${formatNumber(item.price)}</span>
                    <span className={`rate-change ${item.isUp ? 'up' : 'down'}`}>
                      {item.isUp ? '▲' : '▼'} {formatChange(item.change)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

