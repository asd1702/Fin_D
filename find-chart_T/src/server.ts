import config from './config'; // nodemon restart trigger
import http from 'http';
import { createApp } from './app';
import {
  initWebSocketServer,
  connectToTwelveData,
  syncMissingData
} from './modules/realtime';
import { initScheduler } from './modules/scheduler';
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
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  httpServer.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // 강제 종료 (10초 후)
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Nodemon restart signal
process.on('SIGUSR2', () => shutdown('SIGUSR2'));
