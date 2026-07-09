import { Request, Response } from 'express';
import { analysisService } from './analysis.service';
import { fearGreedService } from './feargreed.service';
import { cnnFearGreedService } from './cnnfeargreed.service';
import { AnalysisParams, AnalysisQuery } from './analysis.types';

interface PerformanceParams {
  symbol: string;
}

interface SeasonalParams {
  symbol: string;
}

interface SeasonalQuery {
  years?: string;
}

export class AnalysisController {
  /**
   * GET /api/analysis/:symbol/:timeframe/rsi
   */
  async getRSI(
    req: Request<AnalysisParams, unknown, unknown, AnalysisQuery>,
    res: Response
  ): Promise<void> {
    const { symbol, timeframe } = req.params;
    const limit = parseInt(req.query.limit ?? '100', 10);
    const period = parseInt(req.query.period ?? '14', 10);

    const result = await analysisService.getRSI(symbol, timeframe, period, limit);
    res.status(200).json(result);
  }

  /**
   * GET /api/analysis/:symbol/:timeframe/macd
   */
  async getMACD(
    req: Request<AnalysisParams, unknown, unknown, AnalysisQuery>,
    res: Response
  ): Promise<void> {
    const { symbol, timeframe } = req.params;
    const limit = parseInt(req.query.limit ?? '100', 10);
    const fastPeriod = parseInt(req.query.fastPeriod ?? '12', 10);
    const slowPeriod = parseInt(req.query.slowPeriod ?? '26', 10);
    const signalPeriod = parseInt(req.query.signalPeriod ?? '9', 10);

    const result = await analysisService.getMACD(
      symbol,
      timeframe,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      limit
    );
    res.status(200).json(result);
  }

  /**
   * GET /api/analysis/:symbol/:timeframe/bollinger
   */
  async getBollingerBands(
    req: Request<AnalysisParams, unknown, unknown, AnalysisQuery>,
    res: Response
  ): Promise<void> {
    const { symbol, timeframe } = req.params;
    const limit = parseInt(req.query.limit ?? '100', 10);
    const period = parseInt(req.query.period ?? '20', 10);
    const stdDev = parseFloat(req.query.stdDev ?? '2');

    const result = await analysisService.getBollingerBands(
      symbol,
      timeframe,
      period,
      stdDev,
      limit
    );
    res.status(200).json(result);
  }

  /**
   * GET /api/analysis/:symbol/:timeframe/sma
   */
  async getSMA(
    req: Request<AnalysisParams, unknown, unknown, AnalysisQuery>,
    res: Response
  ): Promise<void> {
    const { symbol, timeframe } = req.params;
    const limit = parseInt(req.query.limit ?? '100', 10);
    const period = parseInt(req.query.period ?? '20', 10);

    const result = await analysisService.getSMA(symbol, timeframe, period, limit);
    res.status(200).json(result);
  }

  /**
   * GET /api/analysis/:symbol/:timeframe/ema
   */
  async getEMA(
    req: Request<AnalysisParams, unknown, unknown, AnalysisQuery>,
    res: Response
  ): Promise<void> {
    const { symbol, timeframe } = req.params;
    const limit = parseInt(req.query.limit ?? '100', 10);
    const period = parseInt(req.query.period ?? '20', 10);

    const result = await analysisService.getEMA(symbol, timeframe, period, limit);
    res.status(200).json(result);
  }

  // ==================== Performance (성과) ====================

  /**
   * GET /api/analysis/:symbol/performance
   * 심볼의 기간별 성과 (1W, 1M, 3M, 6M, YTD, 1Y)
   */
  async getPerformance(
    req: Request<PerformanceParams>,
    res: Response
  ): Promise<void> {
    const { symbol } = req.params;

    try {
      const result = await analysisService.getPerformance(symbol);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No daily candle data')) {
        res.status(404).json({
          success: false,
          errorCode: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }

  // ==================== Seasonal (시즌별) ====================

  /**
   * GET /api/analysis/:symbol/seasonal
   * 심볼의 연도별 시즌 차트 데이터
   */
  async getSeasonal(
    req: Request<SeasonalParams, unknown, unknown, SeasonalQuery>,
    res: Response
  ): Promise<void> {
    const { symbol } = req.params;
    const years = parseInt(req.query.years ?? '3', 10);

    const result = await analysisService.getSeasonal(symbol, years);
    res.status(200).json(result);
  }

  // ==================== Dashboard Indicators (대시보드용 지표) ====================

  /**
   * GET /api/analysis/:symbol/indicators
   * 대시보드용 RSI/MACD 요약 (1D 기준)
   */
  async getIndicatorSummary(
    req: Request<{ symbol: string }>,
    res: Response
  ): Promise<void> {
    const { symbol } = req.params;

    try {
      const result = await analysisService.getIndicatorSummary(symbol);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(404).json({
          success: false,
          errorCode: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }

  /**
   * GET /api/analysis/indicators/batch
   * 여러 심볼의 RSI/MACD 요약 일괄 조회
   */
  async getIndicatorSummaryBatch(
    req: Request<unknown, unknown, unknown, { symbols?: string }>,
    res: Response
  ): Promise<void> {
    const symbolsParam = req.query.symbols;
    
    if (!symbolsParam) {
      res.status(400).json({
        success: false,
        errorCode: 'BAD_REQUEST',
        message: 'symbols query parameter is required',
      });
      return;
    }

    const symbols = symbolsParam.split(',').map(s => s.trim());
    const results = await analysisService.getIndicatorSummaryBatch(symbols);
    res.status(200).json({ data: results });
  }

  // ==================== Fear & Greed Index ====================

  /**
   * GET /api/analysis/feargreed
   * Crypto Fear & Greed Index (Alternative.me)
   */
  async getFearGreed(
    req: Request<unknown, unknown, unknown, { days?: string }>,
    res: Response
  ): Promise<void> {
    const days = parseInt(req.query.days ?? '1', 10);

    try {
      if (days <= 1) {
        const result = await fearGreedService.getCurrent();
        res.status(200).json(result);
      } else {
        const result = await fearGreedService.getWithHistory(days);
        res.status(200).json(result);
      }
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({
          success: false,
          errorCode: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }

  /**
   * GET /api/analysis/feargreed/stock
   * Stock Market Fear & Greed Index (CNN)
   * 주식 시장용 - S&P 500 기반
   */
  async getStockFearGreed(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const result = await cnnFearGreedService.getCurrent();
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({
          success: false,
          errorCode: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }
}

export const analysisController = new AnalysisController();
