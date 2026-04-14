import { useRef, useState } from 'react'
import type { Company, StockQuote } from '@/types'
import { getCompanyLogoUrl, getCompanyKoreanName, getBrandColor } from '@/utils/company'
import '@/pages/Dashboard/Dashboard.css'

interface CompanyCardProps {
  company: Company
  quote?: StockQuote | null
  onClick?: () => void
}

export default function CompanyCard({ company, quote, onClick }: CompanyCardProps) {
  const logoUrl = getCompanyLogoUrl(company)
  const koreanName = getCompanyKoreanName(company)
  const brandColor = getBrandColor(company.ticker)
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  return (
    <div
      ref={cardRef}
      className="dashboard-card"
      onClick={onClick}
      onMouseMove={handleMouseMove}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        '--brand-color': brandColor,
        '--mouse-x': `${mousePosition.x}px`,
        '--mouse-y': `${mousePosition.y}px`
      } as React.CSSProperties}
    >
      {/* 그라디언트 보더 오버레이 */}
      <div className="card-gradient-border"></div>

      {/* 스포트라이트 효과 */}
      <div className="card-spotlight"></div>

      {/* 카드 헤더: 로고 + 기업명 + 티커 */}
      <div className="card-header">
        <div className="card-logo-wrapper">
          <div className="card-logo-glow"></div>
          <div className="card-logo">
            <img
              src={logoUrl}
              alt={company.companyName}
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>'
              }}
            />
          </div>
        </div>
        <div className="card-company-info">
          {koreanName ? (
            <>
              <h3 className="card-company-name">{koreanName}</h3>
              <p className="card-company-subtext">
                <span className="card-company-en">{company.companyName}</span>
                <span className="card-ticker">{company.ticker}</span>
              </p>
            </>
          ) : (
            <>
              <h3 className="card-company-name">{company.companyName}</h3>
              <p className="card-company-subtext">
                <span className="card-ticker">{company.ticker}</span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* 카드 본문: 주가 정보 */}
      {quote ? (
        <div className="card-quote">
          <div className="card-price">${(quote.price ?? 0).toFixed(2)}</div>
          <div className={`card-change ${(quote.change ?? 0) >= 0 ? 'positive' : 'negative'}`}>
            <span className="card-change-icon">{(quote.change ?? 0) >= 0 ? '▲' : '▼'}</span>
            <span className="card-change-amount">${Math.abs(quote.change ?? 0).toFixed(2)}</span>
            <span className="card-change-percent">
              ({(quote.changePercent ?? 0) >= 0 ? '+' : ''}{(quote.changePercent ?? 0).toFixed(2)}%)
            </span>
          </div>
        </div>
      ) : (
        <div className="card-quote">
          <div className="card-price-placeholder">주가 정보 없음</div>
        </div>
      )}
    </div>
  )
}

