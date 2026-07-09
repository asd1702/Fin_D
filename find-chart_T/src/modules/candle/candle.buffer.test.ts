import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  createDeadLetter: vi.fn(),
}));

vi.mock('../../shared', () => ({
  prisma: {
    candle1m: { createMany: prismaMocks.createMany },
    deadLetter: { create: prismaMocks.createDeadLetter },
  },
}));

vi.mock('../../shared/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { CandleBuffer, candleBuffer } from './candle.buffer';
import { Candle } from './candle.types';

const candle = (startTime: number): Candle => ({
  symbol: 'AAPL',
  startTime,
  open: 100,
  high: 105,
  low: 98,
  close: 102,
  volume: 10,
});

describe('CandleBuffer', () => {
  let buffer: CandleBuffer;

  beforeEach(() => {
    buffer = new CandleBuffer({ batchSize: 100, flushInterval: 60_000 });
    prismaMocks.createMany.mockResolvedValue({ count: 0 });
    prismaMocks.createDeadLetter.mockResolvedValue({});
  });

  afterEach(async () => {
    prismaMocks.createMany.mockResolvedValue({ count: 0 });
    await buffer.destroy();
  });

  afterAll(async () => {
    await candleBuffer.destroy();
  });

  it('pushes a candle and updates stats', () => {
    expect(buffer.push(candle(1_700_000_000))).toBe(true);
    expect(buffer.getStats()).toMatchObject({
      bufferSize: 1,
      totalPushed: 1,
    });
  });

  it('flushes buffered candles in one batch', async () => {
    prismaMocks.createMany.mockResolvedValue({ count: 2 });
    buffer.pushMany([candle(1_700_000_000), candle(1_700_000_060)]);

    await expect(buffer.flush()).resolves.toBe(2);

    expect(prismaMocks.createMany).toHaveBeenCalledOnce();
    expect(prismaMocks.createMany.mock.calls[0]?.[0].data).toHaveLength(2);
    expect(buffer.getStats()).toMatchObject({
      bufferSize: 0,
      totalFlushed: 2,
    });
  });

  it('returns failed candles to the retry queue', async () => {
    prismaMocks.createMany.mockRejectedValueOnce(new Error('database unavailable'));
    buffer.push(candle(1_700_000_000));
    vi.spyOn(buffer as never, 'delay').mockResolvedValue(undefined);

    await expect(buffer.flush()).resolves.toBe(0);

    expect(buffer.getStats()).toMatchObject({
      bufferSize: 1,
      totalFailed: 1,
    });
    expect(prismaMocks.createDeadLetter).not.toHaveBeenCalled();
  });

  it('sends candles to dead letter after max retries', async () => {
    prismaMocks.createMany.mockRejectedValueOnce(new Error('poison candle'));
    buffer.push(candle(1_700_000_000));
    const internalBuffer = (buffer as unknown as {
      buffer: Array<Candle & { retryCount?: number }>;
    }).buffer;
    internalBuffer[0]!.retryCount = 3;

    await expect(buffer.flush()).resolves.toBe(0);

    expect(prismaMocks.createDeadLetter).toHaveBeenCalledOnce();
    expect(buffer.getStats()).toMatchObject({
      bufferSize: 0,
      totalDeadLettered: 1,
    });
  });

  it('destroy clears its timer and process listeners', async () => {
    await buffer.destroy();

    expect((buffer as unknown as { flushTimer: NodeJS.Timeout | null }).flushTimer).toBeNull();
    expect(
      (buffer as unknown as { shutdownHandlers: unknown[] }).shutdownHandlers
    ).toHaveLength(0);
  });
});
