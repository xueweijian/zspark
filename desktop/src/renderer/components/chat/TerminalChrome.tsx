import React from 'react'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  title?: string
  children: React.ReactNode
  status?: 'running' | 'done' | 'failed'
  copyText?: string
}

export function TerminalChrome({ title = 'Terminal', children, status, copyText }: Props) {
  return (
    <div style={{
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--border, #333)',
      background: 'var(--code-bg, #1a1a2e)',
      fontFamily: 'var(--font-mono, "Fira Code", monospace)',
    }}>
      {/* macOS-style title bar with traffic lights */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: 'var(--code-header-bg, #1e1e36)',
        borderBottom: '1px solid var(--border, #333)',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Traffic lights */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <span style={{
            fontSize: 11,
            color: 'var(--muted, #888)',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}>
            {title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'running' && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--primary, #7c6bf0)',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
          )}
          {status === 'failed' && (
            <span style={{ fontSize: 11, color: '#f07178' }}>failed</span>
          )}
          {copyText && (
            <CopyButton
              text={copyText}
              label="Copy"
              copiedLabel="Copied"
            />
          )}
        </div>
      </div>

      {/* Content area */}
      <div style={{
        padding: '10px 14px',
        maxHeight: 300,
        overflow: 'auto',
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--text-primary, #e2e8f0)',
      }}>
        {children}
      </div>
    </div>
  )
}
