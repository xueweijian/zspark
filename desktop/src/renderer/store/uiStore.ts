import { create } from 'zustand'
import type { Toast, Panel } from '../appTypes'
import { readStoredTheme, type ThemePreference } from '../features/theme/useThemePreference'

interface UiState {
  panel: Panel
  showSettings: boolean
  toasts: Toast[]
  showPermissionMenu: boolean
  showJumpToLatest: boolean
  rightActiveTab: 'files' | 'browser' | 'git'
  // 折叠态:由布局壳驱动,折叠时 CSS 变量被覆盖为 0(实际宽度由 useResizablePanels 管)。
  sidebarCollapsed: boolean
  rightCollapsed: boolean
  // 保留 rightWidth 供旧调用方引用;实际拖拽宽度由 useResizablePanels 管理(独立 localStorage)。
  rightWidth: number
  // 主题:dark(默认)/ light / system
  theme: ThemePreference
  // 中栏 chat/diff 分层(对齐 CM):
  // centerMode:单看模式下哪层可见(chat=只看聊天,diff=只看 diff)
  // splitChatDiffView:是否分屏(聊天左、diff 右),持久化 localStorage
  // chatDiffSplitPercent:分屏分割位置百分比(20-80),持久化
  // diffHintDismissed:Agent 改动提示按钮是否被用户忽略(避免一直显示)
  centerMode: 'chat' | 'diff'
  splitChatDiffView: boolean
  chatDiffSplitPercent: number
  diffHintDismissed: boolean
}

interface UiActions {
  setPanel: React.Dispatch<React.SetStateAction<Panel>>
  setShowSettings: (v: boolean) => void
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>
  setShowPermissionMenu: (v: boolean) => void
  setShowJumpToLatest: (v: boolean) => void
  setRightActiveTab: (v: 'files' | 'browser' | 'git') => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebarCollapsed: () => void
  setRightCollapsed: (v: boolean) => void
  toggleRightCollapsed: () => void
  setRightWidth: (v: number) => void
  setTheme: (v: ThemePreference) => void
  setCenterMode: (v: 'chat' | 'diff') => void
  toggleCenterMode: () => void
  setSplitChatDiffView: (v: boolean) => void
  toggleSplitChatDiffView: () => void
  setChatDiffSplitPercent: (v: number) => void
  setDiffHintDismissed: (v: boolean) => void
}

export type UiStore = UiState & UiActions

// localStorage 读取辅助(布尔/数值,带容错与 clamp)。
function readStoredBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  return raw === 'true'
}

function readStoredNum(key: string, fallback: number, min: number, max: number): number {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export const useUiStore = create<UiStore>((set, get) => ({
  panel: null,
  showSettings: false,
  toasts: [],
  showPermissionMenu: false,
  showJumpToLatest: false,
  rightActiveTab: 'files',
  sidebarCollapsed: false,
  rightCollapsed: false,
  rightWidth: 300,
  theme: readStoredTheme(),
  centerMode: 'chat',
  splitChatDiffView: readStoredBool('zspark.splitChatDiffView', false),
  chatDiffSplitPercent: readStoredNum('zspark.chatDiffSplitPercent', 50, 20, 80),
  diffHintDismissed: false,

  setPanel: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ panel: (action as (prev: Panel) => Panel)(state.panel) }))
    } else {
      set({ panel: action })
    }
  },
  setShowSettings: (v) => set({ showSettings: v }),
  setToasts: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ toasts: (action as (prev: Toast[]) => Toast[])(state.toasts) }))
    } else {
      set({ toasts: action })
    }
  },
  setShowPermissionMenu: (v) => set({ showPermissionMenu: v }),
  setShowJumpToLatest: (v) => set({ showJumpToLatest: v }),
  setRightActiveTab: (v) => set({ rightActiveTab: v }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  setRightCollapsed: (v) => set({ rightCollapsed: v }),
  toggleRightCollapsed: () => set({ rightCollapsed: !get().rightCollapsed }),
  setRightWidth: (v) => set({ rightWidth: v }),
  setTheme: (v) => set({ theme: v }),
  setCenterMode: (v) => set({ centerMode: v, diffHintDismissed: v === 'diff' ? true : get().diffHintDismissed }),
  toggleCenterMode: () => set((s) => ({ centerMode: s.centerMode === 'chat' ? 'diff' : 'chat' })),
  setSplitChatDiffView: (v) => { localStorage.setItem('zspark.splitChatDiffView', String(v)); set({ splitChatDiffView: v }) },
  toggleSplitChatDiffView: () => { const next = !get().splitChatDiffView; localStorage.setItem('zspark.splitChatDiffView', String(next)); set({ splitChatDiffView: next }) },
  setChatDiffSplitPercent: (v) => { localStorage.setItem('zspark.chatDiffSplitPercent', String(v)); set({ chatDiffSplitPercent: v }) },
  setDiffHintDismissed: (v) => set({ diffHintDismissed: v }),
}))
