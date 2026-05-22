import { describe, expect, test, vi, beforeEach } from 'vitest'
import { openInIDE } from './ideLauncher'
import { spawn } from 'child_process'
import { IDEInfo } from './ideDetector'

// Mock child_process
vi.mock('child_process', () => {
  return {
    spawn: vi.fn()
  }
})

describe('openInIDE', () => {
  let mockChild: any
  let errorCallbacks: ((err: Error) => void)[]

  beforeEach(() => {
    vi.clearAllMocks()
    errorCallbacks = []

    mockChild = {
      on: vi.fn((event: string, callback: any) => {
        if (event === 'error') {
          errorCallbacks.push(callback)
        }
        return mockChild
      }),
      unref: vi.fn()
    }

    vi.mocked(spawn).mockReturnValue(mockChild as any)
  })

  test('launches a regular IDE normally', async () => {
    const ide: IDEInfo = {
      id: 'vscode',
      name: 'VS Code',
      executable: 'code',
      icon: 'vscode'
    }
    const projectPath = '/absolute/path/to/project'

    await expect(openInIDE(ide, projectPath)).resolves.toBeUndefined()

    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith(
      'code',
      [projectPath],
      { detached: true, stdio: 'ignore' }
    )
    expect(mockChild.unref).toHaveBeenCalledTimes(1)
  })

  test('launches a macOS .app executable using open -a', async () => {
    const ide: IDEInfo = {
      id: 'vscode',
      name: 'VS Code',
      executable: '/Applications/Visual Studio Code.app',
      icon: 'vscode'
    }
    const projectPath = '/absolute/path/to/project'

    await expect(openInIDE(ide, projectPath)).resolves.toBeUndefined()

    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith(
      'open',
      ['-a', '/Applications/Visual Studio Code.app', projectPath],
      { detached: true, stdio: 'ignore' }
    )
    expect(mockChild.unref).toHaveBeenCalledTimes(1)
  })

  test('special cases path slashes for Windows File Explorer', async () => {
    const ide: IDEInfo = {
      id: 'explorer',
      name: 'File Explorer',
      executable: 'explorer.exe',
      icon: 'folder'
    }
    const projectPath = 'C:/Users/name/projects/my-project'

    await expect(openInIDE(ide, projectPath)).resolves.toBeUndefined()

    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith(
      'explorer.exe',
      ['C:\\Users\\name\\projects\\my-project'],
      { detached: true, stdio: 'ignore' }
    )
    expect(mockChild.unref).toHaveBeenCalledTimes(1)
  })

  test('rejects the promise if the spawn child emits an error event', async () => {
    const ide: IDEInfo = {
      id: 'vscode',
      name: 'VS Code',
      executable: 'code',
      icon: 'vscode'
    }
    const projectPath = '/path'

    // We start the launch
    const promise = openInIDE(ide, projectPath)

    // Trigger error callback asynchronously (simulating how child_process behaves)
    expect(errorCallbacks.length).toBe(1)
    errorCallbacks[0](new Error('Spawn failed mock error'))

    await expect(promise).rejects.toThrow('Failed to launch VS Code: Spawn failed mock error')
  })

  test('rejects the promise if spawn throws a synchronous error', async () => {
    vi.mocked(spawn).mockImplementationOnce(() => {
      throw new Error('Sync spawn error')
    })

    const ide: IDEInfo = {
      id: 'vscode',
      name: 'VS Code',
      executable: 'code',
      icon: 'vscode'
    }
    const projectPath = '/path'

    await expect(openInIDE(ide, projectPath)).rejects.toThrow('Sync spawn error')
  })
})
