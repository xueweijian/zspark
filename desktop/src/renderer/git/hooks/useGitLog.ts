// desktop/src/renderer/git/hooks/useGitLog.ts

import { useState, useEffect, useRef, useCallback } from 'react'
import { gitBridge } from '../gitBridge'
import type { GitLogEntry } from '../types'

interface GitLogResult {
  entries: GitLogEntry[]
  total: number
  ahead: number
  behind: number
  aheadEntries: GitLogEntry[]
  behindEntries: GitLogEntry[]
  upstream: string | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useGitLog(cwd: string | null, enabled: boolean): GitLogResult {
  const [entries, setEntries] = useState<GitLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [ahead, setAhead] = useState(0)
  const [behind, setBehind] = useState(0)
  const [aheadEntries, setAheadEntries] = useState<GitLogEntry[]>([])
  const [behindEntries, setBehindEntries] = useState<GitLogEntry[]>([])
  const [upstream, setUpstream] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLog = useCallback(async () => {
    if (!cwd || !enabled) return
    const rid = ++requestIdRef.current
    setIsLoading(true)
    try {
      const result = await gitBridge.log(cwd)
      if (rid !== requestIdRef.current) return
      setEntries(result.entries)
      setTotal(result.total)
      setAhead(result.ahead)
      setBehind(result.behind)
      setAheadEntries(result.aheadEntries)
      setBehindEntries(result.behindEntries)
      setUpstream(result.upstream)
      setError(null)
    } catch (err) {
      if (rid !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (rid === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [cwd, enabled])

  // Polling effect: 10s interval when cwd is set and enabled
  useEffect(() => {
    if (!cwd || !enabled) {
      setEntries([])
      setTotal(0)
      setAhead(0)
      setBehind(0)
      setAheadEntries([])
      setBehindEntries([])
      setUpstream(null)
      setError(null)
      setIsLoading(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    void fetchLog()

    timerRef.current = setInterval(() => {
      void fetchLog()
    }, 10000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [cwd, enabled, fetchLog])

  return { entries, total, ahead, behind, aheadEntries, behindEntries, upstream, isLoading, error, refresh: fetchLog }
}
