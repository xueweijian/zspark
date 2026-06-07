import { create } from 'zustand'
import type { AttachmentMeta, SkillMeta } from '../appTypes'

interface ComposerState {
  input: string
  attachments: AttachmentMeta[]
  selectedSkills: SkillMeta[]
  suggestionType: 'none' | 'slash' | 'skill'
  suggestionQuery: string
  suggestionSelectedIndex: number
  loadedPreviews: Record<string, string>
  zoomedImage: AttachmentMeta | null
  dynamicSlashCommands: any[]
}

interface ComposerActions {
  setInput: React.Dispatch<React.SetStateAction<string>>
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentMeta[]>>
  setSelectedSkills: React.Dispatch<React.SetStateAction<SkillMeta[]>>
  setSuggestionType: (v: 'none' | 'slash' | 'skill') => void
  setSuggestionQuery: (v: string) => void
  setSuggestionSelectedIndex: React.Dispatch<React.SetStateAction<number>>
  setLoadedPreviews: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setZoomedImage: (v: AttachmentMeta | null) => void
  setDynamicSlashCommands: (v: any[]) => void
  clearComposer: () => void
}

export type ComposerStore = ComposerState & ComposerActions

export const useComposerStore = create<ComposerStore>((set) => ({
  input: '',
  attachments: [],
  selectedSkills: [],
  suggestionType: 'none',
  suggestionQuery: '',
  suggestionSelectedIndex: 0,
  loadedPreviews: {},
  zoomedImage: null,
  dynamicSlashCommands: [],

  setInput: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ input: (action as (prev: string) => string)(state.input) }))
    } else {
      set({ input: action })
    }
  },
  setAttachments: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ attachments: (action as (prev: AttachmentMeta[]) => AttachmentMeta[])(state.attachments) }))
    } else {
      set({ attachments: action })
    }
  },
  setSelectedSkills: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ selectedSkills: (action as (prev: SkillMeta[]) => SkillMeta[])(state.selectedSkills) }))
    } else {
      set({ selectedSkills: action })
    }
  },
  setSuggestionType: (v) => set({ suggestionType: v }),
  setSuggestionQuery: (v) => set({ suggestionQuery: v }),
  setSuggestionSelectedIndex: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ suggestionSelectedIndex: (action as (prev: number) => number)(state.suggestionSelectedIndex) }))
    } else {
      set({ suggestionSelectedIndex: action })
    }
  },
  setLoadedPreviews: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ loadedPreviews: (action as (prev: Record<string, string>) => Record<string, string>)(state.loadedPreviews) }))
    } else {
      set({ loadedPreviews: action })
    }
  },
  setZoomedImage: (v) => set({ zoomedImage: v }),
  setDynamicSlashCommands: (v) => set({ dynamicSlashCommands: v }),
  clearComposer: () => set({ input: '', attachments: [], selectedSkills: [], suggestionType: 'none', suggestionQuery: '', suggestionSelectedIndex: 0 })
}))
