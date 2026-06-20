import React from 'react'
import { DiffSection, CommitButton, type GitFileStatus } from './GitPanelShared'

type Props = {
  commitMessage: string; onCommitMessageChange: (v: string) => void
  stagedFiles: GitFileStatus[]; unstagedFiles: GitFileStatus[]
  commitLoading: boolean; onCommit: () => void
  commitsAhead: number; commitsBehind: number
  onPull?: () => void; pullLoading: boolean
  onPush?: () => void; pushLoading: boolean
  onSync?: () => void; syncLoading: boolean
  onStageAll?: () => void; onStageFile?: (p: string) => void; onUnstageFile?: (p: string) => void; onUnstageAll?: () => void; onRevertFile?: (p: string) => void
  selectedFiles: Set<string>; selectedPath: string | null; onSelectFile?: (p: string) => void
}

export function GitDiffModeContent(p: Props) {
  const hasChanges = p.stagedFiles.length > 0 || p.unstagedFiles.length > 0
  return (
    <div className="diff-list">
      {hasChanges && (
        <div className="commit-message-section">
          <textarea className="commit-message-input" placeholder="Commit message..." value={p.commitMessage} onChange={e => p.onCommitMessageChange(e.target.value)} disabled={p.commitLoading} rows={2} />
          <CommitButton commitMessage={p.commitMessage} hasChanges={hasChanges} loading={p.commitLoading} onCommit={p.onCommit} />
        </div>
      )}
      {(p.commitsAhead > 0 || p.commitsBehind > 0) && (
        <div className="push-section">
          <div className="push-sync-buttons">
            {p.commitsBehind > 0 && <button type="button" className="push-button-secondary" onClick={() => p.onPull?.()} disabled={!p.onPull || p.pullLoading || p.syncLoading}>{p.pullLoading ? <span className="commit-button-spinner" aria-hidden /> : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>}<span>{p.pullLoading ? 'Pulling...' : 'Pull'}</span><span className="push-count">{p.commitsBehind}</span></button>}
            {p.commitsAhead > 0 && <button type="button" className="push-button" onClick={() => p.onPush?.()} disabled={!p.onPush || p.pushLoading || p.commitsBehind > 0}>{p.pushLoading ? <span className="commit-button-spinner" aria-hidden /> : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-6.2-8.6" /><path d="M21 3v5h-5" /></svg>}<span>Push</span><span className="push-count">{p.commitsAhead}</span></button>}
          </div>
          {p.commitsAhead > 0 && p.commitsBehind > 0 && <button type="button" className="push-button-secondary" onClick={() => p.onSync?.()} disabled={!p.onSync || p.syncLoading || p.pullLoading}>{p.syncLoading ? <span className="commit-button-spinner" aria-hidden /> : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 0 1-15.2 6.5" /><path d="M3 12A9 9 0 0 1 18.2 5.5" /><path d="M3 18v-5h5M21 6v5h-5" /></svg>}<span>{p.syncLoading ? 'Syncing...' : 'Sync'}</span></button>}
        </div>
      )}
      {!hasChanges && p.commitsAhead === 0 && p.commitsBehind === 0 && <div className="git-empty">No changes detected.</div>}
      {p.stagedFiles.length > 0 && <DiffSection title="Staged" files={p.stagedFiles} section="staged" selectedFiles={p.selectedFiles} selectedPath={p.selectedPath} onSelectFile={p.onSelectFile} onUnstageFile={p.onUnstageFile} onUnstageAll={p.onUnstageAll} onRevertFile={p.onRevertFile} />}
      {p.unstagedFiles.length > 0 && <DiffSection title="Unstaged" files={p.unstagedFiles} section="unstaged" selectedFiles={p.selectedFiles} selectedPath={p.selectedPath} onSelectFile={p.onSelectFile} onStageAll={p.onStageAll} onStageFile={p.onStageFile} onRevertFile={p.onRevertFile} />}
    </div>
  )
}
