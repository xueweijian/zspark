import React from 'react'
import { GitDiffCard } from './GitDiffCard'

type DiffEntry = { path: string; status: string; diff: string }

export function GitDiffViewer({ diffs, selectedPath, isLoading, error }: { diffs: DiffEntry[]; selectedPath: string | null; isLoading: boolean; error: string | null }) {
  if (isLoading) return <div className="diff-viewer"><div className="diff-viewer-loading">Loading diff...</div></div>
  if (error) return <div className="diff-viewer"><div className="diff-viewer-loading">{error}</div></div>
  if (diffs.length === 0) return <div className="diff-viewer"><div className="diff-viewer-loading">Select a file to view diff.</div></div>
  const activeDiff = selectedPath ? diffs.find(d => d.path === selectedPath) : null
  const displayDiffs = activeDiff ? [activeDiff] : diffs
  return (
    <div className="diff-viewer">
      {activeDiff && <div className="diff-viewer-sticky"><div className="diff-viewer-header"><span className="diff-viewer-status" data-status={activeDiff.status}>{activeDiff.status}</span><span className="diff-viewer-path">{activeDiff.path}</span></div></div>}
      {displayDiffs.map(e => <GitDiffCard key={e.path} path={e.path} status={e.status} diff={e.diff} />)}
    </div>
  )
}
