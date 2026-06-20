// desktop/src/renderer/git/hooks/useGitBranches.ts

import { useState, useEffect, useRef, useCallback } from 'react'
import { gitBridge } from '../gitBridge'
import type { BranchInfo } from '../types'

interface GitBranchesResult {
  branches: BranchInfo[]
  error: string | null
  refresh: () => void
  checkoutBranch: (name: string) => Promise<void>
  createBranch: (name: string) => Promise<void>
}

export function useGitBranches(cwd: string | null): GitBranchesResult {
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const fetchedRef = useRef(false)

  const fetchBranches = useCallback(async () => {
    if (!cwd) return
    const rid = ++requestIdRef.current
    try {
      const result = await gitBridge.listBranches(cwd)
      if (rid !== requestIdRef.current) return
      setBranches(result)
      setError(null)
    } catch (err) {
      if (rid !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [cwd])

  // On-demand loading: fetch once when cwd becomes non-null
  useEffect(() => {
    if (!cwd) {
      setBranches([])
      setError(null)
      fetchedRef.current = false
      return
    }
    if (!fetchedRef.current) {
      fetchedRef.current = true
      void fetchBranches()
    }
  }, [cwd, fetchBranches])

  const checkoutBranch = useCallback(
    async (name: string) => {
      if (!cwd) return
      try {
        await gitBridge.checkoutBranch(cwd, name)
        await fetchBranches()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [cwd, fetchBranches],
  )

  const createBranch = useCallback(
    async (name: string) => {
      if (!cwd) return
      try {
        await gitBridge.createBranch(cwd, name)
        await fetchBranches()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [cwd, fetchBranches],
  )

  return { branches, error, refresh: fetchBranches, checkoutBranch, createBranch }
}
