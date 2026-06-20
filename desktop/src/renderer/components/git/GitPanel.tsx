import React, { useState } from 'react'
import { GitPanelModeStatus, GitBranchRow } from './GitPanelOverview'
import { GitDiffModeContent } from './GitDiffModeContent'
import { GitLogModeContent } from './GitLogModeContent'
import { GitDiffViewer } from './GitDiffViewer'
import { SidebarError, type GitFileStatus, type GitLogEntry } from './GitPanelShared'

export type GitPanelController = {
  branchName: string; fetchLoading: boolean; onFetch: () => void
  stagedFiles: GitFileStatus[]; unstagedFiles: GitFileStatus[]; totalAdditions: number; totalDeletions: number
  diffs: Array<{ path: string; status: string; diff: string }>; selectedDiffPath: string | null; onSelectDiffPath: (p: string) => void; diffLoading: boolean; diffError: string | null
  logEntries: GitLogEntry[]; logTotal: number; logAhead: number; logBehind: number; logAheadEntries: GitLogEntry[]; logBehindEntries: GitLogEntry[]; logUpstream: string | null; logLoading: boolean; logError: string | null
  commitMessage: string; onCommitMessageChange: (v: string) => void; commitLoading: boolean; onCommit: () => void
  onPush: () => void; pushLoading: boolean; onPull: () => void; pullLoading: boolean; onSync: () => void; syncLoading: boolean
  onStageFile: (p: string) => void; onUnstageFile: (p: string) => void; onStageAll: () => void; onUnstageAll: () => void; onRevertFile: (p: string) => void
  error: string | null; onDismissError: () => void; onRefresh: () => void
}

export function GitPanel({ controller }: { controller: GitPanelController }) {
  const [mode, setMode] = useState<'diff' | 'log'>('diff')
  const [selectedFiles] = useState<Set<string>>(new Set())
  const c = controller
  const diffStatusLabel = (c.totalAdditions > 0 || c.totalDeletions > 0) ? `+${c.totalAdditions} / -${c.totalDeletions}` : `${c.stagedFiles.length + c.unstagedFiles.length} files`
  const logCountLabel = c.logTotal ? `${c.logTotal} commits` : `${c.logEntries.length} commits`
  const logSyncLabel = c.logUpstream ? `\u2191${c.logAhead} \u2193${c.logBehind}` : 'No upstream'
  return (
    <div className="git-panel">
      <div className="git-panel-header">
        <div className="git-panel-mode-select">
          <select className="git-panel-select-input" value={mode} onChange={e => setMode(e.target.value as 'diff' | 'log')}>
            <option value="diff">Diff</option>
            <option value="log">Log</option>
          </select>
        </div>
        <div className="git-panel-overview">
          <div className="git-panel-overview-status"><GitPanelModeStatus mode={mode} diffStatusLabel={diffStatusLabel} logCountLabel={logCountLabel} logSyncLabel={logSyncLabel} /></div>
          <GitBranchRow branchName={c.branchName} onFetch={c.onFetch} fetchLoading={c.fetchLoading} />
        </div>
      </div>
      <div className="git-panel-content">
        {mode === 'diff' ? (
          <>
            <GitDiffModeContent commitMessage={c.commitMessage} onCommitMessageChange={c.onCommitMessageChange} stagedFiles={c.stagedFiles} unstagedFiles={c.unstagedFiles} commitLoading={c.commitLoading} onCommit={c.onCommit} commitsAhead={c.logAhead} commitsBehind={c.logBehind} onPull={c.onPull} pullLoading={c.pullLoading} onPush={c.onPush} pushLoading={c.pushLoading} onSync={c.onSync} syncLoading={c.syncLoading} onStageAll={c.onStageAll} onStageFile={c.onStageFile} onUnstageFile={c.onUnstageFile} onUnstageAll={c.onUnstageAll} onRevertFile={c.onRevertFile} selectedFiles={selectedFiles} selectedPath={c.selectedDiffPath} onSelectFile={c.onSelectDiffPath} />
            {c.selectedDiffPath && <GitDiffViewer diffs={c.diffs} selectedPath={c.selectedDiffPath} isLoading={c.diffLoading} error={c.diffError} />}
          </>
        ) : (
          <GitLogModeContent logError={c.logError} logLoading={c.logLoading} logEntries={c.logEntries} showAheadSection={Boolean(c.logUpstream && c.logAhead > 0)} showBehindSection={Boolean(c.logUpstream && c.logBehind > 0)} logAheadEntries={c.logAheadEntries} logBehindEntries={c.logBehindEntries} selectedCommitSha={null} />
        )}
      </div>
      {c.error && <SidebarError message={c.error} onDismiss={c.onDismissError} />}
    </div>
  )
}
