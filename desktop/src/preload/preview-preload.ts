// desktop/src/preload/preview-preload.ts

import { contextBridge, ipcRenderer } from 'electron'

function isTopFrame(): boolean {
  try {
    return window.top === window
  } catch {
    return false
  }
}

function installPreviewPostBridge(): void {
  if (!contextBridge?.exposeInMainWorld || !ipcRenderer?.send) return
  contextBridge.exposeInMainWorld('__DESKTOP_PREVIEW_POST__', (raw: unknown) => {
    // 基础安全防范：限制在顶级 Frame 内，并且仅转发 string 消息
    if (typeof raw !== 'string') return
    if (!isTopFrame()) return
    ipcRenderer.send('preview-message-from-page', raw)
  })
}

installPreviewPostBridge()
export {}
