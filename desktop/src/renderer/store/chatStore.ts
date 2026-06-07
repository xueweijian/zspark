import { create } from 'zustand'
import type {
  Block,
  Activity,
  ApprovalRequest,
  ApprovalStatus,
  TurnInputItem
} from '../appTypes'
import { upsertApprovalBlockByTurnOrder } from '../appHelpers'
import { orderBlocksForTurn } from '../activityHelpers'
import { commandFailureNotice, type CommandFailureSignal } from '../commandSafety'

type TurnBlock = Extract<Block, { type: 'turn' }>

interface ChatState {
  blocks: Block[]
  streaming: boolean
  submitting: boolean
  messageActionBusy: boolean
}

interface ChatActions {
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>
  setStreaming: (v: boolean) => void
  setSubmitting: (v: boolean) => void
  setMessageActionBusy: (v: boolean) => void
  clearBlocks: () => void

  // Block mutation helpers (moved from App.tsx)
  updateTurn: (turnId: string, fn: (t: TurnBlock) => TurnBlock) => void
  upsertTurnBlock: (turnId: string, blockId: string, startedAt: number, itemActivity: Map<string, string>) => void
  upsertUserBlock: (turnId: string, itemId: string, text: string, input?: TurnInputItem[]) => void
  updateActivity: (turnId: string, actId: string, patch: Partial<Activity>) => void
  ensureActivity: (turnId: string, itemId: string, init: Omit<Activity, 'id' | 'status' | 'startedAt'>, itemActivity: Map<string, string>) => string
  appendActivityDetail: (turnId: string, itemId: string, delta: string, itemActivity: Map<string, string>) => void
  appendAgentText: (turnId: string, blockId: string, delta: string, commandFailuresByTurn: Map<string, CommandFailureSignal>) => void
  recordCommandFailure: (turnId: string, failure: CommandFailureSignal) => void
  setApprovalStatus: (key: string, status: ApprovalStatus, approvalRequests: Map<string, ApprovalRequest>) => void
  upsertApprovalBlock: (request: ApprovalRequest, itemActivity: Map<string, string>, autoApprovedTurns: Set<string>) => void
  resetLiveTurnState: () => void
}

export type ChatStore = ChatState & ChatActions

export const useChatStore = create<ChatStore>((set, get) => ({
  blocks: [],
  streaming: false,
  submitting: false,
  messageActionBusy: false,

  setBlocks: (action) => {
    if (typeof action === 'function') {
      set((state) => ({ blocks: (action as (prev: Block[]) => Block[])(state.blocks) }))
    } else {
      set({ blocks: action })
    }
  },
  setStreaming: (v) => set({ streaming: v }),
  setSubmitting: (v) => set({ submitting: v }),
  setMessageActionBusy: (v) => set({ messageActionBusy: v }),
  clearBlocks: () => set({ blocks: [] }),

  updateTurn: (turnId, fn) => {
    set((state) => ({
      blocks: state.blocks.map((b) => (b.type === 'turn' && b.turnId === turnId ? fn(b) : b))
    }))
  },

  upsertTurnBlock: (turnId, blockId, startedAt, itemActivity) => {
    const thinkingId = `thinking-${turnId}`
    itemActivity.set(thinkingId, thinkingId)
    set((state) => {
      const activity: Activity = { id: thinkingId, kind: 'reasoning', title: 'Thinking', status: 'running', startedAt }
      let found = false
      const next = state.blocks.map((b) => {
        if (b.type !== 'turn' || b.turnId !== turnId) return b
        found = true
        const hasThinking = b.activities.some((a) => a.id === thinkingId)
        return {
          ...b,
          id: b.id || blockId,
          collapsed: false,
          endedAt: undefined,
          status: 'running' as const,
          activities: hasThinking ? b.activities : [activity, ...b.activities]
        }
      })
      if (found) return { blocks: orderBlocksForTurn(next, turnId) }
      return {
        blocks: orderBlocksForTurn([
          ...state.blocks,
          {
            type: 'turn' as const,
            id: blockId,
            turnId,
            collapsed: false,
            startedAt,
            status: 'running' as const,
            activities: [activity]
          }
        ], turnId)
      }
    })
  },

  upsertUserBlock: (turnId, itemId, text, input) => {
    if (!text) return
    const id = `user-${itemId}`
    set((state) => {
      let found = false
      const next = state.blocks.map((b) => {
        if (b.id !== id || b.type !== 'user') return b
        found = true
        return { ...b, text, turnId, input }
      })
      if (found) return { blocks: orderBlocksForTurn(next, turnId) }
      const block: Block = { type: 'user', id, text, turnId, input }
      const turnIndex = state.blocks.findIndex((b) => b.type === 'turn' && b.turnId === turnId)
      const withBlock = turnIndex === -1 ? [...state.blocks, block] : [...state.blocks.slice(0, turnIndex), block, ...state.blocks.slice(turnIndex)]
      return { blocks: orderBlocksForTurn(withBlock, turnId) }
    })
  },

  updateActivity: (turnId, actId, patch) => {
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<Activity>
    get().updateTurn(turnId, (t) => ({
      ...t,
      activities: t.activities.map((a) => (a.id === actId ? { ...a, ...cleanPatch } : a))
    }))
  },

  ensureActivity: (turnId, itemId, init, itemActivity) => {
    let actId = itemActivity.get(itemId)
    if (actId) return actId
    actId = itemId.startsWith('thinking-') ? itemId : `a-${itemId}`
    itemActivity.set(itemId, actId)
    get().updateTurn(turnId, (t) => {
      if (t.activities.some((a) => a.id === actId)) return t
      return { ...t, activities: [...t.activities, { id: actId!, status: 'running', startedAt: Date.now(), ...init }] }
    })
    return actId
  },

  appendActivityDetail: (turnId, itemId, delta, itemActivity) => {
    const actId = itemActivity.get(itemId)
    if (!actId) return
    get().updateTurn(turnId, (t) => ({
      ...t,
      activities: t.activities.map((a) => (a.id === actId ? { ...a, detail: (a.detail ?? '') + delta } : a))
    }))
  },

  appendAgentText: (turnId, blockId, delta, commandFailuresByTurn) => {
    const failure = commandFailuresByTurn.get(turnId)
    if (failure) {
      const notice = commandFailureNotice(failure)
      set((state) => {
        let found = false
        const next = state.blocks.map((b) => {
          if (b.type !== 'agent' || b.id !== blockId) return b
          found = true
          return { ...b, text: notice, turnId }
        })
        return { blocks: found ? next : [...state.blocks, { type: 'agent' as const, id: blockId, text: notice, turnId }] }
      })
      get().updateTurn(turnId, (t) => (t.finalMessageId ? t : { ...t, finalMessageId: blockId }))
      return
    }
    set((state) => {
      let found = false
      const next = state.blocks.map((b) => {
        if (b.type !== 'agent' || b.id !== blockId) return b
        found = true
        return { ...b, text: b.text + delta, turnId }
      })
      return { blocks: found ? next : [...state.blocks, { type: 'agent' as const, id: blockId, text: delta, turnId }] }
    })
    get().updateTurn(turnId, (t) => (t.finalMessageId ? t : { ...t, finalMessageId: blockId }))
  },

  recordCommandFailure: (turnId, failure) => {
    const notice = commandFailureNotice(failure)
    set((state) => ({
      blocks: state.blocks.map((b) => (
        b.type === 'agent' && b.turnId === turnId ? { ...b, text: notice } : b
      ))
    }))
  },

  setApprovalStatus: (key, status, approvalRequests) => {
    const current = approvalRequests.get(key)
    if (current) approvalRequests.set(key, { ...current, status })
    set((state) => ({
      blocks: state.blocks.map((b) => (
        b.type === 'approval' && b.request.key === key
          ? { ...b, request: { ...b.request, status } }
          : b
      ))
    }))
  },

  upsertApprovalBlock: (request, itemActivity, autoApprovedTurns) => {
    const { blocks } = get()
    set(() => ({
      blocks: upsertApprovalBlockByTurnOrder(blocks, {
        type: 'approval',
        id: request.blockId,
        turnId: request.turnId,
        request
      })
    }))
    void itemActivity
    void autoApprovedTurns
  },

  resetLiveTurnState: () => {
    // Placeholder - called when switching threads
  }
}))
