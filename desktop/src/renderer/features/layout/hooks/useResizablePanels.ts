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

// 右栏下段 Plan 面板高度(竖向拖拽)。
const MIN_PLAN_PANEL_HEIGHT = 120
const MAX_PLAN_PANEL_HEIGHT = 480
const DEFAULT_PLAN_PANEL_HEIGHT = 220

// 中栏 chat/diff 分屏分割位置百分比(横向拖拽,20%-80%)。
const MIN_CHAT_DIFF_SPLIT_PERCENT = 20
const MAX_CHAT_DIFF_SPLIT_PERCENT = 80

const LS_KEY_SIDEBAR_WIDTH = 'zspark.sidebarWidth'
const LS_KEY_RIGHT_PANEL_WIDTH = 'zspark.rightPanelWidth'
const LS_KEY_PLAN_PANEL_HEIGHT = 'zspark.planPanelHeight'

type ResizeType = 'sidebar' | 'right-panel' | 'plan-panel' | 'chat-diff-split'

interface ResizeState {
  type: ResizeType
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  // chat-diff-split 专用:拖拽起始时中栏(.chat)容器宽度,用于把像素位移换算成百分比。
  startContainerWidth?: number
  // chat-diff-split 专用:拖拽起始时的分割百分比。
  startPercent?: number
}

// CSS 变量名与单位映射:拖拽时通过 el.style.setProperty 直接写这些变量。
const CSS_VAR_MAP: Record<ResizeType, { prop: string; unit: string }> = {
  sidebar: { prop: '--sidebar-width', unit: 'px' },
  'right-panel': { prop: '--right-panel-width', unit: 'px' },
  'plan-panel': { prop: '--plan-panel-height', unit: 'px' },
  'chat-diff-split': { prop: '--chat-diff-split-position-percent', unit: '%' },
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
  planPanelHeight: number
  onSidebarResizeStart: (event: ReactMouseEvent) => void
  onRightPanelResizeStart: (event: ReactMouseEvent) => void
  onPlanPanelResizeStart: (event: ReactMouseEvent) => void
  onChatDiffSplitResizeStart: (event: ReactMouseEvent) => void
}

/**
 * 管理左栏/右栏宽度 + Plan 面板高度 + chat/diff 分屏位置,零重渲染拖拽 + localStorage 持久化。
 * 折叠态由调用方处理(把宽度变量覆盖为 0),本 hook 只负责连续拖拽。
 *
 * chat-diff-split 的分割百分比的「真值」由 uiStore.chatDiffSplitPercent 管理(供 JSX 渲染层读取),
 * 本 hook 在拖拽期间只实时写 CSS 变量(--chat-diff-split-position-percent),松手时通过
 * onChatDiffSplitCommit 回调把最终值交还 uiStore 持久化。
 */
export function useResizablePanels(options?: {
  chatDiffSplitPercent: number
  onChatDiffSplitCommit?: (percent: number) => void
}): UseResizablePanels {
  const chatDiffSplitPercent = options?.chatDiffSplitPercent ?? 50
  const onChatDiffSplitCommit = options?.onChatDiffSplitCommit

  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredWidth(LS_KEY_SIDEBAR_WIDTH, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH),
  )
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    readStoredWidth(LS_KEY_RIGHT_PANEL_WIDTH, DEFAULT_RIGHT_PANEL_WIDTH, MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH),
  )
  const [planPanelHeight, setPlanPanelHeight] = useState(() =>
    readStoredWidth(LS_KEY_PLAN_PANEL_HEIGHT, DEFAULT_PLAN_PANEL_HEIGHT, MIN_PLAN_PANEL_HEIGHT, MAX_PLAN_PANEL_HEIGHT),
  )

  const [isResizing, setIsResizing] = useState(false)

  // 拖拽会话状态:挂在 window 上的 mousemove/mouseup 闭包通过 ref 读取。
  const resizeRef = useRef<ResizeState | null>(null)
  // 拖拽中的实时值:mouseup 时灌回 state。
  const liveValueRef = useRef<number | null>(null)
  const appRef = useRef<HTMLDivElement>(null)
  // chat-diff-split 的 commit 回调用 ref 持有,避免全局 effect 因回调变化重新注册。
  const chatDiffSplitCommitRef = useRef(onChatDiffSplitCommit)
  useEffect(() => {
    chatDiffSplitCommitRef.current = onChatDiffSplitCommit
  })

  // 持久化:松手(setState)后才写 localStorage。
  useEffect(() => {
    localStorage.setItem(LS_KEY_SIDEBAR_WIDTH, String(sidebarWidth))
  }, [sidebarWidth])
  useEffect(() => {
    localStorage.setItem(LS_KEY_RIGHT_PANEL_WIDTH, String(rightPanelWidth))
  }, [rightPanelWidth])
  useEffect(() => {
    localStorage.setItem(LS_KEY_PLAN_PANEL_HEIGHT, String(planPanelHeight))
  }, [planPanelHeight])

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
      } else if (resize.type === 'right-panel') {
        // 右栏贴右:向右拖减小。
        next = clamp(
          resize.startWidth - (event.clientX - resize.startX),
          MIN_RIGHT_PANEL_WIDTH,
          MAX_RIGHT_PANEL_WIDTH,
        )
      } else if (resize.type === 'plan-panel') {
        // plan-panel 贴底:向上拖增大。
        next = clamp(
          resize.startHeight - (event.clientY - resize.startY),
          MIN_PLAN_PANEL_HEIGHT,
          MAX_PLAN_PANEL_HEIGHT,
        )
      } else {
        // chat-diff-split:横向拖拽,把像素位移换算成百分比(相对于容器宽度),向右拖增大 diff 区。
        const containerWidth = resize.startContainerWidth ?? 0
        const deltaPercent = containerWidth > 0
          ? ((event.clientX - resize.startX) / containerWidth) * 100
          : 0
        next = clamp(
          (resize.startPercent ?? 50) + deltaPercent,
          MIN_CHAT_DIFF_SPLIT_PERCENT,
          MAX_CHAT_DIFF_SPLIT_PERCENT,
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
          else if (resize.type === 'right-panel') setRightPanelWidth(finalValue)
          else if (resize.type === 'plan-panel') setPlanPanelHeight(finalValue)
          else if (resize.type === 'chat-diff-split') chatDiffSplitCommitRef.current?.(finalValue)
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
        startY: event.clientY,
        startWidth: sidebarWidth,
        startHeight: 0,
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
        startY: event.clientY,
        startWidth: rightPanelWidth,
        startHeight: 0,
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      setIsResizing(true)
    },
    [rightPanelWidth],
  )

  const onPlanPanelResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      resizeRef.current = {
        type: 'plan-panel',
        startX: event.clientX,
        startY: event.clientY,
        startWidth: 0,
        startHeight: planPanelHeight,
      }
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
      setIsResizing(true)
    },
    [planPanelHeight],
  )

  const onChatDiffSplitResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      // 中栏(.chat)宽度:百分比位移相对它换算。拖拽柄的最近 .chat 祖先即为基准容器。
      const root = appRef.current
      const chatEl = root?.querySelector('.chat') as HTMLElement | null
      const containerWidth = chatEl?.getBoundingClientRect().width ?? 0
      resizeRef.current = {
        type: 'chat-diff-split',
        startX: event.clientX,
        startY: event.clientY,
        startWidth: 0,
        startHeight: 0,
        startContainerWidth: containerWidth,
        startPercent: chatDiffSplitPercent,
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      setIsResizing(true)
    },
    [chatDiffSplitPercent],
  )

  return {
    appRef,
    isResizing,
    sidebarWidth,
    rightPanelWidth,
    planPanelHeight,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    onPlanPanelResizeStart,
    onChatDiffSplitResizeStart,
  }
}
