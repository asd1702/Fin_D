import type { UTCTimestamp } from 'lightweight-charts';

// DTO: 서버에서 받는 원본 데이터 형태
export interface CandleDataDTO {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 차트에서 사용하는 데이터 형태
export interface ChartData {
  candle: {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume: {
    time: UTCTimestamp;
    value: number;
    color: string;
  };
}

// WebSocket 메시지 타입
export type WSMessage = 
  | {
      type: 'candle';
      symbol: string;
      timeframe: string;
      candle: {
        startTime: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      };
    }
  | {
      type: 'tick';
      symbol: string;
      price: number | string;
      volume: number | string;
      timestamp: number;
    }
  | {
      type: 'gap_filled';
      symbol: string;
      count: number;
      from: number;
      to: number;
    }
  | {
      type: 'reconnected';
    };
