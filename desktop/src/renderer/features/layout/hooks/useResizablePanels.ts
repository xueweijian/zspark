import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

// 移植自 CodexMonitor 的 useResizablePanels(CodexMonitor/src/features/layout/hooks/useResizablePanels.ts)。
// 核心思想:拖拽期间只改 DOM 的 CSS 变量(零重渲染),mouseup 时才把最终值灌回 state 持久化。
// 适配点:只保留 zspark 当前需要的 sidebar / right-panel 两个;localStorage key 用 zspark. 前缀。

// 尺寸边界。右栏上限放宽到 800(zspark 含内置浏览器,需要更宽)。
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 420
const DEFAULT_SIDEBAR_WIDTH = 260

const MIN_RIGHT_PANEL_WIDTH = 270
const MAX_RIGHT_PANEL_WIDTH = 800
const DEFAULT_RIGHT_PANEL_WIDTH = 320 // 修正 CM 里 default(230)<min(270) 的怪异点

const LS_KEY_SIDEBAR_WIDTH = 'zspark.sidebarWidth'
const LS_KEY_RIGHT_PANEL_WIDTH = 'zspark.rightPanelWidth'

type ResizeType = 'sidebar' | 'right-panel'

interface ResizeState {
  type: ResizeType
  startX: number
  startWidth: number
}

// CSS 变量名与单位映射:拖拽时通过 el.style.setProperty 直接写这些变量。
const CSS_VAR_MAP: Record<ResizeType, { prop: string; unit: string }> = {
  sidebar: { prop: '--sidebar-width', unit: 'px' },
  'right-panel': { prop: '--right-panel-width', unit: 'px' },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// 从 localStorage 读宽度,并 clamp 到合法区间(防止历史脏数据)。
function readStoredWidth(key: string, fallback: number, min: number, max: number): number {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return clamp(parsed, min, max)
}

export interface UseResizablePanels {
  /** 必须绑到布局根 .app div,拖拽时直接写它的 CSS 变量。 */
  appRef: React.RefObject<HTMLDivElement>
  /** 拖拽中为 true,用于给 .app 加 is-resizing class 关闭过渡动画。 */
  isResizing: boolean
  sidebarWidth: number
  rightPanelWidth: number
  onSidebarResizeStart: (event: ReactMouseEvent) => void
  onRightPanelResizeStart: (event: ReactMouseEvent) => void
}

/**
 * 管理左栏/右栏宽度,零重渲染拖拽 + localStorage 持久化。
 * 折叠态由调用方处理(把宽度变量覆盖为 0),本 hook 只负责连续拖拽。
 */
export function useResizablePanels(): UseResizablePanels {
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredWidth(LS_KEY_SIDEBAR_WIDTH, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH),
  )
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    readStoredWidth(LS_KEY_RIGHT_PANEL_WIDTH, DEFAULT_RIGHT_PANEL_WIDTH, MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH),
  )

  const [isResizing, setIsResizing] = useState(false)

  // 拖拽会话状态:挂在 window 上的 mousemove/mouseup 闭包通过 ref 读取。
  const resizeRef = useRef<ResizeState | null>(null)
  // 拖拽中的实时值:mouseup 时灌回 state。
  const liveValueRef = useRef<number | null>(null)
  const appRef = useRef<HTMLDivElement>(null)

  // 持久化:松手(setState)后才写 localStorage。
  useEffect(() => {
    localStorage.setItem(LS_KEY_SIDEBAR_WIDTH, String(sidebarWidth))
  }, [sidebarWidth])
  useEffect(() => {
    localStorage.setItem(LS_KEY_RIGHT_PANEL_WIDTH, String(rightPanelWidth))
  }, [rightPanelWidth])

  // 全局 mousemove/mouseup:只注册一次。
  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const resize = resizeRef.current
      const el = appRef.current
      if (!resize || !el) return
      event.preventDefault()

      let next: number
      if (resize.type === 'sidebar') {
        // 左栏贴左:向右拖增大。
        next = clamp(
          resize.startWidth + (event.clientX - resize.startX),
          MIN_SIDEBAR_WIDTH,
          MAX_SIDEBAR_WIDTH,
        )
      } else {
        // 右栏贴右:向右拖减小。
        next = clamp(
          resize.startWidth - (event.clientX - resize.startX),
          MIN_RIGHT_PANEL_WIDTH,
          MAX_RIGHT_PANEL_WIDTH,
        )
      }

      liveValueRef.current = next
      const { prop, unit } = CSS_VAR_MAP[resize.type]
      // 零重渲染:直接写 DOM 的 CSS 变量,CSS grid 立即响应。
      el.style.setProperty(prop, `${next}${unit}`)
    }

    function handleMouseUp() {
      const resize = resizeRef.current
      if (resize) {
        const finalValue = liveValueRef.current
        if (finalValue !== null) {
          // 松手时才把最终值灌回 state(触发一次重渲染 + 持久化)。
          if (resize.type === 'sidebar') setSidebarWidth(finalValue)
          else setRightPanelWidth(finalValue)
        }
        resizeRef.current = null
        liveValueRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setIsResizing(false)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const onSidebarResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      resizeRef.current = {
        type: 'sidebar',
        startX: event.clientX,
        startWidth: sidebarWidth,
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      setIsResizing(true)
    },
    [sidebarWidth],
  )

  const onRightPanelResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      resizeRef.current = {
        type: 'right-panel',
        startX: event.clientX,
        startWidth: rightPanelWidth,
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      setIsResizing(true)
    },
    [rightPanelWidth],
  )

  return {
    appRef,
    isResizing,
    sidebarWidth,
    rightPanelWidth,
    onSidebarResizeStart,
    onRightPanelResizeStart,
  }
}
