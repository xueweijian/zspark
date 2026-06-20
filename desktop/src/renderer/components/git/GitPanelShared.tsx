import React from 'react'

export type GitFileStatus = { path: string; status: string; additions: number; deletions: number }
export type GitLogEntry = { sha: string; summary: string; author: string; timestamp: number }

function splitPath(p: string) {
  const parts = p.split('/')
  return parts.length === 1 ? { name: p, dir: '' } : { name: parts[parts.length - 1], dir: parts.slice(0, -1).join('/') }
}
function splitExt(name: string) {
  const i = name.lastIndexOf('.')
  return i <= 0 ? { base: name, ext: '' } : { base: name.slice(0, i), ext: name.slice(i + 1) }
}
function statusIcon(s: string) { return s === 'A' ? '+' : s === 'D' ? '-' : s === 'R' ? 'R' : s === '??' ? '?' : 'M' }
function statusClass(s: string) { return s === 'A' ? 'diff-icon-added' : s === 'D' ? 'diff-icon-deleted' : s === 'R' ? 'diff-icon-renamed' : 'diff-icon-modified' }
function relTime(ts: number) {
  const d = Date.now() - ts * 1000
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`
  return `${Math.floor(d / 86400000)}d ago`
}

type DiffFileRowProps = { file: GitFileStatus; isSelected: boolean; onClick: () => void; onStage?: (p: string) => void; onUnstage?: (p: string) => void; onRevert?: (p: string) => void; section: 'staged' | 'unstaged' }
export function DiffFileRow({ file, isSelected, onClick, onStage, onUnstage, onRevert, section }: DiffFileRowProps) {
  const { name, dir } = splitPath(file.path)
  const { base, ext } = splitExt(name)
  return (
    <div className={`diff-row${isSelected ? ' diff-row-selected' : ''}`} role="button" tabIndex={0} onClick={onClick}>
      <span className={`diff-icon ${statusClass(file.status)}`} aria-hidden>{statusIcon(file.status)}</span>
      <div className="diff-file">
        <div className="diff-path"><span className="diff-name"><span className="diff-name-base">{base}</span>{ext && <span className="diff-name-ext">.{ext}</span>}</span></div>
        {dir && <div className="diff-dir">{dir}</div>}
      </div>
      <div className="diff-row-meta">
        <span className="diff-counts-inline"><span className="diff-add">+{file.additions}</span><span className="diff-sep">/</span><span className="diff-del">-{file.deletions}</span></span>
        <div className="diff-row-actions">
          {section === 'unstaged' && onStage && <button type="button" className="diff-row-action diff-row-action--stage" onClick={e => { e.stopPropagation(); onStage(file.path) }} title="Stage">+</button>}
          {section === 'staged' && onUnstage && <button type="button" className="diff-row-action diff-row-action--unstage" onClick={e => { e.stopPropagation(); onUnstage(file.path) }} title="Unstage">-</button>}
          {section === 'unstaged' && onRevert && <button type="button" className="diff-row-action diff-row-action--discard" onClick={e => { e.stopPropagation(); onRevert(file.path) }} title="Discard">&#x21bb;</button>}
        </div>
      </div>
    </div>
  )
}

type DiffSectionProps = { title: string; files: GitFileStatus[]; section: 'staged' | 'unstaged'; selectedFiles: Set<string>; selectedPath: string | null; onSelectFile?: (p: string) => void; onStageAll?: () => void; onStageFile?: (p: string) => void; onUnstageFile?: (p: string) => void; onUnstageAll?: () => void; onRevertFile?: (p: string) => void }
export function DiffSection({ title, files, section, selectedFiles, selectedPath, onSelectFile, onStageAll, onStageFile, onUnstageFile, onUnstageAll, onRevertFile }: DiffSectionProps) {
  return (
    <div className="diff-section">
      <div className="diff-section-title">
        <div className="diff-section-heading"><span className="diff-section-label">{title}</span><span className="diff-section-count">{files.length}</span></div>
        {section === 'unstaged' && onStageAll && files.length > 0 && <button type="button" className="diff-row-action diff-row-action--stage" onClick={onStageAll} title="Stage all">+</button>}
        {section === 'staged' && onUnstageAll && files.length > 0 && <button type="button" className="diff-row-action diff-row-action--unstage" onClick={onUnstageAll} title="Unstage all">-</button>}
      </div>
      <div className="diff-section-list">
        {files.map(f => <DiffFileRow key={`${section}-${f.path}`} file={f} isSelected={selectedFiles.has(f.path)} section={section} onClick={() => onSelectFile?.(f.path)} onStage={onStageFile} onUnstage={onUnstageFile} onRevert={onRevertFile} />)}
      </div>
    </div>
  )
}

type GitLogEntryRowProps = { entry: GitLogEntry; isSelected: boolean; compact?: boolean; onSelect?: (e: GitLogEntry) => void }
export function GitLogEntryRow({ entry, isSelected, compact, onSelect }: GitLogEntryRowProps) {
  return (
    <div className={`git-log-entry${compact ? ' git-log-entry-compact' : ''}${isSelected ? ' git-log-entry-active' : ''}`} onClick={() => onSelect?.(entry)} role="button" tabIndex={0}>
      <div className="git-log-summary">{entry.summary || 'No message'}</div>
      <div className="git-log-meta">
        <span className="git-log-sha">{entry.sha.slice(0, 7)}</span>
        <span className="git-log-sep">&middot;</span>
        <span className="git-log-author">{entry.author || 'Unknown'}</span>
        <span className="git-log-sep">&middot;</span>
        <span className="git-log-date">{relTime(entry.timestamp)}</span>
      </div>
    </div>
  )
}

export function CommitButton({ commitMessage, hasChanges, loading, onCommit }: { commitMessage: string; hasChanges: boolean; loading: boolean; onCommit: () => void }) {
  const canCommit = commitMessage.trim().length > 0 && hasChanges && !loading
  return (
    <button type="button" className="commit-button" onClick={() => { if (canCommit) onCommit() }} disabled={!canCommit}>
      {loading ? <span className="commit-button-spinner" aria-hidden /> : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>}
      <span>{loading ? 'Committing...' : 'Commit'}</span>
    </button>
  )
}

export function SidebarError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="sidebar-error">
      <div className="sidebar-error-body"><div className="sidebar-error-message">{message}</div></div>
      <button type="button" className="sidebar-error-dismiss" onClick={onDismiss}>&times;</button>
    </div>
  )
}
