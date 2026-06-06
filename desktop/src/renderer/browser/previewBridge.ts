// desktop/src/renderer/browser/previewBridge.ts

import type { WebviewBounds } from './computeWebviewBounds'

export const previewBridge = {
  open: (url: string, bounds: WebviewBounds) => {
    return (window as any).zspark?.previewOpen?.(url, bounds) ?? Promise.resolve()
  },
  navigate: (url: string) => {
    return (window as any).zspark?.previewNavigate?.(url) ?? Promise.resolve()
  },
  setBounds: (bounds: WebviewBounds) => {
    return (window as any).zspark?.previewSetBounds?.(bounds) ?? Promise.resolve()
  },
  setVisible: (visible: boolean) => {
    return (window as any).zspark?.previewSetVisible?.(visible) ?? Promise.resolve()
  },
  close: () => {
    return (window as any).zspark?.previewClose?.() ?? Promise.resolve()
  },
  message: (payload: any) => {
    return (window as any).zspark?.previewMessage?.(payload) ?? Promise.resolve()
  }
}
