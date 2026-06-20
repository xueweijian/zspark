// desktop/src/renderer/git/hooks/useGitDiffs.ts

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { gitBridge } from '../gitBridge'
import type { GitFileStatus, GitFileDiff } from '../types'

interface GitDiffsResult {
  diffs: GitFileDiff[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useGitDiffs(cwd: string | null, files: GitFileStatus[], enabled: boolean): GitDiffsResult {
  const [diffs, setDiffs] = useState<GitFileDiff[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestIdRef = useRef(0)

  // Compute a stable key from files to detect changes
  const fileKey = useMemo(
    () => files.map((f) => `${f.path}:${f.status}:${f.additions}:${f.deletions}`).join('|'),
    [files],
  )

  const fetchDiffs = useCallback(async () => {
    if (!cwd || !enabled || files.length === 0) {
      setDiffs([])
      return
    }
    const rid = ++requestIdRef.current
    setIsLoading(true)
    try {
      const result = await gitBridge.diffs(cwd)
      if (rid !== requestIdRef.current) return
      // Reorder diffs to match the order of input files
      const fileIndex = new Map(files.map((f, i) => [f.path, i]))
      const sorted = [...result].sort((a, b) => {
        const ia = fileIndex.get(a.path) ?? Infinity
        const ib = fileIndex.get(b.path) ?? Infinity
        return ia - ib
      })
      setDiffs(sorted)
      setError(null)
    } catch (err) {
      if (rid !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (rid === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [cwd, enabled, files, fileKey])

  // On-demand loading: trigger when fileKey or enabled changes
  useEffect(() => {
    void fetchDiffs()
  }, [fetchDiffs])

  // Clear when cwd is null or disabled
  useEffect(() => {
    if (!cwd || !enabled) {
      setDiffs([])
      setError(null)
      setIsLoading(false)
    }
  }, [cwd, enabled])

  return { diffs, isLoading, error, refresh: fetchDiffs }
}
