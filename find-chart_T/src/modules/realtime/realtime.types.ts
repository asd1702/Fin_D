import { Candle } from '../candle/candle.types';

// WebSocket 메시지 타입
export interface CandleSubscriptionMessage {
  type: 'candle';
  timeframe: string;
  candle: Candle;
}

export interface PriceTickMessage {
  type: 'tick';
  symbol: string;
  price: number;
  timestamp: number; // epoch seconds
}

export type OutboundSocketMessage = CandleSubscriptionMessage | PriceTickMessage;

export interface SubscribeMessage {
  type: 'subscribe';
  symbols: string[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  symbols: string[];
}

export type InboundSocketMessage = SubscribeMessage | UnsubscribeMessage;

// TwelveData 관련 타입
export interface TwelveDataPriceMessage {
  event: 'price';
  symbol: string;
  price: number;
  timestamp: number;
}

export interface TwelveDataSubscription {
  action: 'subscribe' | 'unsubscribe';
  params: {
    symbols: string;
  };
}
