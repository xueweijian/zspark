// desktop/src/renderer/browser/BrowserSurface.tsx

import React, { useEffect, useRef, useState } from 'react'
import { BrowserAddressBar } from './BrowserAddressBar'
import { previewBridge } from './previewBridge'
import { computeWebviewBounds } from './computeWebviewBounds'

interface BrowserSurfaceProps {
  initialUrl?: string
  isOverlayActive?: boolean
  onSelection: (payload: any) => void
}

export function BrowserSurface({
  initialUrl = '',
  isOverlayActive = false,
  onSelection
}: BrowserSurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [currentUrl, setCurrentUrl] = useState(initialUrl)
  const [isOpened, setIsOpened] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pickerActive, setPickerActive] = useState(false)

  // 坐标尺寸重设方法：将占位 div 坐标同步到原生 WebContentsView 上
  const reportBounds = () => {
    const el = hostRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    previewBridge.setBounds(computeWebviewBounds(rect))
  }

  // 1. 生命周期管理：仅在 isOpened 为 true 时，创建与销毁原生 WebContentsView 视口并监听大小
  useEffect(() => {
    if (!isOpened) return

    const el = hostRef.current
    if (el) {
      previewBridge.open(currentUrl, computeWebviewBounds(el.getBoundingClientRect()))
    }

    const observer = new ResizeObserver(() => reportBounds())
    if (el) {
      observer.observe(el)
    }
    window.addEventListener('resize', reportBounds)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reportBounds)
      previewBridge.close()
    }
  }, [isOpened])

  // 2. 监听宿主遮罩 Modal 弹出状态，隐藏 Native 视口防层级遮挡
  useEffect(() => {
    if (isOpened) {
      previewBridge.setVisible(!isOverlayActive)
    }
  }, [isOverlayActive, isOpened])

  // 4. 监听来自主进程/网页 Agent 转发回来的 IPC 事件
  useEffect(() => {
    const cleanup = (window as any).zspark?.onPreviewEvent((msg: any) => {
      if (!msg) return
      
      switch (msg.type) {
        case 'navigated':
          if (msg.url) {
            setCurrentUrl(msg.url)
          }
          break
        case 'ready':
          setLoading(false)
          break
        case 'selection':
          setPickerActive(false)
          if (msg.payload) {
            onSelection(msg.payload)
          }
          break
        case 'picker-exited':
          setPickerActive(false)
          break
        case 'error':
          console.warn('[preview-agent-error]', msg.message)
          break
      }
    })
    return () => {
      if (cleanup) cleanup()
    }
  }, [onSelection])

  // 触发导航
  const handleNavigate = (url: string) => {
    const targetUrl = url.trim()
    if (!targetUrl) return
    setCurrentUrl(targetUrl)
    setLoading(true)
    if (!isOpened) {
      setIsOpened(true)
    } else {
      previewBridge.navigate(targetUrl)
    }
  }

  // 触发后退
  const handleBack = () => {
    if (!isOpened) return
    // 注入 JavaScript 模拟历史后退
    previewBridge.message({ type: 'exit-picker' })
    previewBridge.navigate('javascript:history.back()')
  }

  // 触发前进
  const handleForward = () => {
    if (!isOpened) return
    previewBridge.message({ type: 'exit-picker' })
    previewBridge.navigate('javascript:history.forward()')
  }

  // 触发刷新
  const handleReload = () => {
    if (!isOpened) return
    setLoading(true)
    previewBridge.navigate(currentUrl)
  }

  // 切换 Picker 激活态
  const handleTogglePicker = () => {
    if (!isOpened) return
    const nextActive = !pickerActive
    setPickerActive(nextActive)
    previewBridge.message({
      type: nextActive ? 'enter-picker' : 'exit-picker'
    })
  }

  // 触发常规截图
  const handleCapture = () => {
    if (!isOpened) return
    // 这里我们直接向主进程发送通知，在 handlePageMessage 里走截图逻辑
    // 或者直接下发给内置页面让网页 Agent 处理
    previewBridge.message({ type: 'exit-picker' })
    // 通过 IPC 通信，主进程触发 capturePage 原生捕获
    // 我们在此简单直接利用页面通知触发视口截图
    ;(window as any).zspark?.previewMessage?.({ type: 'capture', kind: 'viewport' })
  }

  return (
    <div className="browser-surface">
      <BrowserAddressBar
        url={currentUrl}
        loading={loading}
        pickerActive={pickerActive}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onTogglePicker={handleTogglePicker}
        onCapture={handleCapture}
      />
      <div ref={hostRef} className="browser-viewport-placeholder">
        {!isOpened && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#9ca3af',
            backgroundColor: '#f9fafb',
            padding: '2rem',
            textAlign: 'center',
            userSelect: 'none'
          }}>
            <svg style={{ width: '4rem', height: '4rem', marginBottom: '1rem', color: '#d1d5db' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>内置浏览器已就绪</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', maxWidth: '20rem', margin: 0 }}>
              请在上方地址栏中输入网址（例如 http://baidu.com）或输入关键词触发智能跳转。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
