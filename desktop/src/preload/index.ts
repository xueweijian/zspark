import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const api = {
  send: (line: string) => ipcRenderer.invoke('codex:send', line),
  restart: () => ipcRenderer.invoke('codex:restart'),
  getSlashCommands: () => ipcRenderer.invoke('slashCommands:get'),
  pickAttachments: () => ipcRenderer.invoke('attachments:pick'),
  saveBase64Attachment: (base64: string, name: string, mime: string) => ipcRenderer.invoke('attachments:saveBase64', { base64, name, mime }),
  readAttachmentAsDataURL: (path: string) => ipcRenderer.invoke('attachments:readAsDataURL', path),
  getRuntimeInfo: () => ipcRenderer.invoke('runtime:get'),
  discoverLocalSkills: () => ipcRenderer.invoke('skills:localAvailability'),
  openSkillPath: (path: string) => ipcRenderer.invoke('skill:open', path),
  openPath: (path: string) => ipcRenderer.invoke('path:open', path),
  revealPath: (path: string) => ipcRenderer.invoke('path:reveal', path),
  downloadPath: (path: string) => ipcRenderer.invoke('path:download', path),
  statPath: (path: string) => ipcRenderer.invoke('path:stat', path),
  openExternalUrl: (url: string) => ipcRenderer.invoke('url:openExternal', url),
  scanRecentArtifacts: (options?: { sinceMs?: number; limit?: number }) => ipcRenderer.invoke('artifacts:scanRecent', options),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: any) => ipcRenderer.invoke('settings:save', s),
  enterpriseStatus: () => ipcRenderer.invoke('enterprise:status'),
  enterpriseLogin: () => ipcRenderer.invoke('enterprise:login'),
  enterpriseLogout: () => ipcRenderer.invoke('enterprise:logout'),
  enterpriseWhoami: () => ipcRenderer.invoke('enterprise:whoami'),
  enterpriseWorkspaces: () => ipcRenderer.invoke('enterprise:workspaces'),
  enterpriseCreateWorkspace: (name?: string) => ipcRenderer.invoke('enterprise:createWorkspace', name),
  enterpriseSessions: (workspaceId: string) => ipcRenderer.invoke('enterprise:sessions', workspaceId),
  enterpriseCreateSession: (workspaceId: string, body?: any) => ipcRenderer.invoke('enterprise:createSession', workspaceId, body),
  enterpriseReadSession: (workspaceId: string, sessionId: string) => ipcRenderer.invoke('enterprise:readSession', workspaceId, sessionId),
  enterpriseUpdateSession: (workspaceId: string, sessionId: string, body?: any) => ipcRenderer.invoke('enterprise:updateSession', workspaceId, sessionId, body),
  enterpriseDeleteSession: (workspaceId: string, sessionId: string) => ipcRenderer.invoke('enterprise:deleteSession', workspaceId, sessionId),
  enterpriseArtifacts: (workspaceId: string, sessionId: string) => ipcRenderer.invoke('enterprise:artifacts', workspaceId, sessionId),
  enterpriseUploadArtifact: (workspaceId: string, sessionId: string, filePath: string, meta?: any) => ipcRenderer.invoke('enterprise:uploadArtifact', workspaceId, sessionId, filePath, meta),
  enterpriseDownloadArtifact: (workspaceId: string, sessionId: string, artifactId: string, name?: string) => ipcRenderer.invoke('enterprise:downloadArtifact', workspaceId, sessionId, artifactId, name),
  enterpriseDownloadArtifactToCache: (workspaceId: string, sessionId: string, artifactId: string, name?: string) => ipcRenderer.invoke('enterprise:downloadArtifactToCache', workspaceId, sessionId, artifactId, name),
  enterpriseOpenArtifactCache: (workspaceId?: string, sessionId?: string) => ipcRenderer.invoke('enterprise:openArtifactCache', workspaceId, sessionId),
  pickWorkspace: () => ipcRenderer.invoke('workspace:pick'),
  switchWorkspace: (path: string) => ipcRenderer.invoke('workspace:switch', path),
  getRecentWorkspaces: () => ipcRenderer.invoke('workspace:recent'),
  detectTechStack: (path: string) => ipcRenderer.invoke('workspace:detectTechStack', path),
  detectIdes: (forceRefresh?: boolean) => ipcRenderer.invoke('ides:detect', forceRefresh),
  openInIde: (ide: any, projectPath: string) => ipcRenderer.invoke('ides:open', ide, projectPath),
  onEnterpriseDeviceCode: (cb: (payload: { userCode?: string; verificationUri?: string; message?: string; expiresOn?: number | null }) => void) => {
    const listener = (_e: IpcRendererEvent, payload: { userCode?: string; verificationUri?: string; message?: string; expiresOn?: number | null }) => cb(payload)
    ipcRenderer.on('enterprise:deviceCode', listener)
    return () => ipcRenderer.removeListener('enterprise:deviceCode', listener)
  },
  onStdout: (cb: (s: string) => void) => {
    const listener = (_e: IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on('codex:stdout', listener)
    return () => ipcRenderer.removeListener('codex:stdout', listener)
  },
  onStderr: (cb: (s: string) => void) => {
    const listener = (_e: IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on('codex:stderr', listener)
    return () => ipcRenderer.removeListener('codex:stderr', listener)
  },
  onExit: (cb: (code: number | null) => void) => {
    const listener = (_e: IpcRendererEvent, c: number | null) => cb(c)
    ipcRenderer.on('codex:exit', listener)
    return () => ipcRenderer.removeListener('codex:exit', listener)
  },
  onSpawned: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('codex:spawned', listener)
    return () => ipcRenderer.removeListener('codex:spawned', listener)
  },
  previewOpen: (url: string, bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('preview:open', { url, bounds }),
  previewNavigate: (url: string) => ipcRenderer.invoke('preview:navigate', url),
  previewSetBounds: (bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('preview:setBounds', bounds),
  previewSetVisible: (visible: boolean) => ipcRenderer.invoke('preview:setVisible', visible),
  previewClose: () => ipcRenderer.invoke('preview:close'),
  previewMessage: (payload: any) => ipcRenderer.invoke('preview:message', payload),
  gitStatus: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
  gitDiffs: (cwd: string) => ipcRenderer.invoke('git:diffs', cwd),
  gitLog: (cwd: string, limit?: number) => ipcRenderer.invoke('git:log', cwd, limit),
  gitCommitDiff: (cwd: string, sha: string) => ipcRenderer.invoke('git:commitDiff', cwd, sha),
  gitStageFile: (cwd: string, path: string) => ipcRenderer.invoke('git:stageFile', cwd, path),
  gitStageAll: (cwd: string) => ipcRenderer.invoke('git:stageAll', cwd),
  gitUnstageFile: (cwd: string, path: string) => ipcRenderer.invoke('git:unstageFile', cwd, path),
  gitRevertFile: (cwd: string, path: string) => ipcRenderer.invoke('git:revertFile', cwd, path),
  gitRevertAll: (cwd: string) => ipcRenderer.invoke('git:revertAll', cwd),
  gitCommit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', cwd, message),
  gitPush: (cwd: string) => ipcRenderer.invoke('git:push', cwd),
  gitPull: (cwd: string) => ipcRenderer.invoke('git:pull', cwd),
  gitFetch: (cwd: string) => ipcRenderer.invoke('git:fetch', cwd),
  gitSync: (cwd: string) => ipcRenderer.invoke('git:sync', cwd),
  gitListBranches: (cwd: string) => ipcRenderer.invoke('git:listBranches', cwd),
  gitCheckoutBranch: (cwd: string, name: string) => ipcRenderer.invoke('git:checkoutBranch', cwd, name),
  gitCreateBranch: (cwd: string, name: string) => ipcRenderer.invoke('git:createBranch', cwd, name),
  gitRemote: (cwd: string) => ipcRenderer.invoke('git:remote', cwd),
  onPreviewEvent: (cb: (payload: any) => void) => {
    const listener = (_e: IpcRendererEvent, payload: any) => cb(payload)
    ipcRenderer.on('preview:event', listener)
    return () => ipcRenderer.removeListener('preview:event', listener)
  }
}

contextBridge.exposeInMainWorld('zspark', api)
export type ZsparkApi = typeof api

