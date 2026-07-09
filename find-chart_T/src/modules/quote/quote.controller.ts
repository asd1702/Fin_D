import { Request, Response } from 'express';
import { quoteService } from './quote.service';
import { logger } from '../../shared/utils/logger';

class QuoteController {
  /**
   * GET /api/quotes/summary
   * 전체 시세 요약 조회
   */
  async getSummary(req: Request, res: Response) {
    try {
      const summary = await quoteService.getSummary();
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Quote summary error', { error });
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch quote summary',
      });
    }
  }

  /**
   * GET /api/quotes/ticker
   * 티커 바 데이터 조회
   */
  async getTicker(req: Request, res: Response) {
    try {
      const ticker = await quoteService.getTicker();
      res.json({ success: true, data: ticker });
    } catch (error) {
      logger.error('Ticker error', { error });
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch ticker data',
      });
    }
  }

  /**
   * GET /api/quotes/category/:category
   * 카테고리별 시세 조회
   */
  async getByCategory(req: Request, res: Response) {
    try {
      const category = req.params.category as string;
      const quotes = await quoteService.getQuotesByCategory(category);
      res.json({ success: true, data: quotes });
    } catch (error) {
      logger.error('Quote by category error', { error });
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch quotes by category',
      });
    }
  }

  /**
   * GET /api/quotes/:symbol
   * 개별 심볼 시세 조회
   */
  async getQuote(req: Request, res: Response) {
    try {
      const symbol = req.params.symbol as string;
      const decodedSymbol = decodeURIComponent(symbol);
      const quote = await quoteService.getQuote(decodedSymbol);

      if (!quote) {
        return res.status(404).json({
          success: false,
          errorCode: 'NOT_FOUND',
          message: `Quote not found for ${decodedSymbol}`,
        });
      }

      res.json({ success: true, data: quote });
    } catch (error) {
      logger.error('Quote error', { error });
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch quote',
      });
    }
  }
}

export const quoteController = new QuoteController();
