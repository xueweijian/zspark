import React from 'react'

export function GitPanelModeStatus({ mode, diffStatusLabel, logCountLabel, logSyncLabel }: { mode: 'diff' | 'log'; diffStatusLabel: string; logCountLabel: string; logSyncLabel: string }) {
  if (mode === 'diff') return <div className="diff-status">{diffStatusLabel}</div>
  return (<><div className="diff-status">{logCountLabel}</div><div className="git-log-sync"><span>{logSyncLabel}</span></div></>)
}

export function GitBranchRow({ branchName, onFetch, fetchLoading }: { branchName: string; onFetch?: () => void; fetchLoading: boolean }) {
  return (
    <div className="diff-branch-row">
      <div className="diff-branch-meta"><span className="diff-branch-label">Branch</span><div className="diff-branch">{branchName || 'unknown'}</div></div>
      <button type="button" className="diff-branch-refresh" onClick={() => onFetch?.()} disabled={!onFetch || fetchLoading} title="Fetch remote">
        {fetchLoading ? <span className="git-panel-spinner" aria-hidden /> : <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 0 1-15.2 6.5" /><path d="M3 12A9 9 0 0 1 18.2 5.5" /><path d="M3 18v-5h5M21 6v5h-5" /></svg>}
      </button>
    </div>
  )
}
