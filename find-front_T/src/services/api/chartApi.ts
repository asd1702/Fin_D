import type { UTCTimestamp } from 'lightweight-charts';
import type { ChartData, CandleDataDTO } from '@/types/candle';
import { UP_COLOR, DOWN_COLOR, API_BASE_URL } from '@/shared/config/chart';

// 타임프레임별 기본 조회 개수 (서버 제한과 일치)
const DEFAULT_LIMITS: Record<string, number> = {
  '1m': 300,
  '5m': 600,
  '15m': 800,
  '1h': 800,
  '4h': 800,
  '1D': 600,
  '1W': 400,
  '1M': 200,
};

const getDefaultLimit = (timeframe: string) => DEFAULT_LIMITS[timeframe] ?? 300;

export const fetchHistoricalCandles = async (
  symbol: string,
  timeframe: string,
  toTimestamp?: number,
  fromTimestamp?: number,
  limitOverride?: number,
  signal?: AbortSignal
): Promise<ChartData[]> => {
  const limit = limitOverride ?? getDefaultLimit(timeframe);
  const params = new URLSearchParams({ limit: String(limit) });

  if (toTimestamp) {
    params.append('to', toTimestamp.toString());
  }
  if (fromTimestamp) {
    params.append('from', fromTimestamp.toString());
  }

  const resp = await fetch(
    `${API_BASE_URL}/api/candles/${encodeURIComponent(symbol)}/${timeframe}?${params.toString()}`,
    { signal }
  );
  
  if (!resp.ok) {
    throw new Error('Failed to fetch historical data');
  }

  const json = await resp.json();
  const data = (json.data || []) as CandleDataDTO[];

  return data
    .filter(d => {
      // Null 안전성 검증
      if (d.open == null || d.high == null || d.low == null || d.close == null || d.volume == null) {
        console.warn('Invalid candle data filtered out:', d);
        return false;
      }
      return true;
    })
    .map(d => ({
      candle: {
        time: d.time as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
      },
      volume: {
        time: d.time as UTCTimestamp,
        value: d.volume,
        color: d.close >= d.open ? UP_COLOR : DOWN_COLOR
      }
    }))
    .sort((a, b) => a.candle.time - b.candle.time);
};
