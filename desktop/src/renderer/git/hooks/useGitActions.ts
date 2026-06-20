// desktop/src/renderer/git/hooks/useGitActions.ts

import { useState, useCallback } from 'react'
import { gitBridge } from '../gitBridge'

interface UseGitActionsParams {
  cwd: string | null
  onRefreshStatus: () => void
  onRefreshDiffs: () => void
}

interface ActionState {
  loading: boolean
  error: string | null
}

interface GitActionsResult {
  stageFile: (path: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageFile: (path: string) => Promise<void>
  unstageAll: () => Promise<void>
  revertFile: (path: string) => Promise<void>
  revertAll: () => Promise<void>
  commit: (message: string) => Promise<void>
  push: () => Promise<void>
  pull: () => Promise<void>
  fetch: () => Promise<void>
  sync: () => Promise<void>
  state: ActionState
}

export function useGitActions({ cwd, onRefreshStatus, onRefreshDiffs }: UseGitActionsParams): GitActionsResult {
  const [state, setState] = useState<ActionState>({ loading: false, error: null })

  const runAction = useCallback(
    async (action: () => Promise<any>) => {
      if (!cwd) return
      setState({ loading: true, error: null })
      try {
        await action()
        setState({ loading: false, error: null })
        onRefreshStatus()
        onRefreshDiffs()
      } catch (err) {
        setState({ loading: false, error: err instanceof Error ? err.message : String(err) })
      }
    },
    [cwd, onRefreshStatus, onRefreshDiffs],
  )

  const stageFile = useCallback(
    (path: string) => runAction(() => gitBridge.stageFile(cwd!, path)),
    [runAction, cwd],
  )

  const stageAll = useCallback(
    () => runAction(() => gitBridge.stageAll(cwd!)),
    [runAction, cwd],
  )

  const unstageFile = useCallback(
    (path: string) => runAction(() => gitBridge.unstageFile(cwd!, path)),
    [runAction, cwd],
  )

  const unstageAll = useCallback(
    () => runAction(() => gitBridge.unstageFile(cwd!, '.')),
    [runAction, cwd],
  )

  const revertFile = useCallback(
    (path: string) => runAction(() => gitBridge.revertFile(cwd!, path)),
    [runAction, cwd],
  )

  const revertAll = useCallback(
    () => runAction(() => gitBridge.revertAll(cwd!)),
    [runAction, cwd],
  )

  const commit = useCallback(
    (message: string) => runAction(() => gitBridge.commit(cwd!, message)),
    [runAction, cwd],
  )

  const push = useCallback(
    () => runAction(() => gitBridge.push(cwd!)),
    [runAction, cwd],
  )

  const pull = useCallback(
    () => runAction(() => gitBridge.pull(cwd!)),
    [runAction, cwd],
  )

  const fetch = useCallback(
    () => runAction(() => gitBridge.fetch(cwd!)),
    [runAction, cwd],
  )

  const sync = useCallback(
    () => runAction(() => gitBridge.sync(cwd!)),
    [runAction, cwd],
  )

  return { stageFile, stageAll, unstageFile, unstageAll, revertFile, revertAll, commit, push, pull, fetch, sync, state }
}
