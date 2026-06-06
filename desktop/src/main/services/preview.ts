// desktop/src/main/services/preview.ts

import { WebContentsView, BrowserWindow, app } from 'electron'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export type PreviewBounds = {
  x: number
  y: number
  width: number
  height: number
}

export class ElectronPreviewService {
  private view: WebContentsView | null = null
  private parentWindow: BrowserWindow | null = null
  private preloadScriptPath: string
  private agentScriptPath: string

  constructor() {
    // 根据 electron-vite 的 out 目录结构解析 preload 路径
    // 运行态主进程文件在 out/main/index.js，所以相对 out 目录：
    // preload 在 out/preload/preview-preload.js，agent 在 out/preload/preview-agent.js
    const resourcesPath = app.isPackaged ? process.resourcesPath : join(__dirname, '..')
    this.preloadScriptPath = join(resourcesPath, 'preload', 'preview-preload.js')
    this.agentScriptPath = join(resourcesPath, 'preload', 'preview-agent.js')
  }

  public open(parent: BrowserWindow, url: string, bounds: PreviewBounds): void {
    this.parentWindow = parent

    const trimmed = url ? url.trim() : ''
    if (!trimmed) {
      console.warn('[preview-service] empty url, skipping initialization')
      return
    }

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('file://')) {
      console.warn('[preview-service] invalid url scheme, skipping:', trimmed)
      return
    }

    if (!this.view) {
      this.view = new WebContentsView({
        webPreferences: {
          preload: this.preloadScriptPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        }
      })

      parent.contentView.addChildView(this.view)

      // 网页加载完毕后自动注入 agent 脚本
      this.view.webContents.on('did-finish-load', () => {
        this.injectAgentScript()
      })
    }

    this.view.setBounds(bounds)
    this.view.webContents.loadURL(trimmed).catch((err) => {
      console.error('[preview-service] failed to load url:', err)
      this.parentWindow?.webContents.send('preview:event', {
        type: 'error',
        message: `无法加载网页: ${err.message}`
      })
    })
  }

  public setBounds(bounds: PreviewBounds): void {
    if (this.view) {
      this.view.setBounds(bounds)
    }
  }

  public setVisible(visible: boolean): void {
    if (!this.view || !this.parentWindow) return
    
    // 优先使用原生的 setVisible 方法控制显隐
    if (typeof (this.view as any).setVisible === 'function') {
      ;(this.view as any).setVisible(visible)
    } else {
      // 备用方案：当需要隐藏时，临时移出 contentView 容器；重现时再加回来
      if (visible) {
        this.parentWindow.contentView.addChildView(this.view)
      } else {
        this.parentWindow.contentView.removeChildView(this.view)
      }
    }
  }

  public close(): void {
    if (this.view && this.parentWindow) {
      this.parentWindow.contentView.removeChildView(this.view)
      try {
        if (!this.view.webContents.isDestroyed()) {
          this.view.webContents.close()
        }
      } catch (e) {
        console.error('[preview-service] failed to close webcontents:', e)
      }
      this.view = null
      this.parentWindow = null
    }
  }

  // 宿主向页面内下发控制指令
  public message(payload: any): void {
    if (!this.view) return
    const raw = JSON.stringify(payload)
    const script = `globalThis.__PREVIEW_BRIDGE__?.handleHostRaw(${JSON.stringify(raw)})`
    this.view.webContents.executeJavaScript(script).catch((err) => {
      console.error('[preview-service] failed to send message to view:', err)
    })
  }

  // 处理从内置浏览器页面回传的 selection 事件并触发原生视口截图缝合
  public async handlePageMessage(raw: string): Promise<void> {
    if (!this.view || !this.parentWindow) return

    try {
      const msg = JSON.parse(raw)
      if (msg.type === 'selection') {
        const payload = msg.payload

        // 1. 触发原生高精度截图 (超越 html2canvas 渲染)
        const image = await this.view.webContents.capturePage()
        const dataUrl = `data:image/png;base64,${image.toPNG().toString('base64')}`

        // 2. 将截图 dataUrl 融合到 selection payload 中并转发到渲染进程
        const completeSelection = {
          type: 'selection',
          payload: {
            ...payload,
            screenshot: {
              dataUrl,
              kind: 'region'
            }
          }
        }
        this.parentWindow.webContents.send('preview:event', completeSelection)

        // 3. 截图完成后，向内置页面下发通知移除 1 号标注标记并关闭 Picker
        this.message({ type: 'screenshot-done' })
      } else {
        // 其他类型的消息（如 ready, navigated）直接往渲染层透传
        this.parentWindow.webContents.send('preview:event', msg)
      }
    } catch (e) {
      console.error('[preview-service] failed to parse page message:', e)
    }
  }

  private injectAgentScript(): void {
    if (!this.view) return

    // 检查并自动适配未解包的 asar 路径，确保文件读取稳定性
    let scriptPath = this.agentScriptPath
    if (!existsSync(scriptPath)) {
      scriptPath = scriptPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
    }

    try {
      if (existsSync(scriptPath)) {
        const code = readFileSync(scriptPath, 'utf8')
        this.view.webContents.executeJavaScript(code).catch((err) => {
          console.error('[preview-service] executeJavaScript failed:', err)
        })
      } else {
        console.error('[preview-service] agent script file not found:', scriptPath)
      }
    } catch (err) {
      console.error('[preview-service] failed to inject agent script:', err)
    }
  }
}
