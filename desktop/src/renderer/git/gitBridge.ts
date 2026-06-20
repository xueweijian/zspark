// desktop/src/renderer/git/gitBridge.ts

import type { GitFileDiff, GitCommitDiff, GitLogResponse, BranchInfo, GitFileStatus } from './types'

export const gitBridge = {
  status: (cwd: string): Promise<{
    branchName: string
    files: GitFileStatus[]
    stagedFiles: GitFileStatus[]
    unstagedFiles: GitFileStatus[]
    totalAdditions: number
    totalDeletions: number
  }> => (window as any).zspark?.gitStatus?.(cwd) ?? Promise.resolve({ branchName: '', files: [], stagedFiles: [], unstagedFiles: [], totalAdditions: 0, totalDeletions: 0 }),

  diffs: (cwd: string): Promise<GitFileDiff[]> =>
    (window as any).zspark?.gitDiffs?.(cwd) ?? Promise.resolve([]),

  log: (cwd: string, limit?: number): Promise<GitLogResponse> =>
    (window as any).zspark?.gitLog?.(cwd, limit) ?? Promise.resolve({ total: 0, entries: [], ahead: 0, behind: 0, aheadEntries: [], behindEntries: [], upstream: null }),

  commitDiff: (cwd: string, sha: string): Promise<GitCommitDiff[]> =>
    (window as any).zspark?.gitCommitDiff?.(cwd, sha) ?? Promise.resolve([]),

  stageFile: (cwd: string, path: string) => (window as any).zspark?.gitStageFile?.(cwd, path),
  stageAll: (cwd: string) => (window as any).zspark?.gitStageAll?.(cwd),
  unstageFile: (cwd: string, path: string) => (window as any).zspark?.gitUnstageFile?.(cwd, path),
  revertFile: (cwd: string, path: string) => (window as any).zspark?.gitRevertFile?.(cwd, path),
  revertAll: (cwd: string) => (window as any).zspark?.gitRevertAll?.(cwd),
  commit: (cwd: string, message: string) => (window as any).zspark?.gitCommit?.(cwd, message),
  push: (cwd: string) => (window as any).zspark?.gitPush?.(cwd),
  pull: (cwd: string) => (window as any).zspark?.gitPull?.(cwd),
  fetch: (cwd: string) => (window as any).zspark?.gitFetch?.(cwd),
  sync: (cwd: string) => (window as any).zspark?.gitSync?.(cwd),
  listBranches: (cwd: string): Promise<BranchInfo[]> =>
    (window as any).zspark?.gitListBranches?.(cwd) ?? Promise.resolve([]),
  checkoutBranch: (cwd: string, name: string) => (window as any).zspark?.gitCheckoutBranch?.(cwd, name),
  createBranch: (cwd: string, name: string) => (window as any).zspark?.gitCreateBranch?.(cwd, name),
  remote: (cwd: string): Promise<string | null> =>
    (window as any).zspark?.gitRemote?.(cwd) ?? Promise.resolve(null),
}
