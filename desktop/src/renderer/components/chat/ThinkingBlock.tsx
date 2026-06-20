import { useMemo, useState } from 'react'
import { IconBrain } from '../../icons'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

// 思考块(对齐 CM 的 ReasoningRow):tool-inline 骨架 + Brain 图标 + 真实摘要标题 + 默认折叠 3 行。
// zspark 的 reasoning activity 只有 detail(无独立 summary),故 parseReasoning 仅基于 content:
// 取第一个非空行作标题(去 markdown 装饰 + 截 80 字符),其余为正文。
type Props = {
  content: string
  isActive?: boolean
}

type ReasoningTone = 'completed' | 'processing'

function sanitizeReasoningTitle(title: string): string {
  return title
    .replace(/[`*_~]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim()
}

function parseReasoning(content: string): {
  summaryTitle: string
  bodyText: string
  hasBody: boolean
} {
  const text = content ?? ''
  const lines = text.split('\n')
  const trimmedLines = lines.map((line) => line.trim())
  const titleLineIndex = trimmedLines.findIndex(Boolean)
  const rawTitle = titleLineIndex >= 0 ? trimmedLines[titleLineIndex] : ''
  const cleanTitle = sanitizeReasoningTitle(rawTitle)
  const summaryTitle = cleanTitle
    ? cleanTitle.length > 80
      ? `${cleanTitle.slice(0, 80)}…`
      : cleanTitle
    : 'Reasoning'

  const bodyText =
    titleLineIndex >= 0
      ? lines
          .filter((_, index) => index !== titleLineIndex)
          .join('\n')
          .trim()
      : text.trim()
  const hasBody = bodyText.length > 0
  return { summaryTitle, bodyText, hasBody }
}

export function ThinkingBlock({ content, isActive = false }: Props) {
  const [expanded, setExpanded] = useState(false)

  const { summaryTitle, bodyText, hasBody } = useMemo(
    () => parseReasoning(content),
    [content],
  )

  // CM 色调:有正文=completed(绿);流式中且无正文=processing(橙)。
  const tone: ReasoningTone = isActive && !hasBody ? 'processing' : 'completed'

  const toggle = () => setExpanded((v) => !v)

  return (
    <div className="tool-inline reasoning-inline">
      <button
        type="button"
        className="tool-inline-bar-toggle"
        onClick={toggle}
        aria-expanded={expanded}
        aria-label="Toggle reasoning details"
      />
      <div className="tool-inline-content">
        <button
          type="button"
          className="tool-inline-summary tool-inline-toggle"
          onClick={toggle}
          aria-expanded={expanded}
        >
          {/* zspark 的 IconBrain 无 props,用 span 包裹上 tone 色,内部 svg 经 > svg 规则强制 14px */}
          <span className={`tool-inline-icon ${tone}`} aria-hidden>
            <IconBrain />
          </span>
          <span className="tool-inline-value">{summaryTitle}</span>
        </button>
        {hasBody && (
          <MarkdownRenderer
            content={bodyText}
            streaming={isActive}
            className={`reasoning-inline-detail markdown ${
              expanded ? '' : 'tool-inline-clamp'
            }`}
          />
        )}
      </div>
    </div>
  )
}
