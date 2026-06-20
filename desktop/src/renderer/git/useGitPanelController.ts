// useGitPanelController — orchestrates git hooks and returns a flat GitPanelController.

import { useState, useCallback, useMemo } from 'react'
import { useGitStatus } from './hooks/useGitStatus'
import { useGitDiffs } from './hooks/useGitDiffs'
import { useGitLog } from './hooks/useGitLog'
import { useGitActions } from './hooks/useGitActions'
import { useGitBranches } from './hooks/useGitBranches'
import { useDiffFileSelection } from './hooks/useDiffFileSelection'
import type { GitFileStatus } from '../components/git/GitPanelShared'

// Re-export for convenience
export type { GitFileStatus }

export function useGitPanelController(cwd: string) {
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [commitLoading, setCommitLoading] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pullLoading, setPullLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data hooks
  const status = useGitStatus(cwd)
  const diffs = useGitDiffs(cwd, status.files, true)
  const log = useGitLog(cwd, true)
  const branches = useGitBranches(cwd)
  const fileSelection = useDiffFileSelection(status.files)

  const actions = useGitActions({
    cwd: cwd || null,
    onRefreshStatus: status.refresh,
    onRefreshDiffs: diffs.refresh,
  })

  // Convert diffs to the format GitDiffViewer expects
  const flatDiffs = useMemo(() =>
    diffs.diffs.map(d => ({ path: d.path, status: d.status, diff: d.diff })),
    [diffs.diffs]
  )

  // Callbacks
  const onSelectDiffPath = useCallback((path: string) => {
    setSelectedDiffPath(path)
  }, [])

  const onStageFile = useCallback(async (path: string) => {
    try { await actions.stageFile(path) } catch (e: any) { setError(e?.message ?? 'Failed to stage') }
  }, [actions.stageFile])

  const onUnstageFile = useCallback(async (path: string) => {
    try { await actions.unstageFile(path) } catch (e: any) { setError(e?.message ?? 'Failed to unstage') }
  }, [actions.unstageFile])

  const onStageAll = useCallback(async () => {
    try { await actions.stageAll() } catch (e: any) { setError(e?.message ?? 'Failed to stage all') }
  }, [actions.stageAll])

  const onUnstageAll = useCallback(async () => {
    try { await actions.unstageAll() } catch (e: any) { setError(e?.message ?? 'Failed to unstage all') }
  }, [actions.unstageAll])

  const onRevertFile = useCallback(async (path: string) => {
    try { await actions.revertFile(path) } catch (e: any) { setError(e?.message ?? 'Failed to revert') }
  }, [actions.revertFile])

  const onCommit = useCallback(async () => {
    if (!commitMessage.trim()) return
    setCommitLoading(true)
    setError(null)
    try {
      await actions.commit(commitMessage)
      setCommitMessage('')
    } catch (e: any) {
      setError(e?.message ?? 'Failed to commit')
    } finally {
      setCommitLoading(false)
    }
  }, [commitMessage, actions.commit])

  const onPush = useCallback(async () => {
    setPushLoading(true)
    setError(null)
    try { await actions.push(); await log.refresh() }
    catch (e: any) { setError(e?.message ?? 'Failed to push') }
    finally { setPushLoading(false) }
  }, [actions.push, log.refresh])

  const onPull = useCallback(async () => {
    setPullLoading(true)
    setError(null)
    try { await actions.pull(); await Promise.all([status.refresh(), log.refresh()]) }
    catch (e: any) { setError(e?.message ?? 'Failed to pull') }
    finally { setPullLoading(false) }
  }, [actions.pull, status.refresh, log.refresh])

  const onFetch = useCallback(async () => {
    setFetchLoading(true)
    setError(null)
    try { await actions.fetch(); await log.refresh() }
    catch (e: any) { setError(e?.message ?? 'Failed to fetch') }
    finally { setFetchLoading(false) }
  }, [actions.fetch, log.refresh])

  const onSync = useCallback(async () => {
    setSyncLoading(true)
    setError(null)
    try { await actions.sync(); await Promise.all([status.refresh(), log.refresh()]) }
    catch (e: any) { setError(e?.message ?? 'Failed to sync') }
    finally { setSyncLoading(false) }
  }, [actions.sync, status.refresh, log.refresh])

  const onDismissError = useCallback(() => setError(null), [])

  const onRefresh = useCallback(() => {
    status.refresh()
    diffs.refresh()
    log.refresh()
    branches.refresh()
  }, [status.refresh, diffs.refresh, log.refresh, branches.refresh])

  return {
    // Branch
    branchName: status.branchName,
    fetchLoading,
    onFetch,

    // Status
    stagedFiles: status.stagedFiles,
    unstagedFiles: status.unstagedFiles,
    totalAdditions: status.totalAdditions,
    totalDeletions: status.totalDeletions,

    // Diffs
    diffs: flatDiffs,
    selectedDiffPath,
    onSelectDiffPath,
    diffLoading: diffs.isLoading,
    diffError: diffs.error,

    // Log
    logEntries: log.entries,
    logTotal: log.total,
    logAhead: log.ahead,
    logBehind: log.behind,
    logAheadEntries: log.aheadEntries,
    logBehindEntries: log.behindEntries,
    logUpstream: log.upstream,
    logLoading: log.isLoading,
    logError: log.error,

    // Commit
    commitMessage,
    onCommitMessageChange: setCommitMessage,
    commitLoading,
    onCommit,

    // Push/Pull/Sync
    onPush, pushLoading,
    onPull, pullLoading,
    onSync, syncLoading,

    // Stage/Unstage
    onStageFile, onUnstageFile, onStageAll, onUnstageAll, onRevertFile,

    // Error
    error, onDismissError,

    // Refresh
    onRefresh,
  }
}
