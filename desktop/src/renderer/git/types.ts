// desktop/src/renderer/git/types.ts

// Git 文件状态
export type GitFileStatus = {
  path: string
  status: string  // 'M', 'A', 'D', 'R', '??' etc
  additions: number
  deletions: number
}

// Git 文件 diff
export type GitFileDiff = {
  path: string
  diff: string
  status: string
}

// Commit diff
export type GitCommitDiff = {
  path: string
  status: string
  diff: string
}

// Log entry
export type GitLogEntry = {
  sha: string
  summary: string
  author: string
  timestamp: number
}

// Log response
export type GitLogResponse = {
  total: number
  entries: GitLogEntry[]
  ahead: number
  behind: number
  aheadEntries: GitLogEntry[]
  behindEntries: GitLogEntry[]
  upstream: string | null
}

// Branch info
export type BranchInfo = {
  name: string
  lastCommit: number
}

// Panel mode
export type GitPanelMode = 'diff' | 'log'

// Diff source
export type GitDiffSource = 'local' | 'commit'
