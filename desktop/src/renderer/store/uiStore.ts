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
}

export type UiStore = UiState & UiActions

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
  setTheme: (v) => set({ theme: v })
}))
