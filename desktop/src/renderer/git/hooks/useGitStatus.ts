// desktop/src/renderer/git/hooks/useGitStatus.ts

import { useState, useEffect, useRef, useCallback } from 'react'
import { gitBridge } from '../gitBridge'
import type { GitFileStatus } from '../types'

interface GitStatusResult {
  branchName: string
  files: GitFileStatus[]
  stagedFiles: GitFileStatus[]
  unstagedFiles: GitFileStatus[]
  totalAdditions: number
  totalDeletions: number
  error: string | null
  refresh: () => void
}

export function useGitStatus(cwd: string | null): GitStatusResult {
  const [branchName, setBranchName] = useState('')
  const [files, setFiles] = useState<GitFileStatus[]>([])
  const [stagedFiles, setStagedFiles] = useState<GitFileStatus[]>([])
  const [unstagedFiles, setUnstagedFiles] = useState<GitFileStatus[]>([])
  const [totalAdditions, setTotalAdditions] = useState(0)
  const [totalDeletions, setTotalDeletions] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!cwd) return
    const rid = ++requestIdRef.current
    try {
      const result = await gitBridge.status(cwd)
      if (rid !== requestIdRef.current) return
      setBranchName(result.branchName)
      setFiles(result.files)
      setStagedFiles(result.stagedFiles)
      setUnstagedFiles(result.unstagedFiles)
      setTotalAdditions(result.totalAdditions)
      setTotalDeletions(result.totalDeletions)
      setError(null)
    } catch (err) {
      if (rid !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [cwd])

  // Polling effect: 3s interval when cwd is set, clear when null
  useEffect(() => {
    if (!cwd) {
      setBranchName('')
      setFiles([])
      setStagedFiles([])
      setUnstagedFiles([])
      setTotalAdditions(0)
      setTotalDeletions(0)
      setError(null)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    // Immediate fetch
    void fetchStatus()

    // 3s polling
    timerRef.current = setInterval(() => {
      void fetchStatus()
    }, 3000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [cwd, fetchStatus])

  return { branchName, files, stagedFiles, unstagedFiles, totalAdditions, totalDeletions, error, refresh: fetchStatus }
}
