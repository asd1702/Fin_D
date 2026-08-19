import { prisma } from '../../shared';
import { logger } from '../../shared/utils/logger';
import type { PendingCandleStore } from './storage/pending-candle.store';

interface CandleBatchWriter {
  createMany(args: {
    data: Array<{
      symbol: string;
      time: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      category: string;
    }>;
    skipDuplicates: boolean;
  }): Promise<unknown>;
}

export interface CandleFlusherOptions {
  batchSize?: number;
  flushInterval?: number;
  writer?: CandleBatchWriter;
}

function getCategoryFromSymbol(symbol: string): string {
  if (symbol.includes('BTC') || symbol.includes('ETH')) return 'crypto';
  if (symbol.includes('USD') && !symbol.includes('BTC')) return 'forex';
  if (['XAU', 'XAG', 'XPT', 'XPD'].some((metal) => symbol.includes(metal))) return 'metal';
  if (['CL', 'NG', 'CPER'].some((energy) => symbol.includes(energy))) return 'commodity';
  return 'stock';
}

export class CandleFlusher {
  private readonly batchSize: number;
  private readonly flushInterval: number;
  private readonly writer: CandleBatchWriter;
  private flushTimer: NodeJS.Timeout | null = null;
  private inFlight: Promise<number> | null = null;
  private enqueuedSinceFlush = 0;
  private stopped = false;

  constructor(
    private readonly store: PendingCandleStore,
    options: CandleFlusherOptions = {},
  ) {
    this.batchSize = options.batchSize ?? 500;
    this.flushInterval = options.flushInterval ?? 3000;
    this.writer = options.writer ?? prisma.candle1m;
  }

  start(): void {
    if (this.flushTimer || this.stopped) return;

    this.flushTimer = setInterval(() => void this.flush(), this.flushInterval);
    this.flushTimer.unref();

    // Recover pending data promptly after a restart.
    void this.flush();
    logger.info('CandleFlusher started', {
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
    });
  }

  notifyEnqueued(): void {
    this.enqueuedSinceFlush += 1;
    if (this.enqueuedSinceFlush >= this.batchSize) {
      this.enqueuedSinceFlush = 0;
      void this.flush();
    }
  }

  flush(): Promise<number> {
    if (this.stopped || this.inFlight) return Promise.resolve(0);

    const operation = this.flushBatch();
    this.inFlight = operation;
    void operation.finally(() => {
      if (this.inFlight === operation) this.inFlight = null;
    });
    return operation;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.inFlight;
    logger.info('CandleFlusher stopped');
  }

  private async flushBatch(): Promise<number> {
    const startedAt = Date.now();
    let pending;

    try {
      pending = await this.store.peek(this.batchSize);
    } catch (error) {
      logger.error('RocksDB pending candle read failed', { error });
      return 0;
    }
    if (pending.length === 0) return 0;

    try {
      await this.writer.createMany({
        data: pending.map(({ candle }) => ({
          symbol: candle.symbol,
          time: new Date(candle.startTime * 1000),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          category: candle.category ?? getCategoryFromSymbol(candle.symbol),
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      logger.error('TimescaleDB candle flush failed; pending candles retained in RocksDB', { error });
      return 0;
    }

    try {
      // ACK only after TimescaleDB has accepted the idempotent batch.
      await this.store.ack(pending.map(({ key }) => key));
    } catch (error) {
      logger.error('RocksDB candle ACK failed; inserted candles retained for idempotent retry', { error });
      return 0;
    }

    logger.info('Candle flush completed', {
      count: pending.length,
      elapsedMs: Date.now() - startedAt,
    });
    return pending.length;
  }
}
