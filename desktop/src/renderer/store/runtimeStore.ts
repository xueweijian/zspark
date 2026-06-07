import { create } from 'zustand'
import type { RuntimeInfo, ThreadSummary, WorkspaceFile } from '../appTypes'

interface RuntimeState {
  thread: string | null
  ready: boolean
  runtime: RuntimeInfo
  tokenUsage: any
  permissionLevel: 'default' | 'auto' | 'full'
  threads: ThreadSummary[]
  workspaceFiles: WorkspaceFile[]
}

interface RuntimeActions {
  setThread: (v: string | null) => void
  setReady: (v: boolean) => void
  setRuntime: React.Dispatch<React.SetStateAction<RuntimeInfo>>
  setTokenUsage: (v: any) => void
  setPermissionLevel: (v: 'default' | 'auto' | 'full') => void
  setThreads: React.Dispatch<React.SetStateAction<ThreadSummary[]>>
  setWorkspaceFiles: React.Dispatch<React.SetStateAction<WorkspaceFile[]>>
  upsertWorkspaceFiles: (files: WorkspaceFile[]) => void
}

export type RuntimeStore = RuntimeState & RuntimeActions

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  thread: null,
  ready: false,
  runtime: {},
  tokenUsage: null,
  permissionLevel: 'default',
  threads: [],
  workspaceFiles: [],

  setThread: (v) => set({ thread: v }),
  setReady: (v) => set({ ready: v }),
  setRuntime: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ runtime: (action as (prev: RuntimeInfo) => RuntimeInfo)(state.runtime) }))
    } else {
      set({ runtime: action })
    }
  },
  setTokenUsage: (v) => set({ tokenUsage: v }),
  setPermissionLevel: (v) => set({ permissionLevel: v }),
  setThreads: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ threads: (action as (prev: ThreadSummary[]) => ThreadSummary[])(state.threads) }))
    } else {
      set({ threads: action })
    }
  },
  setWorkspaceFiles: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ workspaceFiles: (action as (prev: WorkspaceFile[]) => WorkspaceFile[])(state.workspaceFiles) }))
    } else {
      set({ workspaceFiles: action })
    }
  },
  upsertWorkspaceFiles: (files) => {
    set((state) => {
      const byPath = new Map(state.workspaceFiles.map((file) => [file.path, file]))
      for (const file of files) byPath.set(file.path, { ...byPath.get(file.path), ...file })
      return { workspaceFiles: [...byPath.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24) }
    })
  }
}))
