import { useMarketStore, type MarketFilter } from '@/store/useMarketStore'
import { useChatStore } from '@/store/useChatStore'
import {
  isUSMarketOpen,
  getTimeUntilMarketClose,
  getTimeUntilMarketOpen,
  formatTimeRemaining
} from '@/utils/marketHours'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import './TopNav.css'

// 패널 닫기 아이콘 SVG 컴포넌트
const PanelCloseIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
  >
    <defs>
      <style>
        {`.panel-close-stroke {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2px;
        }`}
      </style>
    </defs>
    <rect className="panel-close-stroke" x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <path className="panel-close-stroke" d="M9,3v18" />
    <path className="panel-close-stroke" d="M14,9l3,3-3,3" />
  </svg>
)

// 대시보드 섹션 타입
type DashboardSection = 'news' | 'favorites' | 'calendar' | 'economic';

export default function TopNav() {
  const { selectedMarket, setSelectedMarket } = useMarketStore()
  const { isOpen: isChatOpen, toggleChat } = useChatStore()
  const [marketStatusMessage, setMarketStatusMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<DashboardSection>('news')

  const location = useLocation()
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard'

  // 마켓 상태 업데이트 (10초마다 - 더 자주 체크)
  useEffect(() => {
    const updateStatus = () => {
      const status = isUSMarketOpen()
      // 상태와 메시지를 동시에 계산하여 일관성 유지
      setIsOpen(status.isOpen)

      // getMarketStatusMessage() 내부에서 다시 isUSMarketOpen()을 호출하지 않도록
      // 현재 상태를 기반으로 메시지 생성
      let message = ''
      if (status.isOpen) {
        const msUntilClose = getTimeUntilMarketClose()
        const timeStr = formatTimeRemaining(msUntilClose)
        message = `장 중 · 마감 ${timeStr} 전`
      } else {
        const msUntilOpen = getTimeUntilMarketOpen()
        const timeStr = formatTimeRemaining(msUntilOpen)
        message = `장 마감 · 개장 ${timeStr} 전`
      }
      setMarketStatusMessage(message)

      // 디버깅용 로그
      if (import.meta.env.DEV) {
        console.log('[TopNav 상태 업데이트]', {
          isOpen: status.isOpen,
          message: status.message,
          statusMessage: message
        })
      }
    }

    // 즉시 업데이트
    updateStatus()

    // 10초마다 업데이트
    const interval = setInterval(updateStatus, 10000)

    return () => clearInterval(interval)
  }, [])

  const marketTabs: { id: MarketFilter; label: string }[] = [
    { id: 'NASDAQ', label: 'NASDAQ 100' },
    { id: 'DOW', label: '다우 30' },
    { id: 'SP500', label: 'S&P 500' },
    { id: 'ALL', label: '전체' },
  ]

  const dashboardTabs: { id: DashboardSection; label: string; elementId: string }[] = [
    { id: 'news', label: '최신 뉴스', elementId: 'section-news' },
    { id: 'favorites', label: '관심 기업 리스트', elementId: 'section-favorites' },
    { id: 'calendar', label: '캘린더', elementId: 'section-calendar' },
    { id: 'economic', label: '경제/이슈', elementId: 'section-economic' },
  ]

  // 스크롤 시 자동으로 활성 탭 변경 (Intersection Observer)
  useEffect(() => {
    if (!isDashboard) return

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px', // 상단 20% 지점에서 감지
      threshold: 0
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id
          const tab = dashboardTabs.find(t => t.elementId === sectionId)
          if (tab) {
            setActiveSection(tab.id)
          }
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    // 각 섹션 요소 관찰 시작
    dashboardTabs.forEach(tab => {
      const element = document.getElementById(tab.elementId)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [isDashboard])

  const handleDashboardTabClick = (tab: typeof dashboardTabs[0]) => {
    setActiveSection(tab.id)
    const element = document.getElementById(tab.elementId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav className="top-nav">
      <div className="top-nav-content">
        {isDashboard ? (
          // 대시보드 페이지: 섹션 네비게이션
          dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleDashboardTabClick(tab)}
              className={`top-nav-item ${activeSection === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))
        ) : (
          // 다른 페이지: 마켓 필터
          marketTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedMarket(tab.id)}
              className={`top-nav-item ${selectedMarket === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))
        )}
        <div className={`top-nav-market-status ${isOpen ? 'open' : 'closed'}`}>
          <span className="top-nav-status-dot"></span>
          <span className="top-nav-status-text">{marketStatusMessage}</span>
        </div>
      </div>
      <button onClick={toggleChat} className="top-nav-chat-toggle">
        <PanelCloseIcon
          style={{
            transform: isChatOpen ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>
    </nav>
  )
}
