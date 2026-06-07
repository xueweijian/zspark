import { useState } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { CodeViewer } from './CodeViewer'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  oldCode?: string
  newCode?: string
  language?: string
  fileName?: string
  splitView?: boolean
}

// Dark theme styles for react-diff-viewer-continued
const darkDiffStyles = {
  variables: {
    dark: {
      diffViewerColor: '#e2e8f0',
      diffViewerBackground: '#1a1a2e',
      addedBackground: '#1a3a2a',
      addedColor: '#a5d6a7',
      removedBackground: '#3a1a1a',
      removedColor: '#f07178',
      wordAddedBackground: '#2a5a3a',
      wordRemovedBackground: '#5a2a2a',
      addedGutterBackground: '#1a3a2a',
      removedGutterBackground: '#3a1a1a',
      gutterBackground: '#1e1e36',
      gutterBackgroundDark: '#16162a',
      highlightBackground: '#2a2a4a',
      highlightGutterBackground: '#2a2a4a',
      codeFoldGutterBackground: '#1e1e36',
      codeFoldBackground: '#16162a',
      emptyLineBackground: '#1a1a2e',
      gutterColor: '#555',
      addedGutterColor: '#a5d6a7',
      removedGutterColor: '#f07178',
      codeFoldContentColor: '#888',
      diffViewerTitleBackground: '#1e1e36',
      diffViewerTitleColor: '#888',
      diffViewerTitleBorderColor: '#333',
    },
  },
  line: {
    fontSize: 12,
    fontFamily: 'var(--font-mono, "Fira Code", monospace)',
  },
  splitView: {
    fontSize: 12,
    fontFamily: 'var(--font-mono, "Fira Code", monospace)',
  },
}

export function DiffViewer({ oldCode, newCode, language, fileName, splitView = false }: Props) {
  const [expanded, setExpanded] = useState(false)

  // If only new code (file creation), show CodeViewer
  if (!oldCode && newCode) {
    return (
      <div>
        {fileName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 12px',
            background: 'var(--code-header-bg, #1e1e36)',
            border: '1px solid var(--border, #333)',
            borderBottom: 'none',
            borderRadius: '8px 8px 0 0',
            fontSize: 11,
            color: 'var(--muted, #888)',
          }}>
            <span style={{ fontWeight: 600 }}>{fileName}</span>
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: '#1a3a2a',
              color: '#a5d6a7',
            }}>new file</span>
          </div>
        )}
        <CodeViewer code={newCode} language={language} maxLines={20} />
      </div>
    )
  }

  // If only old code (file deletion), show CodeViewer with delete marker
  if (oldCode && !newCode) {
    return (
      <div>
        {fileName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 12px',
            background: 'var(--code-header-bg, #1e1e36)',
            border: '1px solid var(--border, #333)',
            borderBottom: 'none',
            borderRadius: '8px 8px 0 0',
            fontSize: 11,
            color: 'var(--muted, #888)',
          }}>
            <span style={{ fontWeight: 600 }}>{fileName}</span>
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: '#3a1a1a',
              color: '#f07178',
            }}>deleted</span>
          </div>
        )}
        <CodeViewer code={oldCode} language={language} maxLines={20} />
      </div>
    )
  }

  // Both old and new code exist: show diff
  if (!oldCode || !newCode) return null

  const lineCount = Math.max(oldCode.split('\n').length, newCode.split('\n').length)
  const showExpandToggle = lineCount > 30
  const shouldShowInline = !expanded && showExpandToggle

  return (
    <div style={{
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--border, #333)',
    }}>
      {/* Header */}
      {fileName && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          background: 'var(--code-header-bg, #1e1e36)',
          borderBottom: '1px solid var(--border, #333)',
          fontSize: 11,
          color: 'var(--muted, #888)',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{fileName}</span>
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: '#2a2a4a',
              color: 'var(--primary, #7c6bf0)',
            }}>modified</span>
          </div>
          <CopyButton
            text={newCode}
            label="Copy"
            copiedLabel="Copied"
            className="code-copy-btn"
          />
        </div>
      )}

      {/* Diff viewer */}
      <div style={{
        maxHeight: shouldShowInline ? 300 : undefined,
        overflow: 'auto',
      }}>
        <ReactDiffViewer
          oldValue={oldCode}
          newValue={newCode}
          splitView={splitView}
          useDarkTheme
          styles={darkDiffStyles}
          compareMethod={DiffMethod.WORDS}
        />
      </div>

      {/* Expand toggle */}
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
          {expanded ? 'Collapse' : `Show all ${lineCount} lines`}
        </button>
      )}
    </div>
  )
}
