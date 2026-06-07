/**
 * Virtual scrolling utilities for efficient rendering of large lists.
 */

export interface VirtualItem {
  id: string
  height: number
}

export interface VirtualScrollConfig {
  /** Number of items to render outside visible area */
  overscan?: number
  /** Minimum height for items without measured height */
  defaultHeight?: number
}

const DEFAULT_CONFIG: Required<VirtualScrollConfig> = {
  overscan: 5,
  defaultHeight: 100,
}

/**
 * Calculate which items should be rendered based on scroll position.
 */
export function calculateVisibleRange(
  items: VirtualItem[],
  scrollTop: number,
  viewportHeight: number,
  config: VirtualScrollConfig = {}
): { startIndex: number; endIndex: number; totalHeight: number } {
  const { overscan, defaultHeight } = { ...DEFAULT_CONFIG, ...config }

  let totalHeight = 0
  let startIndex = -1
  let endIndex = -1

  for (let i = 0; i < items.length; i++) {
    const height = items[i].height || defaultHeight
    const itemTop = totalHeight
    const itemBottom = totalHeight + height

    if (startIndex === -1 && itemBottom >= scrollTop) {
      startIndex = Math.max(0, i - overscan)
    }

    if (startIndex !== -1 && endIndex === -1 && itemTop > scrollTop + viewportHeight) {
      endIndex = Math.min(items.length - 1, i + overscan)
    }

    totalHeight += height
  }

  // If we haven't found endIndex, it means all remaining items are visible
  if (endIndex === -1) {
    endIndex = items.length - 1
  }

  // If startIndex is still -1, list is empty or all items are above viewport
  if (startIndex === -1) {
    startIndex = 0
  }

  return { startIndex, endIndex, totalHeight }
}

/**
 * Get the offset for a specific item in the list.
 */
export function getItemOffset(
  items: VirtualItem[],
  index: number,
  defaultHeight: number = DEFAULT_CONFIG.defaultHeight
): number {
  let offset = 0
  for (let i = 0; i < index; i++) {
    offset += items[i].height || defaultHeight
  }
  return offset
}

/**
 * LRU Cache for virtual scroll heights.
 * Stores up to maxEntries sessions.
 */
export class VirtualHeightCache {
  private cache = new Map<string, Map<string, number>>()
  private maxEntries: number

  constructor(maxEntries: number = 16) {
    this.maxEntries = maxEntries
  }

  get(sessionId: string): Map<string, number> | undefined {
    const entry = this.cache.get(sessionId)
    if (entry) {
      // Move to end (most recently used)
      this.cache.delete(sessionId)
      this.cache.set(sessionId, entry)
    }
    return entry
  }

  set(sessionId: string, heights: Map<string, number>): void {
    if (this.cache.has(sessionId)) {
      this.cache.delete(sessionId)
    }
    this.cache.set(sessionId, heights)
    // Evict oldest entries if over limit
    while (this.cache.size > this.maxEntries) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
  }

  updateItem(sessionId: string, itemId: string, height: number): void {
    let heights = this.cache.get(sessionId)
    if (!heights) {
      heights = new Map()
      this.set(sessionId, heights)
    }
    heights.set(itemId, height)
  }

  getItemHeight(sessionId: string, itemId: string): number | undefined {
    return this.get(sessionId)?.get(itemId)
  }
}

// Global instance
export const globalHeightCache = new VirtualHeightCache()
