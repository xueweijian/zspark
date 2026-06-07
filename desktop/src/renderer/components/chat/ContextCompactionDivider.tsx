import React from 'react'

type Props = {
  message?: string
  timestamp?: number
}

export const ContextCompactionDivider = React.memo(function ContextCompactionDivider({ message, timestamp }: Props) {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="context-compaction-divider">
      <div className="compaction-line" />
      <div className="compaction-content">
        <span className="compaction-icon">🔄</span>
        <span className="compaction-text">{message || 'Context compacted'}</span>
        {formattedTime && <span className="compaction-time">{formattedTime}</span>}
      </div>
      <div className="compaction-line" />
    </div>
  )
})
