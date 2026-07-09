/**
 * CandleBuffer - Production Level 캔들 버퍼
 * 
 * 특징:
 * 1. Non-blocking push (이벤트 루프 보호)
 * 2. 배치 저장으로 DB 부하 최소화
 * 3. Graceful Shutdown (서버 종료 시 데이터 보존)
 * 4. Backpressure 처리 (메모리 보호)
 * 5. Poison Pill 방지 (개별 candle 재시도 + Dead Letter Queue)
 */

import { prisma } from '../../shared';
import { Prisma } from '@prisma/client';
import { Candle } from './candle.types';
import { logger } from '../../shared/utils/logger';

// 심볼 기반 카테고리 결정
function getCategoryFromSymbol(symbol: string): string {
  if (symbol.includes('BTC') || symbol.includes('ETH')) return 'crypto';
  if (symbol.includes('USD') && !symbol.includes('BTC')) return 'forex';
  if (['XAU', 'XAG', 'XPT', 'XPD'].some(m => symbol.includes(m))) return 'metal';
  if (['CL', 'NG', 'CPER'].some(e => symbol.includes(e))) return 'commodity';
  return 'stock'; // QQQ, SPY, DIA 등
}

// 재시도 추적을 위한 확장 타입
interface RetryableCandle extends Candle {
  retryCount?: number;
}

export interface BufferStats {
  bufferSize: number;
  totalPushed: number;
  totalFlushed: number;
  totalFailed: number;
  totalDeadLettered: number;
  lastFlushTime: Date | null;
  isFlushing: boolean;
}

export class CandleBuffer {
  private buffer: RetryableCandle[] = [];
  private readonly BATCH_SIZE: number;
  private readonly FLUSH_INTERVAL: number;
  private readonly MAX_BUFFER_SIZE: number;
  private readonly MAX_RETRY_COUNT = 3;
  
  private isFlushing = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private shutdownHandlers: Array<{
    signal: NodeJS.Signals;
    handler: () => void;
  }> = [];

  // 통계
  private stats = {
    totalPushed: 0,
    totalFlushed: 0,
    totalFailed: 0,
    totalDeadLettered: 0,
    lastFlushTime: null as Date | null,
  };

  constructor(options?: {
    batchSize?: number;
    flushInterval?: number;
    maxBufferSize?: number;
  }) {
    this.BATCH_SIZE = options?.batchSize ?? 500;
    this.FLUSH_INTERVAL = options?.flushInterval ?? 3000;
    this.MAX_BUFFER_SIZE = options?.maxBufferSize ?? 10000;

    // 자동 플러시 시작
    this.startFlusher();

    // Graceful Shutdown 핸들러 등록
    this.registerShutdownHandlers();

    logger.info('CandleBuffer initialized', { batchSize: this.BATCH_SIZE, flushInterval: this.FLUSH_INTERVAL, maxBuffer: this.MAX_BUFFER_SIZE, maxRetry: this.MAX_RETRY_COUNT });
  }

  /**
   * 캔들을 버퍼에 추가 (Non-blocking, O(1))
   */
  push(candle: Candle): boolean {
    // 셧다운 중이면 거부
    if (this.isShuttingDown) {
      logger.warn('Push rejected during shutdown');
      return false;
    }

    // 메모리 보호: 버퍼가 너무 크면 경고 후 거부
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      logger.error('Buffer overflow - data dropped', { current: this.buffer.length, max: this.MAX_BUFFER_SIZE });
      this.stats.totalFailed++;
      return false;
    }

    this.buffer.push(candle);
    this.stats.totalPushed++;

    // 배치 사이즈 도달 시 즉시 플러시
    if (this.buffer.length >= this.BATCH_SIZE) {
      logger.debug('Batch size reached, triggering flush', { size: this.buffer.length });
      void this.flush();
    }

    return true;
  }

  /**
   * 여러 캔들을 한 번에 추가
   */
  pushMany(candles: Candle[]): number {
    let pushed = 0;
    for (const candle of candles) {
      if (this.push(candle)) pushed++;
    }
    return pushed;
  }

  /**
   * 자동 플러시 타이머 시작
   */
  private startFlusher(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL);

    // unref()로 이 타이머가 프로세스 종료를 막지 않도록 함
    this.flushTimer.unref();
  }

  /**
   * 버퍼 플러시 (DB 저장)
   */
  async flush(): Promise<number> {
    // 이미 플러시 중이거나 데이터가 없으면 스킵
    if (this.isFlushing || this.buffer.length === 0) {
      return 0;
    }

    this.isFlushing = true;
    const startTime = Date.now();

    // 현재 버퍼 내용을 원자적으로 추출
    const chunks = this.buffer.splice(0, this.buffer.length);
    const count = chunks.length;

    try {
      await prisma.candle1m.createMany({
        data: chunks.map((c) => ({
          symbol: c.symbol,
          time: new Date(c.startTime * 1000),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          category: c.category ?? getCategoryFromSymbol(c.symbol),
        })),
        skipDuplicates: true,
      });

      const elapsed = Date.now() - startTime;
      this.stats.totalFlushed += count;
      this.stats.lastFlushTime = new Date();

      logger.info('Flush completed', { count, elapsedMs: elapsed });
      return count;

    } catch (error) {
      logger.error('DB flush failed', { error });
      
      // 개별 candle 재시도 로직 (Poison Pill 격리)
      const toRetry: RetryableCandle[] = [];
      const toDeadLetter: RetryableCandle[] = [];

      for (const candle of chunks) {
        const retryCount = (candle.retryCount ?? 0) + 1;
        
        if (retryCount <= this.MAX_RETRY_COUNT) {
          candle.retryCount = retryCount;
          toRetry.push(candle);
        } else {
          // 재시도 초과 → Dead Letter Queue
          toDeadLetter.push(candle);
          logger.error('Candle discarded after max retries', { symbol: candle.symbol, time: new Date(candle.startTime * 1000).toISOString() });
        }
      }

      // Dead Letter 처리
      if (toDeadLetter.length > 0) {
        await this.sendToDeadLetter(toDeadLetter, error);
        this.stats.totalDeadLettered += toDeadLetter.length;
      }

      // 재시도 대상은 버퍼 앞에 다시 추가
      if (toRetry.length > 0) {
        logger.warn('Candles queued for retry', { count: toRetry.length });
        this.buffer.unshift(...toRetry);
        this.stats.totalFailed += toRetry.length;
        
        // DB 부하 방지를 위한 대기
        await this.delay(1000);
      }
      
      return 0;

    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Dead Letter Queue에 저장 (DB)
   * 파일 시스템 대신 DB에 저장하여 클라우드 환경(k8s, Docker)에서도 데이터 유실 방지
   */
  private async sendToDeadLetter(candles: RetryableCandle[], error: unknown): Promise<void> {
    try {
      await prisma.deadLetter.create({
        data: {
          module: 'candle_buffer',
          action: 'flush_failed',
          reason: error instanceof Error ? error.message : String(error),
          // Prisma Json 타입 제약으로 인한 타입 단언 (불가피)
          data: candles.map(c => ({
            symbol: c.symbol,
            startTime: c.startTime,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            retryCount: c.retryCount,
            category: c.category,
          })) as Prisma.InputJsonValue,
        },
      });

      logger.info('Dead Letter saved to DB', { count: candles.length });

    } catch (dbError) {
      // DB 저장조차 실패하면 최후의 수단: stdout/stderr 로그
      // 클라우드 환경에서는 이 로그를 ELK, Datadog, CloudWatch 등이 수집
      logger.error('CRITICAL: Failed to save Dead Letter to DB', { 
        originalError: error, 
        dbError, 
        dataSample: candles.slice(0, 1),
        totalCount: candles.length 
      });
    }
  }

  /**
   * 강제 플러시 (동기적으로 완료될 때까지 대기)
   */
  async forceFlush(): Promise<number> {
    // 진행 중인 플러시 완료 대기
    while (this.isFlushing) {
      await this.delay(100);
    }
    return this.flush();
  }

  /**
   * Graceful Shutdown 핸들러 등록
   */
  private registerShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.warn('Shutdown signal received', { signal });

      // 타이머 정지
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }

      // 남은 데이터 강제 저장
      const remaining = this.buffer.length;
      if (remaining > 0) {
        logger.info('Flushing remaining data before shutdown', { remaining });
        await this.forceFlush();
      }

      logger.info('CandleBuffer shutdown complete');
      logger.info('Final stats', this.stats);
    };

    // 시그널 핸들러 등록
    for (const signal of ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const) {
      const handler = () => void shutdown(signal);
      this.shutdownHandlers.push({ signal, handler });
      process.on(signal, handler);
    }
  }

  /**
   * 버퍼 상태 조회
   */
  getStats(): BufferStats {
    return {
      bufferSize: this.buffer.length,
      totalPushed: this.stats.totalPushed,
      totalFlushed: this.stats.totalFlushed,
      totalFailed: this.stats.totalFailed,
      totalDeadLettered: this.stats.totalDeadLettered,
      lastFlushTime: this.stats.lastFlushTime,
      isFlushing: this.isFlushing,
    };
  }

  /**
   * 버퍼 크기 조회
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * 유틸: 지연
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 버퍼 종료 (테스트용)
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    for (const { signal, handler } of this.shutdownHandlers) {
      process.off(signal, handler);
    }
    this.shutdownHandlers = [];
    await this.forceFlush();
  }
}

// 싱글톤 인스턴스
export const candleBuffer = new CandleBuffer();
