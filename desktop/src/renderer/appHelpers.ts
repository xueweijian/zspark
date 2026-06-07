import i18n from './i18n'
/**
 * Pure formatting helpers used by the renderer. No React, no IPC.
 * Every function here is testable in isolation.
 */
import type {
  Activity,
  ApprovalKind,
  ApprovalRequest,
  Block,
  JsonRpcId,
  RuntimeInfo,
  SharedArtifact,
  SharedSession,
  SharedSessionSnapshot,
  SkillMeta,
  ThreadSummary,
  TurnInputItem,
  WorkspaceFile
} from './appTypes'
import { resolveWorkspacePath, dirname } from './artifacts'
import { shortPath } from './runtimeDisplay'
import { inferSkillCategory, isOfficeArtifactGenerationRequest } from './skillCatalog'
import { commandActivityInfo, cleanShellCommand, publicActivityTitleText, shortenCommand, timestampToMs } from './activityHelpers'

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 1) return '<1s'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

export function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/**
 * Drop the boilerplate prefix that we tack onto user prompts (skill
 * preludes, attachment hints, runtime context, …). Used for thread
 * previews and visible echoes so the UI shows what the user typed, not
 * what the agent actually receives.
 */
export function stripInternalPromptContext(text: string): string {
  const raw = String(text ?? '')
  const marker = raw.search(
    /(?:^|\n\s*\n)\s*(?:Use skill:|Attached file:|Attached image:|Zspark local runtime|Zspark execution safety:|Hard delivery contract:|Before using @oai\/artifact-tool|Before the final answer|For PPTX\/presentation tasks|The final response must|\[Skill:)/
  )
  return (marker === -1 ? raw : raw.slice(0, marker)).trim()
}

export function displaySkillName(name?: string): string {
  const raw = String(name ?? 'selected skill')
  return raw.split(':').pop() || raw
}

export function displayThreadPreview(thread: ThreadSummary): string {
  const label = stripInternalPromptContext(thread.preview?.trim() || thread.name || '')
  return label || thread.id.slice(0, 8)
}

export function formatThreadTime(timestamp?: number): string {
  if (!timestamp) return ''
  const timeMs = timestamp > 1e11 ? timestamp : timestamp * 1000
  const now = Date.now()
  const diffMs = now - timeMs
  if (diffMs < 0) return '刚刚'

  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return '刚刚'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}分钟前`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay}天前`

  const date = new Date(timeMs)
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${m}-${d}`
}

export function sharedSessionToThread(session: SharedSession): ThreadSummary {
  const updated = session.updated_at ? Math.floor(new Date(session.updated_at).getTime() / 1000) : undefined
  const created = session.created_at ? Math.floor(new Date(session.created_at).getTime() / 1000) : undefined
  return {
    id: session.id,
    name: session.title ?? undefined,
    preview: session.title ?? undefined,
    createdAt: Number.isFinite(created) ? created : undefined,
    updatedAt: Number.isFinite(updated) ? updated : undefined
  }
}

export function titleFromBlocks(blocks: Block[]): string {
  const user = blocks.find((block): block is Extract<Block, { type: 'user' }> => block.type === 'user')
  const title = stripInternalPromptContext(user?.text ?? '').split('\n').find(Boolean)?.trim()
  return (title || i18n.t('thread.newSharedChat')).slice(0, 120)
}

function boundedString(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null
  return value.slice(0, limit)
}

function optionalBoundedString(value: unknown, limit: number): string | undefined {
  return value == null ? undefined : boundedString(value, limit) ?? undefined
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const ACTIVITY_KINDS = new Set(['reasoning', 'command', 'file', 'tool', 'web', 'memory'])
const ACTION_KINDS = new Set(['read', 'write', 'list', 'search', 'run', 'build', 'verify', 'tool', 'file'])
const ACTIVITY_STATUSES = new Set(['running', 'done', 'failed'])
const FILE_SOURCES = new Set(['attachment', 'change'])
const FILE_STATUSES = new Set(['attached', 'created', 'modified', 'deleted', 'missing'])
const APPROVAL_KINDS = new Set(['command', 'fileChange', 'permissions'])
const APPROVAL_STATUSES = new Set(['pending', 'sending', 'approved', 'approvedAll', 'denied', 'resolved'])
const TURN_BLOCK_STATUSES = new Set(['running', 'completed', 'interrupted', 'failed'])

function normalizeSnapshotActivity(activity: any): Activity | null {
  if (!activity || typeof activity !== 'object') return null
  const id = boundedString(activity.id, 240)
  const title = boundedString(activity.title, 500)
  if (!id || !title) return null
  return {
    id,
    kind: ACTIVITY_KINDS.has(activity.kind) ? activity.kind : 'reasoning',
    title,
    detail: optionalBoundedString(activity.detail, 6000),
    actionKind: ACTION_KINDS.has(activity.actionKind) ? activity.actionKind : undefined,
    target: optionalBoundedString(activity.target, 1200),
    status: ACTIVITY_STATUSES.has(activity.status) ? activity.status : 'done',
    startedAt: finiteNumber(activity.startedAt, 0),
    endedAt: activity.endedAt == null ? undefined : finiteNumber(activity.endedAt)
  }
}

function normalizeSnapshotWorkspaceFile(file: any): WorkspaceFile | null {
  if (!file || typeof file !== 'object') return null
  const id = boundedString(file.id, 240)
  const name = boundedString(file.name, 240)
  const path = boundedString(file.path, 1400)
  if (!id || !name || !path) return null
  return {
    id,
    name,
    path,
    source: FILE_SOURCES.has(file.source) ? file.source : 'change',
    status: FILE_STATUSES.has(file.status) ? file.status : 'missing',
    detail: optionalBoundedString(file.detail, 1000),
    updatedAt: finiteNumber(file.updatedAt, Date.now()),
    sharedArtifact: file.sharedArtifact && typeof file.sharedArtifact === 'object'
      ? {
          workspaceId: String(file.sharedArtifact.workspaceId ?? '').slice(0, 160),
          sessionId: String(file.sharedArtifact.sessionId ?? '').slice(0, 160),
          artifactId: String(file.sharedArtifact.artifactId ?? '').slice(0, 160),
          sizeBytes: file.sharedArtifact.sizeBytes == null ? undefined : finiteNumber(file.sharedArtifact.sizeBytes)
        }
      : undefined
  }
}

function normalizeSnapshotApprovalRequest(request: any): ApprovalRequest | null {
  if (!request || typeof request !== 'object') return null
  const key = boundedString(request.key, 240)
  const method = boundedString(request.method, 160)
  const blockId = boundedString(request.blockId, 240)
  const threadId = boundedString(request.threadId, 240)
  const turnId = boundedString(request.turnId, 240)
  const itemId = boundedString(request.itemId, 240)
  const title = boundedString(request.title, 500)
  const description = boundedString(request.description, 1000)
  if (!key || !method || !blockId || !threadId || !turnId || !itemId || !title || !description) return null
  return {
    id: typeof request.id === 'number' || typeof request.id === 'string' ? request.id : key,
    key,
    kind: APPROVAL_KINDS.has(request.kind) ? request.kind : 'permissions',
    method,
    blockId,
    threadId,
    turnId,
    itemId,
    title,
    description,
    detail: optionalBoundedString(request.detail, 3000),
    commandPreview: optionalBoundedString(request.commandPreview, 3000),
    cwd: optionalBoundedString(request.cwd, 1200),
    reason: optionalBoundedString(request.reason, 1000),
    paths: Array.isArray(request.paths) ? request.paths.map((path: any) => String(path).slice(0, 1200)).slice(0, 200) : [],
    params: request.params,
    status: APPROVAL_STATUSES.has(request.status) ? request.status : 'resolved',
    startedAt: finiteNumber(request.startedAt, Date.now())
  }
}

function normalizeSnapshotBlock(block: any): Block | null {
  if (!block || typeof block !== 'object') return null
  const id = boundedString(block.id, 240)
  if (!id) return null
  if (block.type === 'user') {
    const text = boundedString(block.text, 200_000)
    if (text == null) return null
    return { type: 'user', id, text, turnId: optionalBoundedString(block.turnId, 240), input: Array.isArray(block.input) ? normalizeInputItemsForResubmit(block.input).slice(0, 200) : undefined }
  }
  if (block.type === 'agent') {
    const text = boundedString(block.text, 1_000_000)
    if (text == null) return null
    return { type: 'agent', id, text, turnId: optionalBoundedString(block.turnId, 240), memoryCitation: block.memoryCitation ?? null }
  }
  if (block.type === 'files') {
    const turnId = boundedString(block.turnId, 240)
    const title = boundedString(block.title, 500)
    if (!turnId || !title || !Array.isArray(block.files)) return null
    return {
      type: 'files',
      id,
      turnId,
      title,
      files: block.files.map(normalizeSnapshotWorkspaceFile).filter((file: WorkspaceFile | null): file is WorkspaceFile => Boolean(file)).slice(0, 300),
      subtitle: optionalBoundedString(block.subtitle, 1000),
      tone: block.tone === 'warn' ? 'warn' : block.tone === 'normal' ? 'normal' : undefined
    }
  }
  if (block.type === 'approval') {
    const turnId = boundedString(block.turnId, 240)
    const request = normalizeSnapshotApprovalRequest(block.request)
    if (!turnId || !request) return null
    return { type: 'approval', id, turnId, request }
  }
  if (block.type === 'turn') {
    const turnId = boundedString(block.turnId, 240)
    if (!turnId || !Array.isArray(block.activities)) return null
    return {
      type: 'turn',
      id,
      turnId,
      activities: block.activities.map(normalizeSnapshotActivity).filter((activity: Activity | null): activity is Activity => Boolean(activity)).slice(0, 1000),
      collapsed: Boolean(block.collapsed),
      finalMessageId: optionalBoundedString(block.finalMessageId, 240),
      startedAt: finiteNumber(block.startedAt, Date.now()),
      endedAt: block.endedAt == null ? undefined : finiteNumber(block.endedAt),
      status: TURN_BLOCK_STATUSES.has(block.status) ? block.status : undefined
    }
  }
  return null
}

export function blocksFromSharedSnapshot(snapshot?: SharedSessionSnapshot | null): Block[] {
  const blocks = Array.isArray(snapshot?.blocks) ? snapshot.blocks : []
  return blocks
    .map(normalizeSnapshotBlock)
    .filter((block: Block | null): block is Block => Boolean(block))
}

export function upsertApprovalBlockByTurnOrder(blocks: Block[], block: Extract<Block, { type: 'approval' }>): Block[] {
  const existing = blocks.findIndex((candidate) => candidate.type === 'approval' && candidate.request.key === block.request.key)
  if (existing !== -1) return blocks.map((candidate, index) => (index === existing ? block : candidate))

  let insertAfter = -1
  blocks.forEach((candidate, index) => {
    if ('turnId' in candidate && candidate.turnId === block.turnId) insertAfter = index
  })
  if (insertAfter === -1) return [...blocks, block]
  return [...blocks.slice(0, insertAfter + 1), block, ...blocks.slice(insertAfter + 1)]
}

export function formatUserInputContent(content: any[]): string {
  const visible: string[] = []
  const skills: string[] = []
  for (const c of content) {
    if (c?.type === 'text') {
      const text = stripInternalPromptContext(c.text ?? '')
      if (text) visible.push(text)
      continue
    }
    if (c?.type === 'image') {
      visible.push(`[Image: ${c.url?.startsWith?.('data:') ? 'attached image' : c.url ?? 'attached image'}]`)
      continue
    }
    if (c?.type === 'localImage') {
      visible.push(`[Image: ${basename(String(c.path ?? 'attached image'))}]`)
      continue
    }
    if (c?.type === 'skill') {
      skills.push(displaySkillName(c.name))
      continue
    }
    if (c?.type === 'mention') {
      visible.push(`[Mention: ${c.name ?? 'selected mention'}]`)
    }
  }
  if (visible.length) return visible.join('\n')
  if (skills.length) return `Using ${skills.join(', ')}`
  return ''
}

export function normalizeInputItemsForResubmit(content: any[]): TurnInputItem[] {
  const items: TurnInputItem[] = []
  for (const c of content) {
    if (c?.type === 'text') {
      const text = String(c.text ?? '')
      if (text) items.push({ type: 'text', text, textElements: c.textElements ?? c.text_elements ?? [] })
      continue
    }
    if (c?.type === 'image' && c.url) {
      items.push({ type: 'image', url: String(c.url) })
      continue
    }
    if (c?.type === 'localImage' && c.path) {
      items.push({ type: 'localImage', path: String(c.path) })
      continue
    }
    if (c?.type === 'skill' && c.name && c.path) {
      items.push({ type: 'skill', name: String(c.name), path: String(c.path) })
      continue
    }
    if (c?.type === 'mention' && c.name && c.path) {
      items.push({ type: 'mention', name: String(c.name), path: String(c.path) })
    }
  }
  return items
}

export function scopeLabel(scope?: string): string {
  switch (scope) {
    case 'repo':   return i18n.t('scope.project')
    case 'user':   return i18n.t('scope.user')
    case 'system': return i18n.t('scope.system')
    case 'admin':  return i18n.t('scope.admin')
    default:       return i18n.t('scope.skill')
  }
}

export function localSkillSourceLabel(source?: string): string {
  switch (source) {
    case 'workspace':   return i18n.t('skillSource.project')
    case 'pluginCache': return i18n.t('skillSource.pluginCache')
    case 'system':      return i18n.t('skillSource.system')
    case 'user':        return i18n.t('skillSource.user')
    default:            return source ?? i18n.t('skillSource.local')
  }
}

export function skillStatusLabel(skill: SkillMeta): string {
  if (skill.availability === 'localOnly') return i18n.t('skills.detected')
  if (skill.enabled === false) return i18n.t('skills.disabled')
  return i18n.t('skills.ready')
}

export function skillStatusClass(skill: SkillMeta): string {
  if (skill.availability === 'localOnly') return 'local'
  if (skill.enabled === false) return 'disabled'
  return 'ready'
}

export function changeKindLabel(kind: any): WorkspaceFile['status'] {
  if (kind?.type === 'add' || kind === 'add') return 'created'
  if (kind?.type === 'delete' || kind === 'delete') return 'deleted'
  return 'modified'
}

export function describeChange(kind: any): string {
  if (kind?.type === 'update' && kind.movePath) return i18n.t('fileChange.moved', { path: kind.movePath })
  return changeKindLabel(kind)
}

export function turnIdFromParams(params: any): string {
  return String(params?.turnId ?? params?.turn?.id ?? '')
}

export function sharedArtifactPath(workspaceId: string, sessionId: string, artifactId: string, name: string): string {
  return `shared://${workspaceId}/${sessionId}/${artifactId}/${name}`
}

export function isSharedArtifactPath(path?: string): boolean {
  return Boolean(path?.startsWith('shared://'))
}

function artifactLookupName(path?: string): string {
  return basename(String(path ?? '')).trim().toLowerCase()
}

export function findSharedWorkspaceFileForPath(files: WorkspaceFile[], path?: string): WorkspaceFile | null {
  const rawPath = String(path ?? '').trim()
  if (!rawPath) return null
  const sharedFiles = files.filter((file) => file.sharedArtifact)
  const exact = sharedFiles.find((file) => file.path === rawPath)
  if (exact) return exact

  const name = artifactLookupName(rawPath)
  if (!name) return null
  return sharedFiles.find((file) => artifactLookupName(file.name) === name || artifactLookupName(file.path) === name) ?? null
}

export function sharedArtifactFile(workspaceId: string, sessionId: string, artifact: SharedArtifact): WorkspaceFile {
  const createdAt = artifact.created_at ? Date.parse(artifact.created_at) : Date.now()
  return {
    id: `shared-${artifact.id}`,
    name: artifact.name,
    path: sharedArtifactPath(workspaceId, sessionId, artifact.id, artifact.name),
    source: 'change',
    status: 'created',
    detail: `Shared artifact${artifact.size_bytes ? ` (${fmtBytes(artifact.size_bytes)})` : ''}`,
    updatedAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    sharedArtifact: {
      workspaceId,
      sessionId,
      artifactId: artifact.id,
      sizeBytes: artifact.size_bytes
    }
  }
}

export function fmtRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 周前`
  return `${Math.floor(days / 30)} 月前`
}

export function candidateWorkspacePaths(path: string, runtime: RuntimeInfo) {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) return [path]
  const bases = [runtime.cwd, runtime.workspaceRoot].filter((base): base is string => Boolean(base))
  const seen = new Set<string>()
  const paths = bases.length ? bases.map((base) => resolveWorkspacePath(path, base)) : [path]
  return paths.filter((candidate) => {
    if (seen.has(candidate)) return false
    seen.add(candidate)
    return true
  })
}

export function artifactDownloadLabel(path: string) {
  const ext = basename(path).split('.').pop()?.toUpperCase()
  return ext ? `Download ${ext}` : 'Download'
}

export async function scanRecentArtifactCandidates(limit = 48): Promise<Array<{ path: string; name: string; size: number; mtimeMs: number }>> {
  try {
    const result = await window.zspark.scanRecentArtifacts({ sinceMs: 0, limit })
    return result.artifacts ?? []
  } catch {
    return []
  }
}

export function rpcKey(id: JsonRpcId) {
  return String(id)
}

export function userApprovalParams(permissionLevel: string) {
  const approvalPolicy = (permissionLevel === 'auto' || permissionLevel === 'full') ? 'untrusted' : 'on-request'
  return { approvalPolicy, approvalsReviewer: 'user' }
}

export function isApprovalRequest(method: string) {
  return method === 'item/commandExecution/requestApproval' ||
    method === 'item/fileChange/requestApproval' ||
    method === 'item/permissions/requestApproval' ||
    method === 'execCommandApproval' ||
    method === 'applyPatchApproval'
}

export function approvalKindForMethod(method: string): ApprovalKind | null {
  switch (method) {
    case 'item/commandExecution/requestApproval': return 'command'
    case 'execCommandApproval': return 'command'
    case 'item/fileChange/requestApproval': return 'fileChange'
    case 'applyPatchApproval': return 'fileChange'
    case 'item/permissions/requestApproval': return 'permissions'
    default: return null
  }
}

export function uniqueCompact(values: Array<string | undefined | null>) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

export function pathsFromCommandActions(actions: any[] | null | undefined) {
  if (!Array.isArray(actions)) return []
  return uniqueCompact(actions.map((action) => action?.path))
}

export function permissionPaths(permissions: any) {
  const fs = permissions?.fileSystem
  const entryPaths = Array.isArray(fs?.entries)
    ? fs.entries.map((entry: any) => entry?.path ?? entry?.root)
    : []
  return uniqueCompact([
    ...(Array.isArray(fs?.read) ? fs.read : []),
    ...(Array.isArray(fs?.write) ? fs.write : []),
    ...entryPaths
  ])
}

export function permissionSummary(permissions: any) {
  const parts: string[] = []
  const paths = permissionPaths(permissions)
  if (paths.length) parts.push(`${paths.length} filesystem path${paths.length === 1 ? '' : 's'}`)
  if (permissions?.network?.enabled) parts.push('network access')
  return parts.length ? parts.join(' and ') : 'extra access'
}

export function approvalRequestFromServer(id: JsonRpcId, method: string, params: any): ApprovalRequest | null {
  const kind = approvalKindForMethod(method)
  if (!kind) return null
  const key = rpcKey(id)
  const turnId = String(params?.turnId ?? '')
  const threadId = String(params?.threadId ?? params?.conversationId ?? '')
  const itemId = String(params?.itemId ?? params?.callId ?? key)
  const cwd = params?.cwd ? String(params.cwd) : undefined
  const reason = params?.reason ? String(params.reason) : undefined
  const startedAt = timestampToMs(params?.startedAtMs, Date.now())

  if (kind === 'command') {
    const rawCommand = Array.isArray(params?.command) ? params.command.join(' ') : params?.command
    const info = commandActivityInfo({ command: rawCommand, commandActions: params?.commandActions })
    const command = rawCommand ? cleanShellCommand(String(rawCommand)) : undefined
    const paths = pathsFromCommandActions(params?.commandActions)
    return {
      id, key, kind, method, threadId, turnId, itemId,
      blockId: `approval-${key}`,
      title: publicActivityTitleText(info.title),
      description: params?.networkApprovalContext
        ? 'Codex needs network permission before continuing this step.'
        : 'Codex needs your approval before running this action outside the current sandbox.',
      detail: paths.length ? `${paths.length} related path${paths.length === 1 ? '' : 's'}` : undefined,
      commandPreview: command ? shortenCommand(command, 120) : undefined,
      cwd,
      reason,
      paths,
      params,
      status: 'pending',
      startedAt
    }
  }

  if (kind === 'fileChange') {
    const grantRoot = params?.grantRoot ? String(params.grantRoot) : undefined
    const changedPaths = params?.fileChanges && typeof params.fileChanges === 'object'
      ? Object.keys(params.fileChanges)
      : []
    return {
      id, key, kind, method, threadId, turnId, itemId,
      blockId: `approval-${key}`,
      title: 'Allow file changes',
      description: 'Codex wants to apply file changes and needs your approval.',
      detail: grantRoot ? `Requested write root: ${shortPath(grantRoot)}` : undefined,
      cwd,
      reason,
      paths: uniqueCompact([grantRoot, ...changedPaths]),
      params,
      status: 'pending',
      startedAt
    }
  }

  const paths = permissionPaths(params?.permissions)
  return {
    id, key, kind, method, threadId, turnId, itemId,
    blockId: `approval-${key}`,
    title: 'Grant extra access',
    description: `Codex is asking for ${permissionSummary(params?.permissions)}.`,
    detail: paths.length ? paths.map(shortPath).join('\n') : undefined,
    cwd,
    reason,
    paths,
    params,
    status: 'pending',
    startedAt
  }
}

export function filesFromChanges(changes: any[], base?: string, now = Date.now()): WorkspaceFile[] {
  return changes.map((change, index) => {
    const fullPath = resolveWorkspacePath(String(change.path ?? ''), base)
    const status = changeKindLabel(change.kind)
    return {
      id: `chg-${now}-${index}`,
      name: basename(fullPath),
      path: fullPath,
      source: 'change' as const,
      status,
      detail: describeChange(change.kind),
      updatedAt: now
    }
  }).filter((file) => file.path)
}

export function officeRuntimeContext(skills: SkillMeta[], runtime: RuntimeInfo): string[] {
  if (!skills.some((skill) => inferSkillCategory(skill) === 'office')) return []
  const rt = runtime.workspaceRuntime
  if (!rt?.available) {
    return [
      [
        'Zspark local artifact runtime is unavailable for the selected Office skill.',
        `- Expected Node executable: ${rt?.nodePath ?? 'not reported'}`,
        `- Expected Node packages: ${rt?.nodeModulesPath ?? 'not reported'}`,
        '- Do not claim an editable Office artifact was generated.',
        '- If the user asked to create or edit a PPTX/DOCX/XLSX/PDF artifact, report this runtime blocker instead of inventing an output path.'
      ].join('\n')
    ]
  }

  const presentationSkill = skills.find((skill) => {
    const text = `${skill.name} ${skill.displayName ?? ''} ${skill.path ?? ''}`
    return /\b(presentation|presentations|pptx?|powerpoint|slides?)\b/i.test(text)
  })
  const presentationSkillDir = dirname(presentationSkill?.path)
  const pythonRuntimeLine = rt.pythonAvailable
    ? `- Python executable: ${rt.pythonPath}`
    : `- Python executable: ${rt.pythonPath} (not found; use Node.js runtime unless a Python-only helper is required)`
  const lines = [
    'Zspark local runtime for the selected Office skill:',
    `- Node.js executable: ${rt.nodePath}`,
    `- Node.js packages: ${rt.nodeModulesPath}`,
    pythonRuntimeLine,
    'Use these bundled Node.js dependencies for presentations and other Node-based artifact helpers. Use Python only when the selected skill/helper requires it.',
    'Hard delivery contract: create an actual editable artifact file in the workspace. A prose specification is a failure unless a real command fails and you report that command error.',
    'Before using @oai/artifact-tool from an output work directory, run this preflight pattern:',
    `  mkdir -p "$WORKSPACE" && cd "$WORKSPACE" && ln -sfn "${rt.nodeModulesPath}" node_modules`,
    `  "${rt.nodePath}" -e "import('@oai/artifact-tool').then(() => console.log('artifact-tool ok'))"`,
    'Before the final answer, verify the delivered file with `test -s "$FINAL_ARTIFACT" && ls -lh "$FINAL_ARTIFACT"`. Do not claim success or report a final path until that command succeeds.'
  ]
  if (presentationSkillDir) {
    lines.push(
      'For PPTX/presentation tasks, use the installed Presentations scripts instead of hand-waving:',
      `- SKILL_DIR: ${presentationSkillDir}`,
      `- Build/export helper: "${rt.nodePath}" "${presentationSkillDir}/scripts/build_artifact_deck.mjs" --slides-dir "$SLIDES_DIR" --out "$FINAL_PPTX" --preview-dir "$PREVIEW_DIR" --layout-dir "$LAYOUT_DIR"`,
      'Artifact-tool compose rules: write plain ESM slide modules, not raw JSX/HTML; `panel` accepts one child; use `row`/`column` with array children; `justify` values are start, center, end, or stretch.',
      'If the build helper fails, patch the slide source and rerun it until `test -s "$FINAL_PPTX"` passes.',
      'The final response must include only a PPTX path that exists after the verification command.'
    )
  }
  return [
    lines.join('\n')
  ]
}

export function officeArtifactRuntimeBlocker(text: string, skills: SkillMeta[], runtime: RuntimeInfo): string | null {
  if (!isOfficeArtifactGenerationRequest(text, skills)) return null
  const rt = runtime.workspaceRuntime
  if (rt?.available) return null
  return [
    'Artifact runtime is missing, so Zspark cannot create editable Office artifacts on this machine.',
    `Expected Node: ${rt?.nodePath ?? 'not reported'}`,
    `Expected packages: ${rt?.nodeModulesPath ?? 'not reported'}`
  ].join('\n')
}

export function executionSafetyContext(prompt: string): string[] {
  const lower = prompt.toLowerCase()
  const mutatesFiles = /删除|删掉|移到|移动|放到|trash|废纸篓|delete|remove|move|rename|rm\b|mv\b/.test(lower)
  const targetsExternalPath = /桌面|desktop|downloads|documents|\/users\/|~\/|trash|废纸篓/.test(lower)
  if (!mutatesFiles || !targetsExternalPath) return []
  return [
    [
      'Zspark execution safety:',
      '- Do not claim that a file operation completed until command output and a follow-up check prove it.',
      '- For deleting, moving, trashing, or writing files outside the workspace, call exec_command with sandbox_permissions set to require_escalated and provide a concise justification so Zspark can show Approve/Deny.',
      '- Use command forms that fail on permission errors; do not mask failures with a later success-looking echo.'
    ].join('\n')
  ]
}
