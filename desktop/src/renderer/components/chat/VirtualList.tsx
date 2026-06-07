import React, { useRef, useState, useEffect, useCallback } from 'react'
import { calculateVisibleRange, getItemOffset, globalHeightCache, type VirtualItem as VirtualItemType } from '../../utils/virtualScroll'

type Props = {
  items: VirtualItemType[]
  sessionId: string
  children: (virtualItems: { item: VirtualItemType; offset: number }[]) => React.ReactNode
  className?: string
  style?: React.CSSProperties
  overscan?: number
  defaultHeight?: number
}

export function VirtualList({
  items,
  sessionId,
  children,
  className,
  style,
  overscan = 5,
  defaultHeight = 100,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const heightsRef = useRef<Map<string, number>>(new Map())

  // Initialize heights from cache
  useEffect(() => {
    const cached = globalHeightCache.get(sessionId)
    if (cached) {
      heightsRef.current = new Map(cached)
    }
  }, [sessionId])

  // Measure viewport height
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height)
      }
    })

    observer.observe(container)
    setViewportHeight(container.clientHeight)

    return () => observer.disconnect()
  }, [])

  // Handle scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (container) {
      setScrollTop(container.scrollTop)
    }
  }, [])

  // Update item heights with ResizeObserver
  const measureItem = useCallback((itemId: string, element: HTMLElement | null) => {
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height
        if (height > 0) {
          heightsRef.current.set(itemId, height)
          globalHeightCache.updateItem(sessionId, itemId, height)
        }
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [sessionId])

  // Build virtual items with measured heights
  const virtualItems: VirtualItemType[] = items.map((item) => ({
    ...item,
    height: heightsRef.current.get(item.id) || item.height || defaultHeight,
  }))

  // Calculate visible range
  const { startIndex, endIndex, totalHeight } = calculateVisibleRange(
    virtualItems,
    scrollTop,
    viewportHeight,
    { overscan, defaultHeight }
  )

  // Get visible items
  const visibleItems = virtualItems
    .slice(startIndex, endIndex + 1)
    .map((item, index) => ({
      item,
      offset: getItemOffset(virtualItems, startIndex + index, defaultHeight),
    }))

  // Save heights to cache on unmount
  useEffect(() => {
    return () => {
      globalHeightCache.set(sessionId, heightsRef.current)
    }
  }, [sessionId])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {children(visibleItems)}
      </div>
    </div>
  )
}

/**
 * Wrapper component for measuring individual items.
 */
export const VirtualItemBlock = React.memo(function VirtualItemBlock({
  itemId,
  children,
  style,
}: {
  itemId: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Height is measured by the observer
        void entry.contentRect.height
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={elementRef} style={style}>
      {children}
    </div>
  )
})
