/**
 * Draft persistence: saves/restores chat input per thread to localStorage.
 */

const DRAFT_PREFIX = 'zspark:draft:v1:'

function draftKey(threadId: string): string {
  return `${DRAFT_PREFIX}${threadId}`
}

export interface DraftData {
  input: string
  savedAt: number
}

export function saveDraft(threadId: string, input: string): void {
  if (!threadId) return
  try {
    if (!input.trim()) {
      window.localStorage.removeItem(draftKey(threadId))
    } else {
      const data: DraftData = { input, savedAt: Date.now() }
      window.localStorage.setItem(draftKey(threadId), JSON.stringify(data))
    }
  } catch {
    // Best-effort
  }
}

export function loadDraft(threadId: string): string {
  if (!threadId) return ''
  try {
    const raw = window.localStorage.getItem(draftKey(threadId))
    if (!raw) return ''
    const data = JSON.parse(raw) as DraftData
    return typeof data?.input === 'string' ? data.input : ''
  } catch {
    return ''
  }
}

export function clearDraft(threadId: string): void {
  if (!threadId) return
  try {
    window.localStorage.removeItem(draftKey(threadId))
  } catch {
    // Best-effort
  }
}

/** Cleanup drafts older than maxAge (ms). Default: 7 days. */
export function cleanupOldDrafts(maxAge = 7 * 24 * 60 * 60 * 1000): void {
  try {
    const now = Date.now()
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(DRAFT_PREFIX)) {
        const raw = window.localStorage.getItem(key)
        if (raw) {
          const data = JSON.parse(raw) as DraftData
          if (data?.savedAt && now - data.savedAt > maxAge) {
            keysToRemove.push(key)
          }
        }
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Best-effort
  }
}
