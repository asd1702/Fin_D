// React import removed to fix lint warning if not used


interface SimpleMarkdownProps {
  children: string;
}

/**
 * 트렌디한 금융 리포트 스타일의 마크다운 렌더러
 * 지원 문법:
 * - ### 헤더 (섹션 구분, 이모지 포함 시 카드 스타일)
 * - **강조** (수치 강조)
 * - - 리스트 (가독성)
 * - > 인용문 (요약)
 */
export default function SimpleMarkdown({ children }: SimpleMarkdownProps) {
  if (!children) return null;

  // [DEBUG] 원본 텍스트 확인
  console.log('[SimpleMarkdown] Original text:', children);

  // 1. 줄 단위로 분리
  const lines = children.split('\n');

  // 인라인 스타일 파서 (**강조** + 숫자 자동 강조 + 링크 파싱)
  const renderInline = (text: string) => {
    // Step 1: 마크다운 링크 [Label](URL) 파싱
    // [텍스트](URL) 또는 [텍스트] (URL) 패턴을 모두 찾습니다.
    const mdLinkPattern = /\[([^\]]+)\]\s*\((https?:\/\/[^\s)]+)\)/g;
    const partsWithMdLinks: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mdLinkPattern.exec(text)) !== null) {
      // 매칭 이전의 텍스트 추가
      if (match.index > lastIndex) {
        partsWithMdLinks.push(text.substring(lastIndex, match.index));
      }

      const label = match[1];
      const url = match[2];

      partsWithMdLinks.push(
        <a
          key={`md-link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#4cc9f0',
            textDecoration: 'underline',
            textDecorationColor: 'rgba(76, 201, 240, 0.5)',
            textUnderlineOffset: '2px',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            wordBreak: 'break-all',
            fontWeight: '600'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#5dd9ff';
            e.currentTarget.style.textDecorationColor = 'rgba(93, 217, 255, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#4cc9f0';
            e.currentTarget.style.textDecorationColor = 'rgba(76, 201, 240, 0.5)';
          }}
        >
          {label}
        </a>
      );
      lastIndex = mdLinkPattern.lastIndex;
    }

    if (lastIndex < text.length) {
      partsWithMdLinks.push(text.substring(lastIndex));
    }

    // 마크다운 링크 처리가 완료된 각 파트에 대해 나머지 인라인 스타일(URL, Bold, Number) 적용
    return partsWithMdLinks.map((part, index) => {
      if (typeof part !== 'string') return part;

      // Step 2: 일반 URL 링크 감지 (마크다운 링크가 아닌 순수 URL)
      const urlPattern = /(https?:\/\/[^\s)]+)/g;
      const partsWithUrls = part.split(urlPattern);

      return partsWithUrls.map((subPart, urlIndex) => {
        if (urlPattern.test(subPart)) {
          return (
            <a
              key={`url-${index}-${urlIndex}`}
              href={subPart}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#4cc9f0',
                textDecoration: 'underline',
                textDecorationColor: 'rgba(76, 201, 240, 0.5)',
                textUnderlineOffset: '2px',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                wordBreak: 'break-all',
                opacity: 0.8,
                fontSize: '0.9em'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#5dd9ff';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#4cc9f0';
                e.currentTarget.style.opacity = '0.8';
              }}
            >
              {subPart}
            </a>
          );
        }

        // Step 3: **bold** 파싱
        const boldParts = subPart.split(/(\*\*[^*]+\*\*)/g);

        return boldParts.map((boldPart, boldIndex) => {
          if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
            const content = boldPart.slice(2, -2);
            const isFinancialData = /[\$₩€£¥]|%|\d+\.\d+[BMK]?|\d{1,3}(,\d{3})*/.test(content);

            return (
              <strong
                key={`bold-${index}-${urlIndex}-${boldIndex}`}
                style={{
                  color: isFinancialData ? '#5dd9ff' : '#4cc9f0',
                  fontWeight: '700',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  background: isFinancialData ? 'rgba(76, 201, 240, 0.12)' : 'transparent',
                }}
              >
                {content}
              </strong>
            );
          }

          // Step 4: 숫자 강조
          const numberPattern = /([\$₩€£¥]?\d+\.?\d*[BMK%]?)/g;
          const numParts = boldPart.split(numberPattern);

          return numParts.map((numPart, numIndex) => {
            if (numberPattern.test(numPart)) {
              return (
                <span
                  key={`num-${index}-${urlIndex}-${boldIndex}-${numIndex}`}
                  style={{
                    color: '#6dd9ff',
                    fontWeight: '600',
                  }}
                >
                  {numPart}
                </span>
              );
            }
            return <span key={`text-${index}-${urlIndex}-${boldIndex}-${numIndex}`}>{numPart}</span>;
          });
        });
      });
    });
  };

  return (
    <div style={{
      lineHeight: '1.8',
      fontSize: '15px',
      color: '#e8e8e8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {lines.map((line, index) => {
        const trimmed = line.trim();

        // [Header 3] ### 제목 (최대한 관대한 파싱)
        if (trimmed.includes('###')) {
          const title = trimmed.replace(/^#+\s*/, '').trim();

          // [DEBUG]
          console.log('[Header Detected]', title);

          // 이모지 포함 여부 OR 키워드 기반 감지
          const hasEmoji = /[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/u.test(title);
          const isKeywordInsight = /인사이트|Insights|분석|Analysis|요약|Summary/i.test(title);
          const shouldHighlight = hasEmoji || isKeywordInsight;

          if (shouldHighlight) {
            const emojiMatch = title.match(/[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/u);
            const emoji = emojiMatch ? emojiMatch[0] : '💡';
            const textOnly = title.replace(/[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/gu, '').trim();

            return (
              <div
                key={index}
                style={{
                  margin: '24px 0 18px 0',
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, rgba(76, 201, 240, 0.18) 0%, rgba(76, 201, 240, 0.08) 100%)',
                  borderLeft: '5px solid #4cc9f0',
                  borderRadius: '0 12px 12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(76, 201, 240, 0.1) inset',
                  transition: 'all 0.3s ease'
                }}
              >
                {emoji && (
                  <span style={{ fontSize: '26px', lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                    {emoji}
                  </span>
                )}
                <h3 style={{
                  margin: 0,
                  fontSize: '17.5px',
                  fontWeight: '650',
                  color: '#ffffff',
                  letterSpacing: '0.4px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}>
                  {textOnly}
                </h3>
              </div>
            )
          }

          // 일반 헤더
          return (
            <h3
              key={index}
              style={{
                fontSize: '17px',
                fontWeight: '650',
                color: '#f5f5f5',
                margin: '26px 0 14px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(76, 201, 240, 0.15)'
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '4px',
                  height: '20px',
                  background: 'linear-gradient(180deg, #4cc9f0 0%, #3a9fcf 100%)',
                  borderRadius: '2px',
                  boxShadow: '0 0 8px rgba(76, 201, 240, 0.4)'
                }}
              />
              {title}
            </h3>
          );
        }

        // [List Item] ● 내용
        if (trimmed.startsWith('● ')) {
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '10px',
                paddingLeft: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{
                color: '#4cc9f0',
                fontSize: '8px',
                marginTop: '8px',
                flexShrink: 0,
                filter: 'drop-shadow(0 0 2px rgba(76, 201, 240, 0.6))'
              }}>●</span>
              <span style={{
                flex: 1,
                fontSize: '15px',
                lineHeight: '1.7'
              }}>
                {renderInline(trimmed.replace('● ', ''))}
              </span>
            </div>
          );
        }

        // [List Item] - 내용 (기존 호환성)
        if (trimmed.startsWith('- ')) {
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '10px',
                paddingLeft: '6px'
              }}
            >
              <span style={{
                color: '#4cc9f0',
                fontSize: '8px',
                marginTop: '8px',
                flexShrink: 0,
                filter: 'drop-shadow(0 0 2px rgba(76, 201, 240, 0.6))'
              }}>●</span>
              <span style={{
                flex: 1,
                fontSize: '15px',
                lineHeight: '1.7'
              }}>
                {renderInline(trimmed.replace('- ', ''))}
              </span>
            </div>
          );
        }

        // [Blockquote] > 인용
        if (trimmed.startsWith('> ')) {
          return (
            <div
              key={index}
              style={{
                borderLeft: '4px solid rgba(76, 201, 240, 0.4)',
                paddingLeft: '16px',
                margin: '12px 0',
                color: '#b8b8b8',
                fontStyle: 'italic',
                backgroundColor: 'rgba(76, 201, 240, 0.05)',
                padding: '12px 16px',
                borderRadius: '0 6px 6px 0',
                fontSize: '14.5px',
                lineHeight: '1.6'
              }}
            >
              {renderInline(trimmed.replace('> ', ''))}
            </div>
          )
        }

        // [Empty Line]
        if (trimmed === '') {
          return <div key={index} style={{ height: '10px' }} />;
        }

        // [Paragraph] 일반 텍스트
        return (
          <div key={index} style={{
            marginBottom: '6px',
            lineHeight: '1.75'
          }}>
            {renderInline(line)}
          </div>
        );
      })}
    </div>
  );
}
