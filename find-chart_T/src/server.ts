import config from './config'; // nodemon restart trigger
import http from 'http';
import { createApp } from './app';
import {
  initWebSocketServer,
  closeWebSocketServer,
  connectToTwelveData,
  disconnectFromTwelveData,
  syncMissingData
} from './modules/realtime';
import { initScheduler, stopScheduler } from './modules/scheduler';
import { candleFlusher, closeCandlePersistence } from './modules/candle/candle.persistence';
import { logger } from './shared/utils/logger';

const port = config.port;

const app = createApp();
const httpServer = http.createServer(app);

// WebSocket 서버 초기화
initWebSocketServer(httpServer);

httpServer.listen(port, async () => {
  logger.info('Server started', { port, url: `http://localhost:${port}` });
  logger.info('WebSocket available', { url: `ws://localhost:${port}/ws` });

  try {
    // 웹소켓 연결 (실시간 데이터 수신 시작)
    candleFlusher.start();
    connectToTwelveData();

    // 데이터 동기화 (백그라운드 실행)
    syncMissingData().catch(err => {
      logger.error('Background sync failed', { error: err });
    });

    // 폴링 스케줄러 시작 (환율, 에너지 등)
    initScheduler();

  } catch (err) {
    logger.error('Startup error', { error: err });
  }
});

// Graceful Shutdown 처리
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    disconnectFromTwelveData();
    await stopScheduler();
    await closeWebSocketServer();
    await closeCandlePersistence();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => error ? reject(error) : resolve());
    });
    logger.info('HTTP server closed.');
    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Nodemon restart signal
process.on('SIGUSR2', () => shutdown('SIGUSR2'));
