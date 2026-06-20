import { create } from 'zustand'
import type { RuntimeInfo, ThreadSummary, WorkspaceFile } from '../appTypes'

// model/list RPC 返回的模型候选。
export interface ModelOption {
  id?: string
  model?: string
  display_name?: string
  default_reasoning_effort?: string | null
  supported_reasoning_efforts?: string[] | null
}

// collaborationMode/list RPC 返回的预设(experimental)。
export interface CollaborationModePreset {
  id?: string
  name?: string
  mode?: string
  settings?: {
    model?: string | null
    reasoning_effort?: string | null
    developer_instructions?: string | null
  } | null
}

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

interface RuntimeState {
  thread: string | null
  ready: boolean
  runtime: RuntimeInfo
  tokenUsage: any
  permissionLevel: 'default' | 'auto' | 'full'
  threads: ThreadSummary[]
  workspaceFiles: WorkspaceFile[]
  // ComposerMetaBar 状态
  modelList: ModelOption[]
  collaborationModes: CollaborationModePreset[]
  selectedModel: string | null
  selectedEffort: ReasoningEffort | null
  planModeEnabled: boolean
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
  setModelList: (v: ModelOption[]) => void
  setCollaborationModes: (v: CollaborationModePreset[]) => void
  setSelectedModel: (v: string | null) => void
  setSelectedEffort: (v: ReasoningEffort | null) => void
  setPlanModeEnabled: (v: boolean) => void
  // 会话状态点(thread-status/changed 维护)+ 未读标记
  markThreadStatus: (threadId: string, status: import('../appTypes').ThreadStatus) => void
  markThreadUnread: (threadId: string, unread: boolean) => void
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
  modelList: [],
  collaborationModes: [],
  selectedModel: null,
  selectedEffort: null,
  planModeEnabled: false,

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
  },
  setModelList: (v) => set({ modelList: v }),
  setCollaborationModes: (v) => set({ collaborationModes: v }),
  setSelectedModel: (v) => set({ selectedModel: v }),
  setSelectedEffort: (v) => set({ selectedEffort: v }),
  setPlanModeEnabled: (v) => set({ planModeEnabled: v }),
  // 按 threadId 更新会话运行态(来自 codex thread/status/changed)。
  // 该 thread 不在列表里则忽略(避免为未知 thread 建空项)。
  markThreadStatus: (threadId, status) => {
    set((state) => {
      const exists = state.threads.some((t) => t.id === threadId)
      if (!exists) return state
      return {
        threads: state.threads.map((t) => (t.id === threadId ? { ...t, status } : t)),
      }
    })
  },
  // 按 threadId 标记未读 / 已读。
  markThreadUnread: (threadId, unread) => {
    set((state) => {
      const exists = state.threads.some((t) => t.id === threadId)
      if (!exists) return state
      return {
        threads: state.threads.map((t) => (t.id === threadId ? { ...t, unread } : t)),
      }
    })
  }
}))
