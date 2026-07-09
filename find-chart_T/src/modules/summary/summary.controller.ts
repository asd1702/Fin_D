import { Request, Response } from 'express';
import { summaryService } from './summary.service';

export class SummaryController {
  /**
   * GET /api/summary/:symbol
   * 단일 심볼의 전일 종가 조회
   */
  async getSummary(
    req: Request<{ symbol: string }>,
    res: Response
  ): Promise<void> {
    const { symbol } = req.params;

    const summary = await summaryService.getSummary(symbol);

    if (!summary) {
      res.status(404).json({
        success: false,
        errorCode: 'NOT_FOUND',
        message: `No daily data found for symbol: ${symbol}`,
      });
      return;
    }

    res.json(summary);
  }

  /**
   * GET /api/summary?symbols=QQQ,SPY,DIA,BTC/USD
   * 여러 심볼의 전일 종가 일괄 조회
   */
  async getMultipleSummaries(
    req: Request<{}, {}, {}, { symbols?: string }>,
    res: Response
  ): Promise<void> {
    const symbolsQuery = req.query.symbols;

    if (!symbolsQuery) {
      res.status(400).json({
        success: false,
        errorCode: 'BAD_REQUEST',
        message: 'symbols query parameter is required',
      });
      return;
    }

    const symbols = symbolsQuery.split(',').map((s) => s.trim());

    if (symbols.length === 0) {
      res.status(400).json({
        success: false,
        errorCode: 'BAD_REQUEST',
        message: 'At least one symbol is required',
      });
      return;
    }

    const summaries = await summaryService.getMultipleSummaries(symbols);
    res.json(summaries);
  }

  /**
   * GET /api/summary/status
   * 일봉 데이터 상태 확인 (관리용)
   */
  async getDataStatus(_req: Request, res: Response): Promise<void> {
    const status = await summaryService.getDataStatus();
    res.json({ status });
  }
}

export const summaryController = new SummaryController();
