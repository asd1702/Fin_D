import { useRef } from 'react';
import { useChartStore } from '@/store/useChartSettingsStore';
import { useChartData } from '../lib/useChartData';
import { useChart } from '../lib/useChart';
import { CHART_HEIGHT, VOLUME_CHART_HEIGHT } from '@/shared/config/chart';
import { TimeframeSelector } from '@/components/chart-settings/TimeframeSelector';
import './AdvancedChartWidget.css';

interface AdvancedChartWidgetProps {
  symbol: string;
}

export const AdvancedChartWidget = ({ symbol }: AdvancedChartWidgetProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  const timeframe = useChartStore((state) => state.timeframe);
  const { data, loadMoreHistory, isLoading } = useChartData(symbol, timeframe);

  useChart(
    chartContainerRef,
    volumeContainerRef,
    data,
    timeframe,
    loadMoreHistory
  );

  return (
    <div className="advanced-chart-container">
      {/* 타임프레임 선택기 */}
      <div className="chart-controls">
        <TimeframeSelector />
      </div>

      {/* 메인 차트 */}
      <div 
        ref={chartContainerRef} 
        className="chart-main"
        style={{ 
          height: `${CHART_HEIGHT}px`,
          opacity: isLoading && data.length === 0 ? 0.3 : 1,
          transition: 'opacity 0.15s ease-in-out'
        }}
      />
      
      {/* 거래량 차트 */}
      <div 
        ref={volumeContainerRef} 
        className="chart-volume"
        style={{ 
          height: `${VOLUME_CHART_HEIGHT}px`,
          opacity: isLoading && data.length === 0 ? 0.3 : 1,
          transition: 'opacity 0.15s ease-in-out'
        }}
      />
      
      {/* 로딩 오버레이 */}
      {isLoading && data.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#888',
          fontSize: '14px'
        }}>
          차트 로딩 중...
        </div>
      )}
    </div>
  );
};
