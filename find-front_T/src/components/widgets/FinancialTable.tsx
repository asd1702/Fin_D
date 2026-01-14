import { useState } from 'react'
import type { FinancialTableWidget, FinancialTableRow } from '@/types'
import './Widgets.css'

interface Props {
  widget: FinancialTableWidget
}

const USD_TO_KRW = 1460

const formatCurrency = (value: number): { usd: string; krw: string } => {
  if (!Number.isFinite(value)) return { usd: '-', krw: '' }
  
  let usd: string
  if (Math.abs(value) >= 1e12) {
    usd = `$${(value / 1e12).toFixed(2)}T`
  } else if (Math.abs(value) >= 1e9) {
    usd = `$${(value / 1e9).toFixed(2)}B`
  } else if (Math.abs(value) >= 1e6) {
    usd = `$${(value / 1e6).toFixed(2)}M`
  } else {
    usd = `$${(value / 1e3).toFixed(0)}K`
  }
  
  // 한화 변환
  const krwValue = value * USD_TO_KRW
  let krw: string
  if (Math.abs(krwValue) >= 1e12) {
    krw = `≈${(krwValue / 1e12).toFixed(1)}조원`
  } else if (Math.abs(krwValue) >= 1e8) {
    krw = `≈${(krwValue / 1e8).toFixed(1)}억원`
  } else {
    krw = `≈${(krwValue / 1e4).toFixed(0)}만원`
  }
  
  return { usd, krw }
}

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(1)}%`
}

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString()
}

export default function FinancialTable({ widget }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId)
    } else {
      newExpanded.add(rowId)
    }
    setExpandedRows(newExpanded)
  }

  const formatCell = (value: any, format?: string): { usd: string; krw: string } | string => {
    if (value === null || value === undefined) return '-'
    if (typeof value !== 'number') return String(value)
    if (format === 'currency') return formatCurrency(value)
    if (format === 'percent') return formatPercent(value)
    return formatNumber(value)
  }

  const renderRow = (row: FinancialTableRow, level: number = 0): JSX.Element => {
    const hasChildren = row.children && row.children.length > 0
    const isExpanded = expandedRows.has(row.id)

    return (
      <>
        <tr key={row.id} className={`financial-table-row level-${level}`}>
          <td className="financial-table-label-cell" style={{ paddingLeft: `${level * 20 + 12}px` }}>
            {hasChildren && (
              <button
                className="financial-table-expand-btn"
                onClick={() => toggleRow(row.id)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            <span>{row.label}</span>
          </td>
          {widget.columns.slice(1).map((col) => {
            const cellValue = formatCell(row[col.key], col.format)
            const isCurrency = col.format === 'currency' && typeof cellValue === 'object' && 'usd' in cellValue
            
            return (
              <td key={col.key} className="financial-table-value-cell">
                {isCurrency ? (
                  <div className="financial-table-currency-cell">
                    <span className="currency-usd">{(cellValue as { usd: string; krw: string }).usd}</span>
                    <span className="currency-krw">{(cellValue as { usd: string; krw: string }).krw}</span>
                  </div>
                ) : (
                  <span>{String(cellValue)}</span>
                )}
              </td>
            )
          })}
        </tr>
        {hasChildren && isExpanded && row.children?.map((child) => renderRow(child, level + 1))}
      </>
    )
  }

  return (
    <div className="financial-table-container">
      <div className="financial-table-scroll">
        <table className="financial-table">
          <thead>
            <tr>
              {widget.columns.map((col) => (
                <th
                  key={col.key}
                  className={`financial-table-header ${col.pin ? `pin-${col.pin}` : ''}`}
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{widget.rows.map((row) => renderRow(row))}</tbody>
        </table>
      </div>
    </div>
  )
}

