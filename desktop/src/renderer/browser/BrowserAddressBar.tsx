// desktop/src/renderer/browser/BrowserAddressBar.tsx

import React, { useState, useEffect } from 'react'

interface BrowserAddressBarProps {
  url: string
  loading?: boolean
  pickerActive?: boolean
  onNavigate: (url: string) => void
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onTogglePicker: () => void
  onCapture: () => void
}

export function BrowserAddressBar({
  url,
  loading = false,
  pickerActive = false,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onTogglePicker,
  onCapture
}: BrowserAddressBarProps) {
  const [inputUrl, setInputUrl] = useState(url)

  useEffect(() => {
    setInputUrl(url)
  }, [url])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let target = inputUrl.trim()
    if (target) {
      if (!/^https?:\/\//i.test(target)) {
        target = `http://${target}`
      }
      onNavigate(target)
    }
  }

  return (
    <div className="browser-address-bar">
      <div className="nav-buttons">
        <button onClick={onBack} title="后退" className="nav-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <button onClick={onForward} title="前进" className="nav-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
        <button onClick={onReload} title="刷新" className="nav-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "spin" : ""}>
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="address-form">
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          className="address-input"
          placeholder="输入网址..."
        />
      </form>

      <div className="action-buttons">
        <button
          onClick={onCapture}
          title="截图"
          className="action-btn"
          aria-label="截图"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </button>
        <button
          onClick={onTogglePicker}
          title="选择元素"
          className={`action-btn ${pickerActive ? "active" : ""}`}
          aria-label="选择元素"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6"></path>
            <path d="M10 14 21 3"></path>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          </svg>
        </button>
      </div>
    </div>
  )
}
