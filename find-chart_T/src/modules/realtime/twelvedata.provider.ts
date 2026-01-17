import WebSocket from 'ws';
import config from '../../config';
import { CandleMaker, candleBuffer } from '../candle';
import { broadcast } from './websocket.service';
import { logger } from '../../shared/utils/logger';

const SYMBOLS = config.STREAM_SYMBOLS;
const candleMakers = new Map<string, CandleMaker>();

// 각 심볼마다 CandleMaker 인스턴스 생성
SYMBOLS.forEach((s) => candleMakers.set(s, new CandleMaker()));

let tdWs: WebSocket | null = null;

// Heartbeat state
let lastMessageTime: number = Date.now();
let heartbeatInterval: NodeJS.Timeout | null = null;
const HEARTBEAT_CHECK_MS = 30000; // 30초마다 검사
const DISCONNECT_TIMEOUT_MS = 60000; // 60초간 데이터 없으면 재연결

/**
 * TwelveData WebSocket 연결
 */
export function connectToTwelveData(): void {
  // 기존 연결 정리
  cleanup();

  logger.info('TwelveData WebSocket connecting...');

  tdWs = new WebSocket(
    `wss://ws.twelvedata.com/v1/quotes/price?apikey=${config.TWELVE_DATA_API_KEY}`
  );

  tdWs.on('open', () => {
    logger.info('TwelveData WebSocket connected');
    lastMessageTime = Date.now();
    startHeartbeatMonitor(); // 모니터링 시작

    tdWs?.send(
      JSON.stringify({
        action: 'subscribe',
        params: { symbols: SYMBOLS.join(',') },
      })
    );
  });

  tdWs.on('message', async (data: WebSocket.RawData) => {
    lastMessageTime = Date.now(); // 활동 갱신

    try {
      const text = typeof data === 'string' ? data : data.toString();
      const message = JSON.parse(text);

      if (
        message.event === 'price' &&
        message.symbol &&
        message.price &&
        message.timestamp
      ) {
        await handlePriceUpdate(message.symbol, message.price, message.timestamp);
      } else if (message.event === 'heartbeat') {
        // TwelveData 자체 heartbeat가 있다면 처리 (문서상 명시 없어도 대비)
        logger.debug('Received explicit heartbeat');
      }
    } catch (err) {
      logger.error('TwelveData message processing error', { error: err });
    }
  });

  tdWs.on('error', (err) => {
    logger.error('TwelveData WebSocket error', { error: err.message });
  });

  tdWs.on('close', (code) => {
    logger.warn('TwelveData WebSocket closed, reconnecting in 5s', { code });
    cleanup(); // 인터벌 정지
    setTimeout(connectToTwelveData, 5000);
  });
}

function startHeartbeatMonitor() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    const elapsed = Date.now() - lastMessageTime;

    if (elapsed > DISCONNECT_TIMEOUT_MS) {
      logger.warn('No data received for 60s (Silent Disconnect detected). Reconnecting...', { elapsed });
      // 강제 재연결 (기존 소켓 close -> close 이벤트 핸들러가 재연결 트리거)
      if (tdWs) {
        tdWs.terminate(); // 즉시 종료
      } else {
        connectToTwelveData();
      }
    }
  }, HEARTBEAT_CHECK_MS);
}

function cleanup() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (tdWs) {
    tdWs.removeAllListeners(); // 리스너 제거로 중복 실행 방지
    tdWs.close();
    tdWs = null;
  }
}

/**
 * 가격 업데이트 처리
 * 
 * 집계(Aggregation)는 TimescaleDB Continuous Aggregates가 담당
 * 애플리케이션은 1분봉 저장과 실시간 브로드캐스트만 담당
 */
async function handlePriceUpdate(
  symbol: string,
  price: number,
  timestamp: number
): Promise<void> {
  // 1. 프론트엔드로 tick 브로드캐스트
  broadcast({ type: 'tick', symbol, price, timestamp });

  // 2. 1분봉 조립
  const maker = candleMakers.get(symbol);
  if (!maker) return;

  const completedCandle = maker.update(symbol, price, 0, timestamp);

  if (completedCandle) {
    // 3. 메모리 버퍼에 push (Non-blocking!)
    candleBuffer.push(completedCandle);

    // 4. 프론트엔드로 1m 캨들 브로드캐스트 (즉시)
    broadcast({ type: 'candle', timeframe: '1m', candle: completedCandle });
    logger.debug('1m candle completed', { symbol, time: new Date(completedCandle.startTime * 1000).toISOString() });

    // ⚠️ 상위 타임프레임 집계는 TimescaleDB Continuous Aggregates가 처리
    // 애플리케이션 레벨에서 집계하지 않음 (Race Condition 방지)
  }
}

/**
 * TwelveData 연결 해제
 */
export function disconnectFromTwelveData(): void {
  cleanup();
}
