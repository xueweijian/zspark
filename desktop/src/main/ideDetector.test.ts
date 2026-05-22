import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import util from 'util'

// 定义外部的可重置 mock 状态，以便在各个测试用例中动态修改
let currentPlatform = 'win32'
const mockAccess = vi.fn()
const mockExecAsync = vi.fn()
const mockExec = vi.fn()

// @ts-ignore
mockExec[util.promisify.custom] = mockExecAsync

// 在顶层 mock 所有可能涉及的系统/环境模块
vi.doMock('os', () => ({
  default: {
    platform: () => currentPlatform
  }
}))

vi.doMock('fs/promises', () => ({
  default: {
    access: mockAccess
  }
}))

vi.doMock('child_process', () => ({
  exec: mockExec
}))

describe('ideDetector', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules() // 每次测试重置缓存的模块，确保重新加载并执行顶层代码（比如 os.platform()）
    mockAccess.mockReset()
    mockExecAsync.mockReset()
    mockExec.mockReset()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Windows platform detection', () => {
    test('all IDEs detected via physical paths (pathExists)', async () => {
      currentPlatform = 'win32'
      process.env.LOCALAPPDATA = 'C:\\Users\\MockUser\\AppData\\Local'
      process.env.ProgramFiles = 'C:\\Program Files'

      // 所有路径都让它存在
      mockAccess.mockResolvedValue(undefined)

      const { detectInstalledIDEs } = await import('./ideDetector')
      const result = await detectInstalledIDEs(true)

      expect(result).toEqual([
        {
          id: 'vscode',
          name: 'VS Code',
          executable: 'C:\\Users\\MockUser\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
          icon: 'vscode'
        },
        {
          id: 'cursor',
          name: 'Cursor',
          executable: 'C:\\Users\\MockUser\\AppData\\Local\\Programs\\cursor\\Cursor.exe',
          icon: 'cursor'
        },
        {
          id: 'zed',
          name: 'Zed',
          executable: 'C:\\Users\\MockUser\\AppData\\Local\\Programs\\Zed\\zed.exe',
          icon: 'zed'
        },
        {
          id: 'visualstudio',
          name: 'Visual Studio',
          executable: 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\devenv.exe',
          icon: 'visualstudio'
        },
        {
          id: 'explorer',
          name: 'File Explorer',
          executable: 'explorer.exe',
          icon: 'folder'
        }
      ])
    })

    test('VS Code in ProgramFiles, VS in Enterprise edition, and no other local apps', async () => {
      currentPlatform = 'win32'
      process.env.LOCALAPPDATA = 'C:\\Users\\MockUser\\AppData\\Local'
      process.env.ProgramFiles = 'C:\\Program Files'

      const allowedPaths = new Set([
        'C:\\Program Files\\Microsoft VS Code\\Code.exe',
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\Common7\\IDE\\devenv.exe'
      ])

      mockAccess.mockImplementation((p: string) => {
        if (allowedPaths.has(p)) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      // 对 Cursor 和 Zed，由于 path 探测不到，它们会执行 where 查找。为了测试 coverage，我们让 Cursor where 成功，Zed where 失败
      mockExecAsync.mockImplementation((cmd: string) => {
        if (cmd === 'where cursor.cmd') {
          return Promise.resolve({ stdout: 'C:\\custom\\cursor.cmd\n' })
        }
        return Promise.reject(new Error('Command failed'))
      })

      const { detectInstalledIDEs } = await import('./ideDetector')
      const result = await detectInstalledIDEs(true)

      expect(result).toEqual([
        {
          id: 'vscode',
          name: 'VS Code',
          executable: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
          icon: 'vscode'
        },
        {
          id: 'cursor',
          name: 'Cursor',
          executable: 'C:\\custom\\cursor.cmd',
          icon: 'cursor'
        },
        {
          id: 'visualstudio',
          name: 'Visual Studio',
          executable: 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\Common7\\IDE\\devenv.exe',
          icon: 'visualstudio'
        },
        {
          id: 'explorer',
          name: 'File Explorer',
          executable: 'explorer.exe',
          icon: 'folder'
        }
      ])
    })

    test('detect via where command when physical paths do not exist', async () => {
      currentPlatform = 'win32'
      process.env.LOCALAPPDATA = 'C:\\Users\\MockUser\\AppData\\Local'
      process.env.ProgramFiles = 'C:\\Program Files'

      mockAccess.mockRejectedValue(new Error('File not found'))

      mockExecAsync.mockImplementation((cmd: string) => {
        if (cmd === 'where code.cmd') {
          return Promise.resolve({ stdout: 'C:\\custom\\path\\code.cmd\n' })
        }
        if (cmd === 'where cursor.cmd') {
          return Promise.resolve({ stdout: 'C:\\custom\\path\\cursor.cmd\n' })
        }
        if (cmd === 'where zed.exe') {
          return Promise.resolve({ stdout: 'C:\\custom\\path\\zed.exe\n' })
        }
        return Promise.reject(new Error('Not found'))
      })

      const { detectInstalledIDEs } = await import('./ideDetector')
      const result = await detectInstalledIDEs(true)

      expect(result).toEqual([
        {
          id: 'vscode',
          name: 'VS Code',
          executable: 'C:\\custom\\path\\code.cmd',
          icon: 'vscode'
        },
        {
          id: 'cursor',
          name: 'Cursor',
          executable: 'C:\\custom\\path\\cursor.cmd',
          icon: 'cursor'
        },
        {
          id: 'zed',
          name: 'Zed',
          executable: 'C:\\custom\\path\\zed.exe',
          icon: 'zed'
        },
        {
          id: 'explorer',
          name: 'File Explorer',
          executable: 'explorer.exe',
          icon: 'folder'
        }
      ])
    })
  })

  describe('macOS platform detection', () => {
    test('detect via Applications directory', async () => {
      currentPlatform = 'darwin'

      const allowedPaths = new Set([
        '/Applications/Visual Studio Code.app',
        '/Applications/Cursor.app',
        '/Applications/Zed.app'
      ])

      mockAccess.mockImplementation((p: string) => {
        if (allowedPaths.has(p)) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      const { detectInstalledIDEs } = await import('./ideDetector')
      const result = await detectInstalledIDEs(true)

      expect(result).toEqual([
        {
          id: 'vscode',
          name: 'VS Code',
          executable: '/Applications/Visual Studio Code.app',
          icon: 'vscode'
        },
        {
          id: 'cursor',
          name: 'Cursor',
          executable: '/Applications/Cursor.app',
          icon: 'cursor'
        },
        {
          id: 'zed',
          name: 'Zed',
          executable: '/Applications/Zed.app',
          icon: 'zed'
        },
        {
          id: 'finder',
          name: 'Finder',
          executable: 'open',
          icon: 'folder'
        }
      ])
    })

    test('detect via which command when Applications do not exist', async () => {
      currentPlatform = 'darwin'
      mockAccess.mockRejectedValue(new Error('File not found'))

      mockExecAsync.mockImplementation((cmd: string) => {
        if (cmd === 'which code') {
          return Promise.resolve({ stdout: '/usr/local/bin/code\n' })
        }
        if (cmd === 'which cursor') {
          return Promise.resolve({ stdout: '/usr/local/bin/cursor\n' })
        }
        if (cmd === 'which zed') {
          return Promise.resolve({ stdout: '/usr/local/bin/zed\n' })
        }
        return Promise.reject(new Error('Not found'))
      })

      const { detectInstalledIDEs } = await import('./ideDetector')
      const result = await detectInstalledIDEs(true)

      expect(result).toEqual([
        {
          id: 'vscode',
          name: 'VS Code',
          executable: '/usr/local/bin/code',
          icon: 'vscode'
        },
        {
          id: 'cursor',
          name: 'Cursor',
          executable: '/usr/local/bin/cursor',
          icon: 'cursor'
        },
        {
          id: 'zed',
          name: 'Zed',
          executable: '/usr/local/bin/zed',
          icon: 'zed'
        },
        {
          id: 'finder',
          name: 'Finder',
          executable: 'open',
          icon: 'folder'
        }
      ])
    })
  })

  describe('Linux platform detection', () => {
    test('detect via which command', async () => {
      currentPlatform = 'linux'
      mockAccess.mockRejectedValue(new Error('File not found'))

      mockExecAsync.mockImplementation((cmd: string) => {
        if (cmd === 'which code') {
          return Promise.resolve({ stdout: '/usr/bin/code\n' })
        }
        if (cmd === 'which cursor') {
          return Promise.resolve({ stdout: '/usr/bin/cursor\n' })
        }
        if (cmd === 'which zed') {
          return Promise.resolve({ stdout: '/usr/bin/zed\n' })
        }
        return Promise.reject(new Error('Not found'))
      })

      const { detectInstalledIDEs } = await import('./ideDetector')
      const result = await detectInstalledIDEs(true)

      expect(result).toEqual([
        {
          id: 'vscode',
          name: 'VS Code',
          executable: '/usr/bin/code',
          icon: 'vscode'
        },
        {
          id: 'cursor',
          name: 'Cursor',
          executable: '/usr/bin/cursor',
          icon: 'cursor'
        },
        {
          id: 'zed',
          name: 'Zed',
          executable: '/usr/bin/zed',
          icon: 'zed'
        },
        {
          id: 'filemanager',
          name: 'File Manager',
          executable: 'xdg-open',
          icon: 'folder'
        }
      ])
    })
  })

  describe('Cache behavior', () => {
    test('uses cache on subsequent calls and bypasses when forceRefresh is true', async () => {
      currentPlatform = 'darwin'

      mockAccess.mockImplementation((p: string) => {
        if (p === '/Applications/Visual Studio Code.app') {
          return Promise.resolve()
        }
        return Promise.reject(new Error('File not found'))
      })

      const { detectInstalledIDEs } = await import('./ideDetector')

      // 1. 第一次调用，会触发探测
      const result1 = await detectInstalledIDEs()
      expect(result1).toContainEqual({
        id: 'vscode',
        name: 'VS Code',
        executable: '/Applications/Visual Studio Code.app',
        icon: 'vscode'
      })
      const initialAccessCalls = mockAccess.mock.calls.length
      expect(initialAccessCalls).toBeGreaterThan(0)

      // 清除 mock 调用统计记录，以验证第二次是否真正不调用
      mockAccess.mockClear()

      // 2. 第二次调用，forceRefresh 为默认（false），应当走缓存
      const result2 = await detectInstalledIDEs()
      expect(result2).toEqual(result1)
      expect(mockAccess.mock.calls.length).toBe(0) // 没有被调用

      // 3. 第三次调用，forceRefresh 为 true，应当重新触发探测
      const result3 = await detectInstalledIDEs(true)
      expect(result3).toEqual(result1)
      expect(mockAccess.mock.calls.length).toBe(initialAccessCalls)
    })
  })
})
