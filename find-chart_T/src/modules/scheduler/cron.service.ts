/**
 * Cron Scheduler Service - 주기적 데이터 폴링
 * 
 * WebSocket 미지원 데이터(환율, 에너지, 금속 등)를 주기적으로 수집합니다.
 * - Time Series API 사용 (정확한 OHLC 데이터)
 * - 5초 딜레이로 거래소 집계 완료 대기
 * - RocksDB pending store를 통한 저장 로직 통일
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import axios from 'axios';
import config from '../../config';
import { enqueueCandle } from '../candle/candle.persistence';
import { fearGreedService } from '../analysis/feargreed.service';
import { cnnFearGreedService } from '../analysis/cnnfeargreed.service';
import { logger } from '../../shared/utils/logger';
import { twelveDataLimiter } from '../../shared/utils/rate-limiter';

// 주기적 폴링이 필요한 심볼 (WebSocket 미지원 또는 별도 수집)
const POLLING_SYMBOLS = [
  // 환율
  'USD/KRW',
  'EUR/KRW',
  'JPY/KRW',
  'CNY/KRW',
  'HKD/KRW',

  // 금속
  'XAU/USD',  // 금
  'XAG/USD',  // 은
  'XPT/USD',  // 백금
  'XPD/USD',  // 팔라듐
  'CPER',     // 구리 ETF


  // 에너지 ETF
  'USO',      // United States Oil Fund
  'BNO',
  'UNG',      // United States Natural Gas Fund
  'UGA',
  'DBE',
];

// 심볼별 카테고리 매핑
const SYMBOL_CATEGORY: Record<string, string> = {
  'USD/KRW': 'forex',
  'EUR/KRW': 'forex',
  'JPY/KRW': 'forex', 
  'CNY/KRW': 'forex',
  'HKD/KRW': 'forex',

  'XAU/USD': 'metal',
  'XAG/USD': 'metal',
  'XPT/USD': 'metal',
  'XPD/USD': 'metal',
  'CPER'   : 'metal',

  'USO': 'commodity',
  'BNO': 'commodity',
  'UNG': 'commodity',
  'UGA': 'commodity',
  'DBE': 'commodity',
};

// TwelveData API 응답 타입
interface TwelveDataTimeSeriesResponse {
  status?: string;
  message?: string;
  values?: TwelveDataCandle[];
}

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

let isSchedulerRunning = false;
let candlePollTask: ScheduledTask | null = null;
let activeCandlePoll: Promise<void> | null = null;

/**
 * 스케줄러 초기화
 */
export function initScheduler(): void {
  if (isSchedulerRunning) {
    logger.warn('Scheduler already running');
    return;
  }

  logger.info('Starting polling scheduler', { symbols: POLLING_SYMBOLS.length });

  // 매 분 5초에 실행 (거래소 집계 완료 대기)
  // "5 * * * * *" = 매 분 5초
  candlePollTask = cron.schedule('5 * * * * *', async () => {
    const poll = pollAllSymbols();
    activeCandlePoll = poll;
    await poll.finally(() => {
      if (activeCandlePoll === poll) activeCandlePoll = null;
    });
  });

  // 서버 시작 시 즉시 한 번 실행 (데이터 최신화)
  // 공포/탐욕 지수는 자주 변하지 않으므로 시작 시 1회만 갱신
  pollFearGreed().catch(err => logger.error('Initial FearGreed poll failed', { error: err }));

  isSchedulerRunning = true;
  logger.info('Scheduler initialized (runs at :05 every minute)');
}

export async function stopScheduler(): Promise<void> {
  candlePollTask?.stop();
  candlePollTask = null;
  await activeCandlePoll;
  isSchedulerRunning = false;
  logger.info('Polling scheduler stopped');
}

/**
 * 공포/탐욕 지수 갱신
 */
async function pollFearGreed(): Promise<void> {
  try {
    logger.info('Polling Fear & Greed Index...');
    
    // Crypto Fear & Greed
    await fearGreedService.getCurrent();
    
    // Stock Fear & Greed
    await cnnFearGreedService.getCurrent();
    
    logger.info('Fear & Greed Index updated');
  } catch (error) {
    logger.error('Failed to poll Fear & Greed Index', { error });
  }
}

/**
 * 모든 폴링 심볼 데이터 수집
 */
async function pollAllSymbols(): Promise<void> {
  logger.debug('Polling cycle started');

  for (const symbol of POLLING_SYMBOLS) {
    await fetchLastCandle(symbol);
  }
}

/**
 * 특정 심볼의 마지막 1분봉 가져오기
 */
async function fetchLastCandle(symbol: string): Promise<void> {
  try {
    // Rate Limiter 적용
    const response = await twelveDataLimiter.schedule(() =>
      axios.get<TwelveDataTimeSeriesResponse>('https://api.twelvedata.com/time_series', {
        params: {
          symbol,
          interval: '1min',
          apikey: config.TWELVE_DATA_API_KEY,
          outputsize: 1, // 최신 1개만
          order: 'DESC',
        },
      })
    );

    if (response.data.status === 'error') {
      logger.warn('Polling API error', { symbol, message: response.data.message });
      return;
    }

    const values = response.data.values;
    if (!values || values.length === 0) {
      logger.debug('No data from polling', { symbol });
      return;
    }

    const candle = values[0];
    if (!candle) {
      logger.debug('Candle data undefined', { symbol });
      return;
    }

    const candleTime = new Date(candle.datetime);

    await enqueueCandle({
      symbol,
      startTime: Math.floor(candleTime.getTime() / 1000),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseInt(candle.volume) || 0,
      category: SYMBOL_CATEGORY[symbol] || 'other',
    });

    logger.debug('Polled candle enqueued in RocksDB', {
      symbol, 
      time: candleTime.toISOString() 
    });

  } catch (error) {
    logger.error('Polling failed', { symbol, error });
  }
}

/**
 * 스케줄러 상태 확인
 */
export function isSchedulerActive(): boolean {
  return isSchedulerRunning;
}
