// desktop/src/renderer/git/hooks/useGitCommitDiffs.ts

import { useState, useEffect, useRef, useCallback } from 'react'
import { gitBridge } from '../gitBridge'
import type { GitCommitDiff } from '../types'

interface GitCommitDiffsResult {
  diffs: GitCommitDiff[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useGitCommitDiffs(cwd: string | null, sha: string | null, enabled: boolean): GitCommitDiffsResult {
  const [diffs, setDiffs] = useState<GitCommitDiff[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestIdRef = useRef(0)

  const fetchCommitDiffs = useCallback(async () => {
    if (!cwd || !sha || !enabled) {
      setDiffs([])
      return
    }
    const rid = ++requestIdRef.current
    setIsLoading(true)
    try {
      const result = await gitBridge.commitDiff(cwd, sha)
      if (rid !== requestIdRef.current) return
      setDiffs(result)
      setError(null)
    } catch (err) {
      if (rid !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (rid === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [cwd, sha, enabled])

  useEffect(() => {
    void fetchCommitDiffs()
  }, [fetchCommitDiffs])

  useEffect(() => {
    if (!cwd || !sha || !enabled) {
      setDiffs([])
      setError(null)
      setIsLoading(false)
    }
  }, [cwd, sha, enabled])

  return { diffs, isLoading, error, refresh: fetchCommitDiffs }
}
