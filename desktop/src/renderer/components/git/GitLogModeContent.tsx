import React from 'react'
import { GitLogEntryRow, type GitLogEntry } from './GitPanelShared'

type Props = {
  logError: string | null; logLoading: boolean; logEntries: GitLogEntry[]
  showAheadSection: boolean; showBehindSection: boolean
  logAheadEntries: GitLogEntry[]; logBehindEntries: GitLogEntry[]
  selectedCommitSha: string | null; onSelectCommit?: (e: GitLogEntry) => void
}

export function GitLogModeContent(p: Props) {
  return (
    <div className="git-log-list">
      {!p.logError && p.logLoading && <div className="diff-viewer-loading">Loading commits...</div>}
      {!p.logError && !p.logLoading && !p.logEntries.length && !p.showAheadSection && !p.showBehindSection && <div className="git-empty">No commits yet.</div>}
      {p.showAheadSection && <div className="git-log-section"><div className="git-log-section-title">To push</div><div className="git-log-section-list">{p.logAheadEntries.map(e => <GitLogEntryRow key={e.sha} entry={e} isSelected={p.selectedCommitSha === e.sha} compact onSelect={p.onSelectCommit} />)}</div></div>}
      {p.showBehindSection && <div className="git-log-section"><div className="git-log-section-title">To pull</div><div className="git-log-section-list">{p.logBehindEntries.map(e => <GitLogEntryRow key={e.sha} entry={e} isSelected={p.selectedCommitSha === e.sha} compact onSelect={p.onSelectCommit} />)}</div></div>}
      <div className="git-log-section"><div className="git-log-section-title">Recent commits</div><div className="git-log-section-list">{p.logEntries.map(e => <GitLogEntryRow key={e.sha} entry={e} isSelected={p.selectedCommitSha === e.sha} onSelect={p.onSelectCommit} />)}</div></div>
    </div>
  )
}
