import { create } from 'zustand'
import type { Toast, Panel } from '../appTypes'

interface UiState {
  panel: Panel
  showSettings: boolean
  toasts: Toast[]
  showPermissionMenu: boolean
  showJumpToLatest: boolean
  rightActiveTab: 'files' | 'browser'
  rightWidth: number
}

interface UiActions {
  setPanel: React.Dispatch<React.SetStateAction<Panel>>
  setShowSettings: (v: boolean) => void
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>
  setShowPermissionMenu: (v: boolean) => void
  setShowJumpToLatest: (v: boolean) => void
  setRightActiveTab: (v: 'files' | 'browser') => void
  setRightWidth: (v: number) => void
}

export type UiStore = UiState & UiActions

export const useUiStore = create<UiStore>((set) => ({
  panel: null,
  showSettings: false,
  toasts: [],
  showPermissionMenu: false,
  showJumpToLatest: false,
  rightActiveTab: 'files',
  rightWidth: 300,

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
  setRightWidth: (v) => set({ rightWidth: v })
}))
