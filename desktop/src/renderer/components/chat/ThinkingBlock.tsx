import { useState, useEffect, useMemo, useRef } from 'react'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

type Props = {
  content: string
  isActive?: boolean
}

export function ThinkingBlock({ content, isActive = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const displayContent = useMemo(() => content.replace(/\r\n?/g, '\n').trimEnd(), [content])
  const hasDisplayContent = displayContent.trim().length > 0

  useEffect(() => {
    if (expanded && isActive && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [displayContent, expanded, isActive])

  return (
    <div style={{ marginBottom: 4 }}>
      <style>{thinkingStyles}</style>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 6,
          padding: '2px 4px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--muted, #888)',
          fontSize: 12,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10 }}>{expanded ? '\u25BE' : '\u25B8'}</span>
        <span style={{ fontStyle: 'italic', fontWeight: 500 }}>
          {isActive ? 'Thinking' : 'Thought'}
          {isActive && <span className="thinking-dots" />}
        </span>
      </button>
      {expanded && hasDisplayContent && (
        <div
          ref={contentRef}
          style={{
            position: 'relative',
            marginTop: 4,
            maxHeight: 300,
            overflowY: 'auto',
            borderRadius: 8,
            border: '1px solid var(--border, #333)',
            padding: 10,
            fontSize: 11,
            color: 'var(--muted, #888)',
          }}
        >
          <MarkdownRenderer
            content={displayContent}
            streaming={isActive}
            className="thinking-markdown"
          />
          {isActive && <span className="thinking-cursor" />}
        </div>
      )}
    </div>
  )
}

const thinkingStyles = `
@keyframes thinking-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes thinking-dots {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}
.thinking-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--muted, #888);
  vertical-align: middle;
  margin-left: 1px;
  animation: thinking-cursor-blink 1s step-end infinite;
}
.thinking-dots::after {
  content: '';
  animation: thinking-dots 1.4s steps(1, end) infinite;
}
.thinking-markdown > :first-child { margin-top: 0; }
.thinking-markdown > :last-child { margin-bottom: 0; }
`
