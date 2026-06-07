import { useState } from 'react'
import type { Activity } from '../../appTypes'
import { fmtDuration } from '../../appHelpers'
import { IconChevron, IconBrain, IconTerminal, IconFile, IconTool, IconGlobe } from '../../icons'
import { TerminalChrome } from './TerminalChrome'

type DisplayActivity = Activity & { displayTitle: string; repeatCount: number }

type Props = {
  activity: DisplayActivity
  isPlaceholder: boolean
}

// ── Icon helper ──
function getActIcon(k: Activity['kind']) {
  switch (k) {
    case 'reasoning': return <IconBrain />
    case 'command': return <IconTerminal />
    case 'file': return <IconFile />
    case 'tool': return <IconTool />
    case 'web': return <IconGlobe />
    case 'memory': return <IconBrain />
    default: return <IconTerminal />
  }
}

// ── Parse terminal detail into command + output ──
function parseTerminalContent(detailText: string): { commandPart: string; outputPart: string } {
  const parts = detailText.split('\n\n')
  if (parts.length > 1) {
    return {
      commandPart: parts[0].trim(),
      outputPart: parts.slice(1).join('\n\n').trim(),
    }
  }
  const lineParts = detailText.split('\n')
  if (lineParts.length > 1) {
    return {
      commandPart: lineParts[0].trim(),
      outputPart: lineParts.slice(1).join('\n').trim(),
    }
  }
  return { commandPart: '', outputPart: detailText.trim() }
}

// ── Command activity card ──
function CommandCard({ activity, expanded }: { activity: DisplayActivity; expanded: boolean }) {
  if (!expanded || !activity.detail) return null
  const { commandPart, outputPart } = parseTerminalContent(activity.detail)

  return (
    <TerminalChrome
      title="Terminal"
      status={activity.status === 'running' ? 'running' : activity.status === 'failed' ? 'failed' : undefined}
      copyText={activity.detail}
    >
      {commandPart && (
        <div style={{ marginBottom: outputPart ? 8 : 0 }}>
          <span style={{ color: '#dc2626', userSelect: 'none', marginRight: 4 }}>$</span>
          <span style={{ color: 'var(--text-primary, #e2e8f0)', fontWeight: 600, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            {commandPart}
          </span>
        </div>
      )}
      {outputPart && (
        <pre style={{
          margin: 0,
          padding: 0,
          fontFamily: 'inherit',
          fontSize: 11.5,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'anywhere',
          color: 'var(--muted, #888)',
          lineHeight: 1.55,
          borderTop: commandPart ? '1px dashed var(--border, #333)' : 'none',
          paddingTop: commandPart ? 8 : 0,
        }}>
          {outputPart}
        </pre>
      )}
    </TerminalChrome>
  )
}

// ── File activity card ──
function FileCard({ activity }: { activity: DisplayActivity }) {
  const detail = activity.detail?.trim()
  if (!detail) return null

  // Parse "Created path\nModified other" format
  const lines = detail.split('\n').filter(Boolean)
  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid var(--border, #333)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        background: 'var(--code-header-bg, #1e1e36)',
        borderBottom: '1px solid var(--border, #333)',
        fontSize: 11,
        color: 'var(--muted, #888)',
      }}>
        <IconFile />
        <span style={{ fontWeight: 600 }}>
          {activity.displayTitle}
          {activity.repeatCount > 1 ? ` x${activity.repeatCount}` : ''}
        </span>
      </div>
      <div style={{
        padding: '6px 12px',
        maxHeight: 200,
        overflow: 'auto',
        fontSize: 11.5,
        lineHeight: 1.6,
        fontFamily: 'var(--font-mono, monospace)',
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            color: line.toLowerCase().startsWith('creat') ? '#a5d6a7' :
                   line.toLowerCase().startsWith('delet') ? '#f07178' :
                   line.toLowerCase().startsWith('modif') || line.toLowerCase().startsWith('updat') ? '#ffcb6b' :
                   'var(--text-primary, #e2e8f0)',
          }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Web search activity card ──
function WebCard({ activity, expanded }: { activity: DisplayActivity; expanded: boolean }) {
  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid var(--border, #333)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--code-header-bg, #1e1e36)',
        borderBottom: expanded && activity.detail ? '1px solid var(--border, #333)' : 'none',
        fontSize: 11,
        color: 'var(--muted, #888)',
      }}>
        <IconGlobe />
        <span style={{ fontWeight: 600 }}>{activity.displayTitle}</span>
      </div>
      {expanded && activity.detail && (
        <div style={{
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--muted, #888)',
          lineHeight: 1.5,
        }}>
          {activity.detail}
        </div>
      )}
    </div>
  )
}

// ── Tool activity card ──
function ToolCard({ activity, expanded }: { activity: DisplayActivity; expanded: boolean }) {
  if (!expanded || !activity.detail) return null

  const { commandPart, outputPart } = parseTerminalContent(activity.detail)
  return (
    <TerminalChrome
      title={activity.displayTitle || 'Tool'}
      status={activity.status === 'running' ? 'running' : activity.status === 'failed' ? 'failed' : undefined}
      copyText={activity.detail}
    >
      {commandPart && (
        <div style={{ marginBottom: outputPart ? 8 : 0 }}>
          <span style={{ color: 'var(--primary, #7c6bf0)', userSelect: 'none', marginRight: 4 }}>{'>'}</span>
          <span style={{ color: 'var(--text-primary, #e2e8f0)', fontWeight: 500, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            {commandPart}
          </span>
        </div>
      )}
      {outputPart && (
        <pre style={{
          margin: 0,
          fontFamily: 'inherit',
          fontSize: 11.5,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'anywhere',
          color: 'var(--muted, #888)',
          lineHeight: 1.55,
          borderTop: commandPart ? '1px dashed var(--border, #333)' : 'none',
          paddingTop: commandPart ? 8 : 0,
        }}>
          {outputPart}
        </pre>
      )}
    </TerminalChrome>
  )
}

// ── Main ToolCallBlock component ──
export function ToolCallBlock({ activity, isPlaceholder }: Props) {
  const [expanded, setExpanded] = useState(false)
  const rawDetail = activity.detail?.trim()
  const hasDetail = !!rawDetail

  // Determine if this activity kind should be rendered as a rich card
  const richKinds = new Set(['command', 'file', 'web', 'tool'])
  const isRichCard = richKinds.has(activity.kind)
  const isCollapsible = isRichCard && hasDetail

  const handleToggle = () => {
    if (isCollapsible) {
      setExpanded((v) => !v)
    }
  }

  // Status display
  const statusText = activity.status === 'running' ? '· · ·' :
    activity.status === 'failed' ? 'failed' :
    activity.endedAt ? fmtDuration(activity.endedAt - activity.startedAt) : ''

  // If not a rich card kind (e.g., memory), fall back to simple row
  if (!isRichCard) {
    return (
      <div className={`act act-${activity.kind} act-${activity.status}`}>
        <div className="act-icon">{getActIcon(activity.kind)}</div>
        <div className="act-meat">
          <div className="act-title">
            {activity.displayTitle}
            {activity.repeatCount > 1 ? ` x${activity.repeatCount}` : ''}
          </div>
          {activity.detail && (
            <div className="act-detail">{activity.detail}</div>
          )}
        </div>
        <div className="act-status">{statusText}</div>
      </div>
    )
  }

  return (
    <div
      style={{ marginBottom: 4, cursor: isCollapsible ? 'pointer' : undefined }}
      onClick={handleToggle}
    >
      {/* Header row with title, expand toggle, status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'inline-flex', color: 'var(--muted, #888)', flexShrink: 0 }}>
            {getActIcon(activity.kind)}
          </div>
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-primary, #e2e8f0)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {activity.displayTitle}
            {activity.repeatCount > 1 ? ` x${activity.repeatCount}` : ''}
            {isPlaceholder ? ' · waiting for first token' : ''}
          </span>
          {isCollapsible && (
            <span style={{
              display: 'inline-flex',
              color: 'var(--muted, #888)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
              flexShrink: 0,
            }}>
              <IconChevron />
            </span>
          )}
        </div>
        <span style={{
          fontSize: 11,
          color: activity.status === 'failed' ? '#f07178' : 'var(--muted, #888)',
          flexShrink: 0,
        }}>
          {statusText}
        </span>
      </div>

      {/* Rich card content */}
      {activity.kind === 'command' && <CommandCard activity={activity} expanded={expanded} />}
      {activity.kind === 'file' && <FileCard activity={activity} />}
      {activity.kind === 'web' && <WebCard activity={activity} expanded={expanded} />}
      {activity.kind === 'tool' && <ToolCard activity={activity} expanded={expanded} />}

      {/* Failed notice */}
      {activity.status === 'failed' && (
        <div style={{ fontSize: 11, color: '#f07178', marginTop: 2, paddingLeft: 22 }}>
          Needs attention
        </div>
      )}
    </div>
  )
}
