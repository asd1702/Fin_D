import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getCandles: vi.fn(),
}));

vi.mock('./config', () => ({ default: {} }));
vi.mock('./shared/db/prisma', () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));
vi.mock('./modules/candle/candle.service', () => ({
  candleService: { getCandles: mocks.getCandles },
  CandleService: class {},
}));

import { createApp } from './app';
import { candleBuffer } from './modules/candle/candle.buffer';

describe('Chart Server API', () => {
  afterAll(async () => {
    await candleBuffer.destroy();
  });

  beforeEach(() => {
    mocks.queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mocks.getCandles.mockResolvedValue({
      symbol: 'AAPL',
      timeframe: '1m',
      data: [
        {
          time: 1_700_000_000,
          open: 100,
          high: 105,
          low: 98,
          close: 102,
          volume: 10,
        },
      ],
    });
  });

  it('returns liveness from GET /', async () => {
    const response = await request(createApp()).get('/').expect(200);

    expect(response.body.status).toBe('ok');
  });

  it('returns readiness from GET /health without a real database', async () => {
    const response = await request(createApp()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.services.database.status).toBe('healthy');
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it('returns candles from GET /api/candles/:symbol/:timeframe', async () => {
    const response = await request(createApp())
      .get('/api/candles/AAPL/1m?limit=10')
      .expect(200);

    expect(mocks.getCandles).toHaveBeenCalledWith('AAPL', '1m', {
      limit: 10,
      from: undefined,
      to: undefined,
    });
    expect(response.body).toMatchObject({
      symbol: 'AAPL',
      timeframe: '1m',
    });
    expect(response.body.data).toBeInstanceOf(Array);
  });
});
