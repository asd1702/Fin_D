import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { chatApi } from '@/services/api/chat'
import type { ChatMessage } from '@/types'
import SimpleMarkdown from '../common/SimpleMarkdown'
import WidgetRenderer from '../widgets/WidgetRenderer'
import './AISidebar.css'


// 전송 버튼 아이콘 SVG 컴포넌트
const SendArrowIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="18"
    height="18"
  >
    <defs>
      <style>
        {`.send-arrow-stroke {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2px;
        }`}
      </style>
    </defs>
    <path className="send-arrow-stroke" d="M5,12l7-7,7,7" />
    <path className="send-arrow-stroke" d="M12,19V5" />
  </svg>
)

// 채팅 메뉴 아이콘 SVG 컴포넌트
const ChatMenuIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="18"
    height="18"
  >
    <defs>
      <style>
        {`.chat-menu-stroke {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2px;
        }`}
      </style>
    </defs>
    <circle className="chat-menu-stroke" cx="12" cy="12" r="1" />
    <circle className="chat-menu-stroke" cx="19" cy="12" r="1" />
    <circle className="chat-menu-stroke" cx="5" cy="12" r="1" />
  </svg>
)

// 이미지 업로드 아이콘 SVG 컴포넌트
const ImageUploadIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="18"
    height="18"
  >
    <defs>
      <style>
        {`.image-upload-stroke {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2px;
        }`}
      </style>
    </defs>
    <path className="image-upload-stroke" d="M16,5h6" />
    <path className="image-upload-stroke" d="M19,2v6" />
    <path className="image-upload-stroke" d="M21,11.5v7.5c0,1.1-.9,2-2,2H5c-1.1,0-2-.9-2-2V5c0-1.1.9-2,2-2h7.5" />
    <path className="image-upload-stroke" d="M21,15l-3.09-3.09c-.78-.78-2.05-.78-2.83,0l-9.09,9.09" />
    <circle className="image-upload-stroke" cx="9" cy="9" r="2" />
  </svg>
)

// 빠른 질문 아이콘 SVG 컴포넌트
const QuickQuestionIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <defs>
      <style>
        {`.quick-question-stroke {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2px;
        }`}
      </style>
    </defs>
    <path className="quick-question-stroke" d="M13,17v-8" />
    <path className="quick-question-stroke" d="M18,17V5" />
    <path className="quick-question-stroke" d="M3,3v16c0,1.1.9,2,2,2h16" />
    <path className="quick-question-stroke" d="M8,17v-3" />
  </svg>
)

// 칼럼 아이콘 SVG 컴포넌트
const ColumnIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <defs>
      <style>
        {`.column-stroke {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2px;
        }`}
      </style>
    </defs>
    <rect className="column-stroke" x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <path className="column-stroke" d="M12,3v18" />
  </svg>
)

// 검색 아이콘 SVG 컴포넌트
const SearchIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <defs>
      <style>
        {`.search-stroke {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2px;
        }`}
      </style>
    </defs>
    <path className="search-stroke" d="M21,21l-4.34-4.34" />
    <circle className="search-stroke" cx="11" cy="11" r="8" />
  </svg>
)

interface AISidebarProps {
  isOpen: boolean
}

export default function AISidebar({ isOpen }: AISidebarProps) {
  const { ticker } = useParams<{ ticker?: string }>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickQuestions = [
    { text: '최근 실적 요약해줘', icon: 'column' },
    { text: '경쟁사랑 ROE 비교해줘', icon: 'chart' },
    { text: '애널리스트 의견은?', icon: 'search' },
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (message?: string) => {
    const messageToSend = message || input
    if (!messageToSend.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      console.log(`Sending message with context ticker: ${ticker || 'None'}`)
      const response = await chatApi.sendMessage(messageToSend, ticker)

      console.log('API Response:', response)
      console.log('Widgets:', response.widgets)

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        widgets: response.widgets,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const [width, setWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const isResizingRef = useRef(false)
  const [selectedModel, setSelectedModel] = useState<'basic' | 'premium'>('basic')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const modelSelectorRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }

    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isModelDropdownOpen])

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    isResizingRef.current = true
    // 텍스트 선택 방지
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
    isResizingRef.current = false
    // 텍스트 선택 복원
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRef.current) {
        e.preventDefault()
        const newWidth = window.innerWidth - e.clientX
        if (newWidth >= 280 && newWidth <= 800) {
          setWidth(newWidth)
        }
      }
    }

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        stopResizing()
      }
    }

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove, { passive: false })
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, stopResizing])

  return (
    <aside
      className={`ai-sidebar ${!isOpen ? 'ai-sidebar-hidden' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{ width: `${width}px` }}
      ref={sidebarRef}
    >
      {/* Resize Handle (Left Border) */}
      <div
        className="resize-handle"
        onMouseDown={startResizing}
      />

      <div className="ai-sidebar-header">
        <div className="ai-model-selector" ref={modelSelectorRef}>
          <div
            className="ai-model-toggle"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          >
            <span className="ai-model-label">Fin:D {selectedModel}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: isModelDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {isModelDropdownOpen && (
            <div className="ai-model-dropdown">
              <button
                className={`ai-model-option ${selectedModel === 'basic' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedModel('basic')
                  setIsModelDropdownOpen(false)
                }}
              >
                Fin:D basic
              </button>
              <button
                className={`ai-model-option ${selectedModel === 'premium' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedModel('premium')
                  setIsModelDropdownOpen(false)
                }}
              >
                Fin:D premium
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ai-sidebar-content">
        <div className="quick-questions">
          <h3 className="quick-questions-title">빠른 질문</h3>
          <div className="quick-questions-list">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                className="quick-question-btn"
                onClick={() => handleSend(q.text)}
                disabled={loading}
              >
                <span className="quick-question-icon">
                  {q.icon === 'column' && <ColumnIcon />}
                  {q.icon === 'chart' && <QuickQuestionIcon />}
                  {q.icon === 'search' && <SearchIcon />}
                </span>
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ai-chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`ai-chat-message ${msg.role}`}>
              <div className="ai-chat-message-content">
                <SimpleMarkdown>{msg.content}</SimpleMarkdown>
              </div>
              {/* [NEW] 위젯 렌더링 */}
              {msg.widgets && msg.widgets.length > 0 && (
                <div className="ai-chat-widgets">
                  {msg.widgets.map((widget, wIdx) => (
                    <WidgetRenderer key={wIdx} widget={widget} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="ai-chat-message assistant">
              <div className="ai-chat-message-content">답변을 생성하는 중...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="ai-sidebar-footer">
        <div className="ai-input-container">
          <button className="ai-input-attach">
            <ImageUploadIcon />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="무엇이든 물어보세요"
            className="ai-input"
            disabled={loading}
          />
          <button className="ai-input-menu">
            <ChatMenuIcon />
          </button>
          <button
            onClick={() => handleSend()}
            className="ai-input-send"
            disabled={loading}
          >
            <SendArrowIcon />
          </button>
        </div>
        {ticker && (
          <p className="ai-input-hint">
            현재 보고 있는 종목을 자동으로 인식합니다
          </p>
        )}
      </div>
    </aside>
  )
}

