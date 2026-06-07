import { useState } from 'react'
import { Highlight, type PrismTheme } from 'prism-react-renderer'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  code: string
  language?: string
  maxLines?: number
  showLineNumbers?: boolean
}

const prismTheme: PrismTheme = {
  plain: {
    color: 'var(--text-primary, #e2e8f0)',
    backgroundColor: 'transparent',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6b7280', fontStyle: 'italic' as const } },
    { types: ['string', 'attr-value', 'template-string'], style: { color: '#a5d6a7' } },
    { types: ['keyword', 'selector', 'important', 'atrule'], style: { color: '#c792ea' } },
    { types: ['function'], style: { color: '#82aaff' } },
    { types: ['tag'], style: { color: '#f07178' } },
    { types: ['number', 'boolean'], style: { color: '#f78c6c' } },
    { types: ['operator'], style: { color: '#89ddff' } },
    { types: ['punctuation'], style: { color: '#89ddff' } },
    { types: ['variable', 'parameter'], style: { color: '#e2e8f0' } },
    { types: ['property', 'attr-name'], style: { color: '#ffcb6b' } },
    { types: ['builtin', 'class-name', 'constant', 'symbol'], style: { color: '#ffcb6b' } },
    { types: ['regex'], style: { color: '#89ddff' } },
    { types: ['inserted'], style: { color: '#a5d6a7' } },
    { types: ['deleted'], style: { color: '#f07178' } },
  ],
}

export function CodeViewer({ code, language, maxLines = 20, showLineNumbers = false }: Props) {
  const [expanded, setExpanded] = useState(false)

  const allLines = code.split('\n')
  const isTruncated = !expanded && allLines.length > maxLines
  const visibleCode = isTruncated ? allLines.slice(0, maxLines).join('\n') : code

  const effectiveShowLineNumbers = showLineNumbers && !!language && language !== 'text'
  const languageLabel = language || 'code'
  const lineCountLabel = `${allLines.length} ${allLines.length === 1 ? 'line' : 'lines'}`
  const showExpandToggle = allLines.length > maxLines

  return (
    <div className="code-viewer" style={{ overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border, #333)', background: 'var(--code-bg, #1a1a2e)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border, #333)',
        padding: '4px 12px',
        fontSize: 11,
        color: 'var(--muted, #888)',
        background: 'var(--code-header-bg, #1e1e36)'
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{languageLabel}</span>
          <span>{lineCountLabel}</span>
        </div>
        <CopyButton
          text={code}
          label="Copy"
          copiedLabel="Copied"
          className="code-copy-btn"
        />
      </div>

      {/* Code area */}
      <div style={{ maxHeight: 420, overflow: 'auto', padding: '8px 12px' }}>
        <Highlight theme={prismTheme} code={visibleCode} language={language || 'text'}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre style={{
              margin: 0,
              fontFamily: 'var(--font-mono, "Fira Code", monospace)',
              fontSize: 12,
              lineHeight: 1.4,
              whiteSpace: 'pre',
              wordBreak: 'normal',
            }}>
              {tokens.map((line, index) => (
                <div key={index} {...getLineProps({ line })}>
                  {effectiveShowLineNumbers && (
                    <span style={{
                      display: 'inline-block',
                      minWidth: '2.5ch',
                      marginRight: 12,
                      textAlign: 'right',
                      userSelect: 'none',
                      color: 'var(--muted, #555)'
                    }}>
                      {index + 1}
                    </span>
                  )}
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>

      {/* Expand/collapse toggle */}
      {showExpandToggle && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: '100%',
            borderTop: '1px solid var(--border, #333)',
            padding: '6px 0',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--muted, #888)',
            background: 'var(--code-header-bg, #1e1e36)',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          {expanded ? 'Collapse' : `Show ${allLines.length - maxLines} more lines`}
        </button>
      )}
    </div>
  )
}
