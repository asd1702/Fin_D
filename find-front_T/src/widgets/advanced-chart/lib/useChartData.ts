import { useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHistoricalCandles } from '@/services/api/chartApi';
import { chartWebSocket } from '@/services/api/chartWebSocket';
import type { ChartData, WSMessage } from '@/types/candle';
import { getStartOfCandle } from '@/shared/lib/time';
import { UP_COLOR, DOWN_COLOR } from '@/shared/config/chart';
import type { UTCTimestamp } from 'lightweight-charts';

export const useChartData = (symbol: string, timeframe: string) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['candles', symbol, timeframe], [symbol, timeframe]);

  // 1. 초기 데이터 로드
  const { data, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: ({ signal }) => fetchHistoricalCandles(
      symbol, 
      timeframe, 
      undefined,  
      undefined,
      200,  // 한 번에 조회하는 캔들 수
      signal as AbortSignal
    ),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // 2. 웹소켓 구독 및 실시간 데이터 병합
  useEffect(() => {
    const unsubscribe = chartWebSocket.subscribe((msg: WSMessage) => {
      if (msg.type === 'reconnected') return;
      if (msg.symbol !== symbol) return;

      queryClient.setQueryData<ChartData[]>(queryKey, (oldData) => {
        if (!oldData) return oldData;

        // Gap 채워졌을 때 - 데이터 리로드
        if (msg.type === 'gap_filled') {
          console.log('Gap filled, reloading chart data...', msg);
          // 데이터 무효화하여 자동 리페치
          queryClient.invalidateQueries({ queryKey });
          return oldData;
        }

        // A. 완성봉 처리
        if (msg.type === 'candle' && msg.timeframe === timeframe) {
          const c = msg.candle;
          if (!c) return oldData;
          
          // Null 안전성 검증
          if (c.open == null || c.high == null || c.low == null || c.close == null || c.volume == null) {
            console.warn('Invalid candle data received:', c);
            return oldData;
          }

          const newCandle: ChartData = {
            candle: { time: c.startTime as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close },
            volume: { time: c.startTime as UTCTimestamp, value: c.volume, color: c.close >= c.open ? UP_COLOR : DOWN_COLOR },
          };
          
          const lastIdx = oldData.length - 1;
          const lastCandleTime = oldData[lastIdx].candle.time as number;
          const newCandleTime = newCandle.candle.time as number;
          
          if (lastCandleTime === newCandleTime) {
            // 같은 시간이면 업데이트
            const newData = [...oldData];
            newData[lastIdx] = newCandle;
            return newData;
          } else if (lastCandleTime < newCandleTime) {
            // 새로운 시간이면 추가
            return [...oldData, newCandle];
          } else {
            // 시간이 역순이거나 중복인 경우 무시
            console.warn('Candle time issue, ignoring:', { 
              newCandleTime, 
              lastCandleTime 
            });
            return oldData;
          }
        }
        
        // B. 실시간 틱 처리
        else if (msg.type === 'tick') {
          if (!msg.timestamp || !msg.price) return oldData;

          const price = Number(msg.price);
          const volume = Number(msg.volume || 0);
          
          // NaN 검증
          if (isNaN(price) || isNaN(volume)) {
            console.warn('Invalid tick data received:', msg);
            return oldData;
          }
          
          const candleStartTime = getStartOfCandle(msg.timestamp, timeframe) as UTCTimestamp;

          const newData = [...oldData];
          const lastIndex = newData.length - 1;
          const lastBar = newData[lastIndex];
          const lastBarTime = lastBar.candle.time as number;
          const tickCandleTime = candleStartTime as number;

          if (lastBarTime === tickCandleTime) {
            // 같은 캔들 시간이면 업데이트
            const updatedCandle = {
              ...lastBar.candle,
              close: price,
              high: Math.max(lastBar.candle.high, price),
              low: Math.min(lastBar.candle.low, price),
            };
            const updatedVolume = {
              ...lastBar.volume,
              value: lastBar.volume.value + volume,
              color: updatedCandle.close >= updatedCandle.open ? UP_COLOR : DOWN_COLOR
            };
            newData[lastIndex] = { candle: updatedCandle, volume: updatedVolume };
            return newData;
          } 
          else if (lastBarTime < tickCandleTime) {
            // 새로운 캔들 시작
            const newCandle: ChartData = {
              candle: { time: candleStartTime, open: price, high: price, low: price, close: price },
              volume: { time: candleStartTime, value: volume, color: UP_COLOR }
            };
            return [...newData, newCandle];
          }
          // 시간이 역순인 경우 무시
          else {
            console.warn('Tick time issue, ignoring:', { 
              tickCandleTime, 
              lastBarTime 
            });
            return oldData;
          }
        }
        return oldData;
      });
    });

    return () => { unsubscribe(); }; 
  }, [symbol, timeframe, queryClient, queryKey]);

  // 3. 과거 데이터 더 불러오기
  const loadMoreHistory = useCallback(async () => {
    const currentData = queryClient.getQueryData<ChartData[]>(queryKey);
    if (!currentData || currentData.length === 0) return;

    const firstCandleTime = currentData[0].candle.time as number;
    
    try {
      const olderData = await fetchHistoricalCandles(symbol, timeframe, firstCandleTime);
      
      if (olderData.length > 0) {
        queryClient.setQueryData<ChartData[]>(queryKey, (old) => {
          if (!old) return olderData;
          
          // 1. 병합
          const merged = [...olderData, ...old];
          
          // 2. 시간순 정렬 (오름차순)
          merged.sort((a, b) => (a.candle.time as number) - (b.candle.time as number));
          
          // 3. 중복 제거 (정렬 후에 수행)
          const dedup: ChartData[] = [];
          let lastTime: number | undefined;
          for (const item of merged) {
            const t = item.candle.time as number;
            if (t !== lastTime) {
              dedup.push(item);
              lastTime = t;
            }
          }
          
          return dedup;
        });
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, [symbol, timeframe, queryClient, queryKey]);

  return { 
    data: data || [], 
    isLoading,
    loadMoreHistory 
  };
};
