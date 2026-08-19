// Types
export * from './candle.types';

// Constants
export * from './candle.constants';

// Durable persistence building blocks (runtime singleton lives in candle.persistence)
export { CandleFlusher } from './candle.flusher';
export type { PendingCandle, PendingCandleStore } from './storage/pending-candle.store';
export { RocksPendingCandleStore } from './storage/rocks-pending-candle.store';

// Repository
export { candleRepository, CandleRepository } from './candle.repository';

// Service
export { candleService, CandleService } from './candle.service';

// Controller
export { candleController, CandleController } from './candle.controller';

// Routes
export { default as candleRoutes } from './candle.routes';
export { default as aggregateRoutes } from './aggregate.routes';

// Utilities
export { CandleMaker } from './candle.maker';
