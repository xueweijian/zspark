import React, { useMemo } from 'react'

type DiffLine = { type: 'add' | 'del' | 'context' | 'hunk'; content: string; oldLine: number | null; newLine: number | null }

function parseDiff(diff: string): DiffLine[] {
  if (!diff) return []
  const lines = diff.split('\n')
  const result: DiffLine[] = []
  let oldLine = 0, newLine = 0
  for (const raw of lines) {
    if (raw.startsWith('diff --git') || raw.startsWith('index ') || raw.startsWith('old mode') || raw.startsWith('new mode') || raw.startsWith('new file') || raw.startsWith('deleted file') || raw.startsWith('similarity') || raw.startsWith('rename') || raw.startsWith('Binary')) continue
    if (raw.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
      if (m) { oldLine = parseInt(m[1], 10); newLine = parseInt(m[2], 10) }
      result.push({ type: 'hunk', content: raw, oldLine: null, newLine: null }); continue
    }
    if (raw.startsWith('+')) { result.push({ type: 'add', content: raw.slice(1), oldLine: null, newLine }); newLine++; continue }
    if (raw.startsWith('-')) { result.push({ type: 'del', content: raw.slice(1), oldLine, newLine: null }); oldLine++; continue }
    const content = raw.startsWith(' ') ? raw.slice(1) : raw
    result.push({ type: 'context', content, oldLine, newLine }); oldLine++; newLine++
  }
  return result
}

export function GitDiffCard({ path, status, diff }: { path: string; status: string; diff: string }) {
  const lines = useMemo(() => parseDiff(diff), [diff])
  const isBinary = /Binary files?/.test(diff)
  if (!diff) return <div className="diff-viewer-item"><div className="diff-viewer-loading">No diff content.</div></div>
  if (isBinary) return <div className="diff-viewer-item"><div className="diff-viewer-output"><div className="diff-viewer-line diff-viewer-line-context"><span className="diff-viewer-line-content">Binary file changed</span></div></div></div>
  return (
    <div className="diff-viewer-item">
      <div className="diff-viewer-output">
        {lines.map((line, i) => {
          const cls = line.type === 'add' ? 'diff-viewer-line-add' : line.type === 'del' ? 'diff-viewer-line-del' : line.type === 'hunk' ? 'diff-viewer-line-hunk' : 'diff-viewer-line-context'
          return <div key={i} className={`diff-viewer-line ${cls}`}><span className="diff-viewer-line-num">{line.oldLine ?? ''}</span><span className="diff-viewer-line-num">{line.newLine ?? ''}</span><span className="diff-viewer-line-content">{line.content}</span></div>
        })}
      </div>
    </div>
  )
}
