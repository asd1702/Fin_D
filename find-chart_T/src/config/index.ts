/**
 * 환경 변수 설정 (Envalid로 검증)
 * 
 * Fail Fast: 필수 환경 변수가 없거나 잘못되면 서버 시작 시 즉시 에러
 */

import { cleanEnv, str, port, bool, url } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

// 환경 변수 검증 및 파싱
const env = cleanEnv(process.env, {
  // Server
  NODE_ENV: str({ 
    choices: ['development', 'production', 'test'], 
    default: 'development' 
  }),
  PORT: port({ default: 8080 }),

  // Database (필수)
  DATABASE_URL: url({ desc: 'PostgreSQL 연결 URL' }),

  // Redis (선택)
  USE_REDIS: bool({ default: false }),
  REDIS_URL: str({ default: 'redis://localhost:6379' }),

  // External APIs (필수)
  TWELVE_DATA_API_KEY: str({ desc: 'TwelveData API 키' }),

  // Streaming (선택)
  STREAM_SYMBOLS: str({ default: 'SPY,QQQ,DIA,BTC/USD,AAPL,AMZN,AVGO,COST,GOOGL,JNJ,JPM,LLY,META,MRK,MSFT,NVDA,PG,TSLA,UNH,V,XOM'}),

  // CORS (선택)
  CORS_ORIGIN: str({ default: 'http://localhost:3000' }),

  // Durable candle queue
  ROCKSDB_PATH: str({ default: './data/rocksdb/candles' }),
});

const config = {
  // Server
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.isDevelopment,
  isProduction: env.isProduction,

  // Database
  DATABASE_URL: env.DATABASE_URL,

  // Redis
  USE_REDIS: env.USE_REDIS,
  REDIS_URL: env.REDIS_URL,

  // External APIs
  TWELVE_DATA_API_KEY: env.TWELVE_DATA_API_KEY,

  // Streaming
  STREAM_SYMBOLS: env.STREAM_SYMBOLS.split(','),

  // CORS
  CORS_ORIGIN: env.CORS_ORIGIN.split(','),

  // Durable candle queue
  ROCKSDB_PATH: env.ROCKSDB_PATH,
} as const;

export default config;
