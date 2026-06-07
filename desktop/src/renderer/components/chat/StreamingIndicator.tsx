import { useEffect, useState } from 'react'
import type { Block } from '../../appTypes'

type TurnBlock = Extract<Block, { type: 'turn' }>

type Props = {
  turn: TurnBlock
  activities?: Array<{ kind: string }>
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export function StreamingIndicator({ turn, activities }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const elapsed = now - turn.startedAt

  // Derive verb from activities
  let verb = 'Working'
  if (activities?.some((a) => a.kind === 'command')) {
    verb = 'Running'
  } else if (activities?.some((a) => a.kind === 'reasoning')) {
    verb = 'Thinking'
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 12px',
      borderRadius: 16,
      border: '1px solid var(--border, #333)',
      background: 'var(--surface, #1a1a2e)',
      width: 'fit-content',
      marginBottom: 8,
    }}>
      <span style={{ color: 'var(--primary, #7c6bf0)', fontSize: 12, animation: 'pulse 2s ease-in-out infinite' }}>
        ✦
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
        {verb}...
      </span>
      {elapsed > 0 && (
        <span style={{ fontSize: 10, color: 'var(--muted, #666)' }}>
          {formatElapsed(elapsed)}
        </span>
      )}
    </div>
  )
}
