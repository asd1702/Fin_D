/**
 * 미국 주식 시장 거래 시간 유틸리티
 */

import { timeApi } from '@/services/api/time'

export interface MarketStatus {
  isOpen: boolean
  message: string
  nextOpen?: Date
  nextClose?: Date
}

// 서버 시간과의 오프셋 (밀리초)
let serverTimeOffset = 0

/**
 * 서버 시간과 동기화합니다.
 */
export async function syncServerTime(): Promise<void> {
  try {
    const clientTimeBefore = Date.now()
    const serverTime = await timeApi.getServerTime()
    const clientTimeAfter = Date.now()
    const networkDelay = (clientTimeAfter - clientTimeBefore) / 2
    const estimatedServerTime = serverTime.timestamp + networkDelay
    serverTimeOffset = estimatedServerTime - clientTimeBefore

    console.log(`[시간 동기화 성공] 서버 시간 오프셋: ${serverTimeOffset}ms`)

    setTimeout(() => {
      syncServerTime().catch(console.error)
    }, 30 * 60 * 1000)
  } catch (error) {
    console.warn('[시간 동기화 실패] 재시도 예정:', error)
    serverTimeOffset = 0
    setTimeout(() => {
      syncServerTime().catch(console.error)
    }, 1 * 60 * 1000)
  }
}

/**
 * 서버 시간을 기준으로 한 현재 시간을 반환합니다.
 */
function getSyncedTime(): Date {
  return new Date(Date.now() + serverTimeOffset)
}

/**
 * 뉴욕 시간 정보를 가져오는 헬퍼 함수
 */
function getNYInfo(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false, weekday: 'short'
  })
  const parts = formatter.formatToParts(date)
  const get = (t: string) => parts.find(p => p.type === t)?.value || ''

  const hour = parseInt(get('hour'), 10)
  const minute = parseInt(get('minute'), 10)
  const second = parseInt(get('second'), 10)

  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10) - 1,
    day: parseInt(get('day'), 10),
    hour,
    minute,
    second,
    weekday: get('weekday'),
    totalSeconds: hour * 3600 + minute * 60 + second
  }
}

/**
 * 미국 시장이 현재 열려있는지 확인
 */
export function isUSMarketOpen(): MarketStatus {
  const now = getSyncedTime()
  const ny = getNYInfo(now)

  const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 }
  const nyDayNum = dayMap[ny.weekday] ?? 0

  // 주말 체크
  if (nyDayNum === 0 || nyDayNum === 6) {
    return { isOpen: false, message: '주말 (장 마감)' }
  }

  // 장 시간 체크 (09:30:00 ~ 16:00:00)
  const openSec = 9 * 3600 + 30 * 60
  const closeSec = 16 * 3600
  const isOpen = ny.totalSeconds >= openSec && ny.totalSeconds < closeSec

  return {
    isOpen,
    message: isOpen ? '장 중 (실시간 업데이트)' : '장 마감',
  }
}

/**
 * 다음 시장 오픈 시간까지 남은 시간 (밀리초)
 */
export function getTimeUntilMarketOpen(): number {
  const status = isUSMarketOpen()
  if (status.isOpen) return 0

  const now = getSyncedTime()
  const ny = getNYInfo(now)

  const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 }
  const nyDayNum = dayMap[ny.weekday] ?? 0

  const targetOpenSec = 9 * 3600 + 30 * 60

  let daysToAdd = 0
  if (ny.totalSeconds >= targetOpenSec) {
    // 오늘 개장 시간을 이미 지났거나 현재 장 마감 상태임 -> 다음날로
    daysToAdd = 1
  }

  // 주말 처리
  let checkDay = (nyDayNum + daysToAdd) % 7
  if (checkDay === 6) daysToAdd += 2 // 토요일 -> 월요일
  else if (checkDay === 0) daysToAdd += 1 // 일요일 -> 월요일

  const diffSec = (targetOpenSec - ny.totalSeconds) + (daysToAdd * 24 * 3600)

  return Math.max(0, diffSec * 1000)
}

/**
 * 다음 시장 마감 시간까지 남은 시간 (밀리초)
 */
export function getTimeUntilMarketClose(): number {
  const status = isUSMarketOpen()
  if (!status.isOpen) return 0

  const now = getSyncedTime()
  const ny = getNYInfo(now)

  const targetCloseSec = 16 * 3600
  const diffSec = targetCloseSec - ny.totalSeconds

  return Math.max(0, diffSec * 1000)
}

/**
 * 밀리초를 "X시간 Y분" 형식으로 변환
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0분'

  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`
  } else if (hours > 0) {
    return `${hours}시간`
  } else {
    return `${minutes}분`
  }
}

/**
 * 마켓 상태와 카운트다운 메시지
 */
export function getMarketStatusMessage(): string {
  const status = isUSMarketOpen()

  if (status.isOpen) {
    const msUntilClose = getTimeUntilMarketClose()
    const timeStr = formatTimeRemaining(msUntilClose)
    return `장 중 · 마감 ${timeStr} 전`
  } else {
    const msUntilOpen = getTimeUntilMarketOpen()
    const timeStr = formatTimeRemaining(msUntilOpen)
    return `장 마감 · 개장 ${timeStr} 전`
  }
}
