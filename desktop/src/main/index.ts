import { app, BrowserWindow, dialog, ipcMain, shell, safeStorage } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { randomBytes } from 'node:crypto'
import { spawn, ChildProcessWithoutNullStreams, execSync } from 'node:child_process'
import { basename, delimiter, dirname, join, resolve } from 'node:path'
import { copyFileSync, existsSync, mkdirSync, openSync, fsyncSync, closeSync, readFileSync, writeFileSync, createWriteStream, WriteStream, statSync, renameSync, realpathSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { PublicClientApplication } from '@azure/msal-node'
import { scanRecentArtifacts } from './artifacts'
import { importAttachmentFiles, sanitizeAttachmentName, attachmentKindForMime } from './attachments'
import { startBridge, setUpstream } from './bridge'
import { discoverLocalSkills } from './localSkills'
import {
  buildMcpServersTomlValue,
  duplicateMcpServerNames,
  sanitizeMcpServerList,
  type McpServerEntry
} from './mcpServers'
import { redactProcessArgsForLog, redactSensitiveLogLine, redactSensitiveLogText } from './logRedaction'
import {
  decryptSensitiveMcpEnvWithIssues,
  encryptSensitiveMcpEnv,
  hasEncryptedMcpEnv,
  maskSensitiveMcpEnvForView,
  mergeMaskedMcpEnv
} from './settingsSecrets'
import { artifactMimeType, contentDispositionFileName } from './mime'
import {
  ensureShellOpenAllowed,
  isInsidePath,
  openExternalUrl,
  resolveAllowedLocalPath as resolveAllowedLocalPathRaw
} from './pathSafety'
import { ensureWorkspaceRoot, resolveWorkspaceRoot, validateWorkspaceRoot, detectTechStack } from './workspaceRoot'
import { detectInstalledIDEs } from './ideDetector'
import { openInIDE } from './ideLauncher'

let mainWindow: BrowserWindow | null = null
let codex: ChildProcessWithoutNullStreams | null = null

function safeSendToRenderer(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

interface ProviderConfig {
  baseUrl: string       // upstream endpoint (chat or responses)
  apiKey: string        // sk-...
  model: string         // e.g. gpt-4o-mini, gpt-5
  wireApi: 'responses' | 'chat'
}

interface EnterpriseConfig {
  serverUrl: string
  tenantId: string
  clientId: string
  apiScope: string
  authority: string
}

interface EnterpriseAuth {
  accessToken: string
  expiresAt: number
  username?: string
  name?: string
  homeAccountId?: string
}

interface CollapsedSections {
  localWorkspaces?: boolean
  sharedWorkspaces?: boolean
  recent?: boolean
}

interface AppSettings {
  provider?: ProviderConfig
  enterprise?: Partial<EnterpriseConfig>
  enterpriseAuth?: EnterpriseAuth
  mcpServers?: McpServerEntry[]
  recentWorkspaces?: string[]
  activeWorkspace?: string
  workspaceTechStack?: Record<string, string>
  workspaceLastUsed?: Record<string, number>
  collapsedSections?: CollapsedSections
  permissionLevel?: 'default' | 'auto' | 'full'
}

let bridgePort: number | null = null
let bridgeClose: (() => void) | null = null
let settingsLoadIssue: string | null = null
let mcpSecretDecryptIssues: string[] = []

const PROVIDER_ENDPOINT_SUFFIXES = ['/chat/completions', '/responses', '/models']
const DEFAULT_ENTRA_TENANT_ID = process.env.ZSPARK_TENANT_ID ?? ''
const DEFAULT_ENTRA_CLIENT_ID = process.env.ZSPARK_CLIENT_ID ?? ''
const DEFAULT_ENTRA_API_SCOPE = process.env.ZSPARK_API_SCOPE ?? (DEFAULT_ENTRA_CLIENT_ID ? `api://${DEFAULT_ENTRA_CLIENT_ID}/access_as_user` : '')
const DEFAULT_ENTRA_AUTHORITY = process.env.ZSPARK_AUTHORITY ?? (DEFAULT_ENTRA_TENANT_ID ? `https://login.partner.microsoftonline.cn/${DEFAULT_ENTRA_TENANT_ID}` : '')
const DEFAULT_WORKSPACE_SERVER_URL = process.env.ZSPARK_SERVER_URL ?? ''

const SETTINGS_PATH = join(app.getPath('userData'), 'zspark-settings.json')
let WORKSPACE_ROOT = resolveWorkspaceRoot(process.cwd())
let ATTACHMENTS_DIR = join(WORKSPACE_ROOT, '.zspark-attachments')

function updateWorkspaceRoot(newRoot: string) {
  WORKSPACE_ROOT = newRoot
  ATTACHMENTS_DIR = join(newRoot, '.zspark-attachments')
  ensureWorkspaceRoot(newRoot)
}
const CODEX_RUNTIME_DEPS_DIR = join(app.getPath('home'), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies')
const CODEX_RUNTIME_NODE = join(CODEX_RUNTIME_DEPS_DIR, 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node')
const CODEX_RUNTIME_NODE_MODULES = join(CODEX_RUNTIME_DEPS_DIR, 'node', 'node_modules')
const CODEX_RUNTIME_PYTHON = join(CODEX_RUNTIME_DEPS_DIR, 'python', 'bin', process.platform === 'win32' ? 'python.exe' : 'python3')
const MAX_CODEX_LOG_BYTES = 8 * 1024 * 1024
// Server enforces a 50 MB artifact size + 70 MB JSON body cap; keep the
// renderer-side guard below the JSON cap (base64 inflates ~1.37×).
const MAX_ARTIFACT_UPLOAD_BYTES = 50 * 1024 * 1024
const BRIDGE_API_KEY = randomBytes(32).toString('hex')
ensureWorkspaceRoot(WORKSPACE_ROOT)

function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
    settingsLoadIssue = null
    if (raw?.provider?.encryptedApiKey && settingsEncryptionAvailable()) {
      raw.provider.apiKey = safeStorage.decryptString(Buffer.from(raw.provider.encryptedApiKey, 'base64'))
      delete raw.provider.encryptedApiKey
    }
    if (raw?.enterpriseAuth?.encryptedAccessToken && settingsEncryptionAvailable()) {
      raw.enterpriseAuth.accessToken = safeStorage.decryptString(Buffer.from(raw.enterpriseAuth.encryptedAccessToken, 'base64'))
      delete raw.enterpriseAuth.encryptedAccessToken
    }
    mcpSecretDecryptIssues = []
    const mcpServers = sanitizeMcpServerList(raw?.mcpServers)
    if (settingsEncryptionAvailable()) {
      const result = decryptSensitiveMcpEnvWithIssues(mcpServers, (value) => safeStorage.decryptString(Buffer.from(value, 'base64')))
      raw.mcpServers = result.servers
      mcpSecretDecryptIssues = result.issues.map((issue) => (
        `${issue.serverName || issue.serverId || 'unknown'}.${issue.key}: ${issue.error}`
      ))
    } else {
      raw.mcpServers = mcpServers
    }
    return raw
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      settingsLoadIssue = null
      mcpSecretDecryptIssues = []
      return {}
    }
    mcpSecretDecryptIssues = []
    const backupPath = `${SETTINGS_PATH}.corrupt-${Date.now()}`
    try {
      if (existsSync(SETTINGS_PATH)) renameSync(SETTINGS_PATH, backupPath)
      settingsLoadIssue = `Settings could not be read and were preserved at ${backupPath}.`
    } catch (renameErr: any) {
      settingsLoadIssue = `Settings could not be read. ${renameErr?.message ?? String(renameErr)}`
    }
    return {}
  }
}

function settingsEncryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function settingsWarnings(s: AppSettings) {
  const warnings: string[] = []
  if (settingsLoadIssue) warnings.push(settingsLoadIssue)
  if (!settingsEncryptionAvailable()) {
    warnings.push('System keychain encryption is unavailable. Provider API keys, Entra tokens, and sensitive MCP env values saved on this machine will be stored in the app settings file.')
  }
  if ((s.provider as any)?.encryptedApiKey && !s.provider?.apiKey) {
    warnings.push('An encrypted provider API key exists but cannot be decrypted on this machine. Re-enter the key before saving provider settings.')
  }
  if ((s.enterpriseAuth as any)?.encryptedAccessToken && !s.enterpriseAuth?.accessToken) {
    warnings.push('The saved Entra token cannot be decrypted on this machine. Sign in again before using shared workspaces.')
  }
  if (mcpSecretDecryptIssues.length > 0) {
    warnings.push(`Some MCP server secrets could not be decrypted and were cleared. Re-enter these values before using the affected servers: ${mcpSecretDecryptIssues.join('; ')}`)
  }
  if (hasEncryptedMcpEnv(s.mcpServers) && !settingsEncryptionAvailable()) {
    warnings.push('Encrypted MCP server env values cannot be decrypted on this machine. Re-enter those values before using the affected MCP servers.')
  }
  const duplicateNames = duplicateMcpServerNames(sanitizeMcpServerList(s.mcpServers))
  if (duplicateNames.length > 0) {
    warnings.push(`Duplicate enabled MCP server names are configured; only the first enabled server for each name will be launched: ${duplicateNames.join(', ')}`)
  }
  if (isRemoteHttpEnterpriseUrl(s.enterprise?.serverUrl)) {
    warnings.push('Shared workspace server is using plain HTTP. This is acceptable for a controlled demo or private tunnel, but use HTTPS before customer or production use.')
  }
  return warnings
}

function saveSettings(s: AppSettings) {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const out: any = { ...s }
  if (out.provider?.apiKey && settingsEncryptionAvailable()) {
    out.provider = {
      ...out.provider,
      encryptedApiKey: safeStorage.encryptString(out.provider.apiKey).toString('base64')
    }
    delete out.provider.apiKey
  }
  if (out.enterpriseAuth?.accessToken && settingsEncryptionAvailable()) {
    out.enterpriseAuth = {
      ...out.enterpriseAuth,
      encryptedAccessToken: safeStorage.encryptString(out.enterpriseAuth.accessToken).toString('base64')
    }
    delete out.enterpriseAuth.accessToken
  }
  if (out.mcpServers) {
    const mcpServers = sanitizeMcpServerList(out.mcpServers)
    out.mcpServers = settingsEncryptionAvailable()
      ? encryptSensitiveMcpEnv(mcpServers, (value) => safeStorage.encryptString(value).toString('base64'))
      : mcpServers
  }
  const tmpPath = `${SETTINGS_PATH}.${process.pid}.${Date.now()}.tmp`
  // fsync the bytes before rename so a crash between write+rename can't
  // leave a zero-byte settings file on next boot.
  const fd = openSync(tmpPath, 'w', 0o600)
  try {
    writeFileSync(fd, JSON.stringify(out, null, 2))
    try { fsyncSync(fd) } catch { /* fsync is best-effort on some FS */ }
  } finally {
    closeSync(fd)
  }
  renameSync(tmpPath, SETTINGS_PATH)
  settingsLoadIssue = null
  mcpSecretDecryptIssues = []
}

/**
 * Serialize all settings mutations through a single in-process queue so two
 * concurrent IPC handlers (e.g. provider save + enterprise logout) can't
 * read-modify-write the same file and lose updates.
 */
let settingsMutationQueue: Promise<unknown> = Promise.resolve()
function withSettingsLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = settingsMutationQueue.then(() => fn())
  // Swallow rejections in the chain itself so one failed mutation doesn't
  // poison every subsequent one. Callers still see the rejection on `next`.
  settingsMutationQueue = next.catch(() => undefined)
  return next
}

function defaultEnterpriseConfig(): EnterpriseConfig {
  return {
    serverUrl: DEFAULT_WORKSPACE_SERVER_URL,
    tenantId: DEFAULT_ENTRA_TENANT_ID,
    clientId: DEFAULT_ENTRA_CLIENT_ID,
    apiScope: DEFAULT_ENTRA_API_SCOPE,
    authority: DEFAULT_ENTRA_AUTHORITY
  }
}

function effectiveEnterpriseConfig(settings: AppSettings): EnterpriseConfig {
  const defaults = defaultEnterpriseConfig()
  return {
    serverUrl: normalizeEnterpriseServerUrl(settings.enterprise?.serverUrl || defaults.serverUrl),
    tenantId: settings.enterprise?.tenantId || defaults.tenantId,
    clientId: settings.enterprise?.clientId || defaults.clientId,
    apiScope: settings.enterprise?.apiScope || defaults.apiScope,
    authority: (settings.enterprise?.authority || defaults.authority).replace(/\/+$/, '')
  }
}

function normalizeEnterpriseServerUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '')
}

function isLoopbackHost(hostname: string) {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

function isRemoteHttpEnterpriseUrl(rawUrl?: string) {
  if (!rawUrl) return false
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'http:' && !isLoopbackHost(url.hostname)
  } catch {
    return false
  }
}

function validateEnterpriseServerUrl(rawUrl: string): string {
  const normalized = normalizeEnterpriseServerUrl(rawUrl)
  if (!normalized) return ''
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error('Shared workspace server URL is invalid')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Shared workspace server must use HTTP or HTTPS')
  }
  return normalized
}

function tokenIsUsable(auth?: EnterpriseAuth) {
  return Boolean(auth?.accessToken && auth.expiresAt > Date.now() + 60_000)
}

function safeSettingsView(s: AppSettings) {
  const view: AppSettings & { warnings: string[] } = {
    enterprise: effectiveEnterpriseConfig(s),
    mcpServers: maskSensitiveMcpEnvForView(sanitizeMcpServerList(s.mcpServers)),
    warnings: settingsWarnings(s)
  }
  if (s.provider) {
    view.provider = {
      baseUrl: s.provider.baseUrl,
      model: s.provider.model,
      wireApi: s.provider.wireApi,
      apiKey: s.provider.apiKey ? s.provider.apiKey.slice(0, 4) + '••••' + s.provider.apiKey.slice(-4) : ''
    }
  }
  return view
}

function enterpriseStatus(settings = loadSettings()) {
  const auth = settings.enterpriseAuth
  const config = effectiveEnterpriseConfig(settings)
  return {
    configured: Boolean(config.serverUrl && config.clientId && config.tenantId),
    signedIn: tokenIsUsable(auth),
    account: auth
      ? {
          username: auth.username,
          name: auth.name,
          homeAccountId: auth.homeAccountId,
          expiresAt: auth.expiresAt
        }
      : null,
    config
  }
}

async function enterpriseRequest(path: string, init: RequestInit = {}) {
  const fetched = await enterpriseFetchResponse(path, init)
  if (!fetched.response) return fetched
  const response = fetched.response
  const bodyText = await response.text()
  let body: any = null
  try {
    body = bodyText ? JSON.parse(bodyText) : null
  } catch {
    body = { text: bodyText }
  }
  if (!response.ok) {
    if (response.status === 401) {
      // Surface 401 with a hint so the renderer can prompt re-login. We
      // don't try to silently refresh here because MSAL device-code flow
      // requires user interaction.
      return { ok: false, status: 401, error: body?.error ?? 'Shared workspace session expired. Please sign in again.', authExpired: true }
    }
    const error = [body?.error, body?.detail].filter(Boolean).join(': ')
    return { ok: false, status: response.status, error: error || bodyText }
  }
  return { ok: true, status: response.status, ...body }
}

async function enterpriseFetchResponse(path: string, init: RequestInit = {}) {
  const settings = loadSettings()
  const auth = settings.enterpriseAuth
  if (!tokenIsUsable(auth)) {
    return { ok: false, status: 401, error: 'Sign in to shared workspaces first.' }
  }
  const config = effectiveEnterpriseConfig(settings)
  let serverUrl: string
  try {
    serverUrl = validateEnterpriseServerUrl(config.serverUrl)
  } catch (err: any) {
    return { ok: false, status: 400, error: err?.message ?? String(err) }
  }
  if (!serverUrl) {
    return { ok: false, status: 400, error: 'Shared workspace server URL is not configured.' }
  }
  const response = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
      authorization: `Bearer ${auth!.accessToken}`
    }
  })
  return { response }
}

function resolveAllowedLocalPath(filePath: string) {
  const settings = loadSettings()
  const disablePathSafety = settings.permissionLevel === 'full'
  return resolveAllowedLocalPathRaw(
    WORKSPACE_ROOT,
    filePath,
    settings.recentWorkspaces || [],
    disablePathSafety
  )
}

function safePathSegment(value: string) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'unknown'
}

function sharedArtifactCacheDir(workspaceId?: string, sessionId?: string) {
  return join(
    app.getPath('downloads'),
    'zspark-shared-artifacts',
    safePathSegment(workspaceId ?? 'workspace'),
    safePathSegment(sessionId ?? 'session')
  )
}

function resolveAllowedSkillPath(filePath: string) {
  const requested = realpathSync(filePath)
  const skills = discoverLocalSkills(WORKSPACE_ROOT).skills
  const allowed = skills.some((skill) => {
    try {
      return realpathSync(skill.path) === requested
    } catch {
      return false
    }
  })
  if (!allowed) throw new Error('Skill file is not in the discovered Codex skill list')
  return requested
}

function resolveCodexBinary(): string {
  const dev = join(__dirname, '..', '..', '..', 'codex-rs', 'target', 'release',
    process.platform === 'win32' ? 'codex.exe' : 'codex')
  if (existsSync(dev)) return dev
  return join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex')
}

function normalizeProviderBaseUrl(rawBaseUrl: string): string {
  try {
    const url = new URL(rawBaseUrl.trim())
    let path = url.pathname.replace(/\/+$/, '')
    for (const suffix of PROVIDER_ENDPOINT_SUFFIXES) {
      if (path.endsWith(suffix)) {
        path = path.slice(0, -suffix.length).replace(/\/+$/, '')
        break
      }
    }
    url.pathname = path || '/'
    return url.toString().replace(/\/$/, '')
  } catch {
    return rawBaseUrl.trim().replace(/\/+$/, '')
  }
}

function workspaceRuntimeInfo() {
  const runtimeRoot = resolve(CODEX_RUNTIME_DEPS_DIR)
  const nodePath = resolve(CODEX_RUNTIME_NODE)
  const nodeModulesPath = resolve(CODEX_RUNTIME_NODE_MODULES)
  const pythonPath = resolve(CODEX_RUNTIME_PYTHON)
  // Reject any runtime path that escapes the cache root, so a malicious
  // symlink can't be used to silently prepend an attacker-controlled
  // directory to PATH.
  const runtimeRootReal = realpathIfExists(runtimeRoot)
  const nodePathReal = realpathIfExists(nodePath)
  const nodeModulesPathReal = realpathIfExists(nodeModulesPath)
  const pythonPathReal = realpathIfExists(pythonPath)
  const nodeInsideRoot = Boolean(
    runtimeRootReal &&
    nodePathReal &&
    nodeModulesPathReal &&
    isInsidePath(runtimeRootReal, nodePathReal) &&
    isInsidePath(runtimeRootReal, nodeModulesPathReal)
  )
  const pythonInsideRoot = Boolean(
    runtimeRootReal &&
    pythonPathReal &&
    isInsidePath(runtimeRootReal, pythonPathReal)
  )
  const nodeAvailable = nodeInsideRoot && existsSync(nodePath) && existsSync(nodeModulesPath)
  const pythonAvailable = pythonInsideRoot && existsSync(pythonPath)
  return {
    nodePath: nodePathReal ?? nodePath,
    nodeModulesPath: nodeModulesPathReal ?? nodeModulesPath,
    pythonPath: pythonPathReal ?? pythonPath,
    available: nodeAvailable,
    nodeAvailable,
    pythonAvailable
  }
}

function realpathIfExists(path: string) {
  try {
    return realpathSync(path)
  } catch {
    return null
  }
}

function workspaceRuntimeEnv(): Record<string, string> {
  const rt = workspaceRuntimeInfo()
  if (!rt.nodeAvailable) return {}
  const env: Record<string, string> = {
    ZSPARK_CODEX_RUNTIME_NODE: rt.nodePath,
    ZSPARK_CODEX_RUNTIME_NODE_MODULES: rt.nodeModulesPath,
    NODE_PATH: [rt.nodeModulesPath, process.env.NODE_PATH].filter(Boolean).join(delimiter),
    PATH: `${dirname(rt.nodePath)}${delimiter}${process.env.PATH ?? ''}`
  }
  if (rt.pythonAvailable) {
    env.ZSPARK_CODEX_RUNTIME_PYTHON = rt.pythonPath
  }
  return env
}

function rotateLogIfLarge(path: string) {
  try {
    if (!existsSync(path) || statSync(path).size < MAX_CODEX_LOG_BYTES) return
    renameSync(path, `${path}.1`)
  } catch {
    // Diagnostics must never prevent the app-server from starting.
  }
}

function rewriteCodexLog(path: string, content: string) {
  const tmpPath = `${path}.${process.pid}.${Date.now().toString(36)}.${randomBytes(4).toString('hex')}.tmp`
  const fd = openSync(tmpPath, 'w', 0o600)
  try {
    writeFileSync(fd, content)
    try { fsyncSync(fd) } catch { /* fsync is best-effort on some FS */ }
  } finally {
    closeSync(fd)
  }
  renameSync(tmpPath, path)
}

function scrubExistingCodexLog(path: string) {
  try {
    if (!existsSync(path)) return
    const stat = statSync(path)
    if (stat.size > MAX_CODEX_LOG_BYTES) {
      rewriteCodexLog(path, '')
      return
    }
    const content = readFileSync(path, 'utf8')
    const redacted = redactSensitiveLogText(content)
    if (redacted !== content) rewriteCodexLog(path, redacted)
  } catch {
    // Log cleanup must never prevent the app-server from starting.
  }
}

function formatCodexLogChunk(channel: 'stdout' | 'stderr', chunk: string): string {
  return chunk.split(/\n/).map((line, index, lines) => {
    if (!line && index === lines.length - 1) return ''
    const trimmed = line.trim()
    if (trimmed) {
      try {
        const json = JSON.parse(trimmed)
        if (json?.method === 'item/agentMessage/delta') {
          const params = json.params ?? {}
          return `[${channel}] ${JSON.stringify({
            method: json.method,
            threadId: params.threadId,
            turnId: params.turnId,
            itemId: params.itemId,
            deltaChars: String(params.delta ?? '').length
          })}\n`
        }
      } catch {}
    }
    return `[${channel}] ${redactSensitiveLogLine(line)}\n`
  }).join('')
}

/**
 * Build `-c key=value` overrides that point codex at the user-configured
 * OpenAI-compatible endpoint, without touching ~/.codex/config.toml.
 *
 *   model_provider = "zspark"
 *   model = "<user model>"
 *   model_providers.zspark.name = "zspark"
 *   model_providers.zspark.base_url = "<user url>"
 *   model_providers.zspark.wire_api = "responses"
 *   model_providers.zspark.env_key = "ZSPARK_API_KEY"
 *
 * The api key itself is passed via env var, never on argv.
 * Chat-completions providers are exposed to codex through the local
 * Chat→Responses bridge, so codex still talks Responses on its side.
 *
 * We also disable the bundled computer-use / playwright MCP servers and
 * trust the zspark workspace so the chat doesn't get spammed by config
 * warnings or MCP startup failures (those bundled MCPs need optional
 * platform binaries that aren't relevant inside zspark). zspark opts into
 * Codex's native memory feature so persisted memory generation/use works
 * even though the upstream feature flag is experimental and off by default.
 */
function buildProviderArgs(p?: ProviderConfig): { args: string[]; env: Record<string, string> } {
  const tomlString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const settings = loadSettings()
  const mcpToml = buildMcpServersTomlValue(sanitizeMcpServerList(settings.mcpServers))
  
  const backendSandboxMode = 
    settings.permissionLevel === 'full' ? 'danger-full-access' : 
    settings.permissionLevel === 'auto' ? 'workspace-write' : 'workspace-write';

  const baseArgs = [
    // Trust our own workspace so codex stops nagging about project-local
    // config every spawn. The path is whatever directory the binary
    // happens to look at; trust the parent so any subfolder counts.
    '-c', `projects.${tomlString(WORKSPACE_ROOT)}.trust_level=${tomlString('trusted')}`,
    // 注入后端沙箱控制模式
    '-c', `sandbox_mode=${tomlString(backendSandboxMode)}`,
    // User-configured MCP servers, plus any built-in zspark MCP servers
    // (e.g. Gmail) that the user has enabled in Settings.
    '-c', `mcp_servers=${mcpToml}`,
    // Keep Codex native memories available in zspark. This only enables the
    // feature gate; [memories] use/generate settings still come from config.
    '-c', `features.memories=true`
  ]
  if (!p?.baseUrl || !p?.apiKey || !p?.model) return { args: baseArgs, env: {} }

  // Decide whether to point codex at the upstream directly (Responses
  // API) or at our in-process Chat→Responses bridge.
  let effectiveBase = normalizeProviderBaseUrl(p.baseUrl)
  let effectiveKey = p.apiKey
  if (p.wireApi === 'chat') {
    // Pass the *normalized* base to the bridge so suffix stripping +
    // query-string handling stays consistent with what we tell codex.
    setUpstream({ baseUrl: effectiveBase, apiKey: p.apiKey, mode: 'chat' })
    effectiveBase = `http://127.0.0.1:${bridgePort ?? 0}/v1`
    effectiveKey = BRIDGE_API_KEY
  } else {
    // Route Responses-API providers through the bridge in passthrough
    // mode. This keeps a single chokepoint for upstream traffic and —
    // more importantly — guarantees we forward `input[]` verbatim
    // (reasoning items included) so the Responses API never sees an
    // orphaned function_call across turns.
    setUpstream({ baseUrl: effectiveBase, apiKey: p.apiKey, mode: 'responses' })
    effectiveBase = `http://127.0.0.1:${bridgePort ?? 0}/v1`
    effectiveKey = BRIDGE_API_KEY
  }

  const args = [
    ...baseArgs,
    '-c', `model=${tomlString(p.model)}`,
    '-c', `model_provider=${tomlString('zspark')}`,
    '-c', `model_providers.zspark.name=${tomlString('zspark')}`,
    '-c', `model_providers.zspark.base_url=${tomlString(effectiveBase)}`,
    '-c', `model_providers.zspark.wire_api=${tomlString('responses')}`,
    '-c', `model_providers.zspark.env_key=${tomlString('ZSPARK_API_KEY')}`,
    '-c', `model_providers.zspark.requires_openai_auth=false`
  ]
  return { args, env: { ZSPARK_API_KEY: effectiveKey } }
}

function spawnCodex() {
  const bin = resolveCodexBinary()
  const settings = loadSettings()
  const { args: providerArgs, env: providerEnv } = buildProviderArgs(settings.provider)
  // Pipe a verbose, structured trace of the codex stdout/stderr stream to a
  // user-data log file so we can diagnose model wire-protocol issues without
  // turning on full RUST_LOG noise in the chat UI.
  const logPath = join(app.getPath('userData'), 'codex-stream.log')
  mkdirSync(app.getPath('userData'), { recursive: true })
  scrubExistingCodexLog(logPath)
  scrubExistingCodexLog(`${logPath}.1`)
  rotateLogIfLarge(logPath)
  const logStream: WriteStream = createWriteStream(logPath, { flags: 'a' })
  logStream.write(`\n=== ${new Date().toISOString()} spawn args=${JSON.stringify(redactProcessArgsForLog(providerArgs))} ===\n`)
  let logStreamClosed = false
  const closeLogStream = (suffix: string) => {
    if (logStreamClosed) return
    logStreamClosed = true
    try { logStream.write(suffix) } catch {}
    try { logStream.end() } catch {}
  }
  const child = spawn(bin, [...providerArgs, 'app-server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: WORKSPACE_ROOT,
    env: { ...process.env, ...workspaceRuntimeEnv(), ...providerEnv, RUST_LOG: process.env.RUST_LOG ?? 'warn,codex_app_server=info' }
  })
  codex = child
  child.stdout.on('data', (b) => {
    if (codex !== child) return
    const s = b.toString()
    logStream.write(formatCodexLogChunk('stdout', s))
    safeSendToRenderer('codex:stdout', s)
  })
  child.stderr.on('data', (b) => {
    if (codex !== child) return
    const s = b.toString()
    logStream.write(formatCodexLogChunk('stderr', s))
    safeSendToRenderer('codex:stderr', s)
  })
  child.on('error', (err) => {
    // Spawn-time failure (ENOENT, EACCES, ...). The 'exit' handler may not
    // fire, so we have to release the log fd and notify the renderer here.
    closeLogStream(`[error] ${err?.message ?? String(err)}\n`)
    if (codex === child) {
      codex = null
      safeSendToRenderer('codex:exit', null)
    }
  })
  child.on('exit', (code) => {
    closeLogStream(`[exit] ${code}\n`)
    if (codex === child) {
      codex = null
      safeSendToRenderer('codex:exit', code)
    }
  })
  safeSendToRenderer('codex:spawned')
  return child
}

const CODEX_KILL_GRACE_MS = 4_000

async function killCodex(child: ChildProcessWithoutNullStreams | null): Promise<void> {
  if (!child || child.killed || child.exitCode !== null) return
  await new Promise<void>((resolveExit) => {
    let done = false
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null
    const finish = () => {
      if (done) return
      done = true
      if (forceKillTimer) clearTimeout(forceKillTimer)
      resolveExit()
    }
    child.once('exit', finish)
    child.once('error', finish)
    try { child.kill() } catch { finish(); return }
    forceKillTimer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch {}
      // SIGKILL guarantees an exit shortly; give the listener one more tick.
      setTimeout(finish, 250)
    }, CODEX_KILL_GRACE_MS)
  })
}

async function restartCodex() {
  const old = codex
  codex = null
  await killCodex(old)
  spawnCodex()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'zspark',
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url).catch(() => {})
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL()
    if (!currentUrl || url === currentUrl) return
    event.preventDefault()
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      openExternalUrl(url).catch(() => {})
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'))
  }
}

ipcMain.handle('codex:send', (_e, line: string) => {
  if (!codex || codex.killed || !codex.stdin.writable) return false
  codex.stdin.write(line.endsWith('\n') ? line : line + '\n')
  return true
})

ipcMain.handle('codex:restart', async () => {
  await restartCodex()
  return true
})

ipcMain.handle('settings:get', () => {
  const s = loadSettings()
  // Return a redacted view to the renderer.
  return safeSettingsView(s)
})

ipcMain.handle('settings:save', (_e, partial: AppSettings) => withSettingsLock(async () => {
  // If the renderer sends back the masked key, keep the existing one.
  const cur = loadSettings()
  const next: AppSettings = { ...cur, ...partial }
  if (next.provider) {
    if (next.provider.apiKey?.includes('••••') && cur.provider?.apiKey) {
      next.provider.apiKey = cur.provider.apiKey
    }
  }
  if (Array.isArray((partial as any).mcpServers)) {
    next.mcpServers = sanitizeMcpServerList(mergeMaskedMcpEnv(
      sanitizeMcpServerList(cur.mcpServers),
      sanitizeMcpServerList(partial.mcpServers)
    ))
  }
  if (next.enterprise) {
    next.enterprise = {
      ...effectiveEnterpriseConfig(cur),
      ...next.enterprise
    }
    try {
      next.enterprise.serverUrl = validateEnterpriseServerUrl(next.enterprise.serverUrl ?? '')
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err), warnings: settingsWarnings(cur) }
    }
  }
  saveSettings(next)
  if (partial.provider || Array.isArray((partial as any).mcpServers) || partial.permissionLevel !== undefined) {
    // Restart codex so the provider / MCP-server / permissionLevel change takes effect
    // immediately, but wait for the old child to exit so the next spawn
    // doesn't race a still-alive process for stdin / log fd.
    await restartCodex()
  }
  return { ok: true, warnings: settingsWarnings(next) }
}))

ipcMain.handle('enterprise:status', () => enterpriseStatus())

ipcMain.handle('enterprise:logout', () => withSettingsLock(() => {
  const settings = loadSettings()
  const next = { ...settings, enterpriseAuth: undefined }
  saveSettings(next)
  return enterpriseStatus(next)
}))

ipcMain.handle('enterprise:login', async () => withSettingsLock(async () => {
  try {
    const settings = loadSettings()
    const config = effectiveEnterpriseConfig(settings)
    try {
      validateEnterpriseServerUrl(config.serverUrl)
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) }
    }
    if (!config.serverUrl || !config.tenantId || !config.clientId || !config.apiScope || !config.authority) {
      return { ok: false, error: 'Shared workspace Entra configuration is incomplete. Open Settings and fill Server URL, Tenant ID, Client ID, API Scope, and Authority.' }
    }
    settings.enterprise = config
    saveSettings(settings)

    const msalApp = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: config.authority,
        knownAuthorities: ['login.partner.microsoftonline.cn']
      }
    })
    const result = await msalApp.acquireTokenByDeviceCode({
      scopes: [config.apiScope],
      deviceCodeCallback: (response: any) => {
        safeSendToRenderer('enterprise:deviceCode', {
          userCode: response.userCode,
          verificationUri: response.verificationUri,
          expiresOn: response.expiresOn?.getTime?.() ?? null,
          message: response.message
        })
        if (response.verificationUri) {
          openExternalUrl(response.verificationUri).catch(() => {})
        }
      }
    })
    if (!result?.accessToken) {
      return { ok: false, error: 'Entra login did not return an access token.' }
    }

    const next = loadSettings()
    next.enterprise = config
    next.enterpriseAuth = {
      accessToken: result.accessToken,
      expiresAt: result.expiresOn?.getTime() ?? Date.now() + 3_600_000,
      username: result.account?.username,
      name: result.account?.name,
      homeAccountId: result.account?.homeAccountId
    }
    saveSettings(next)
    return { ok: true, status: enterpriseStatus(next) }
  } catch (err: any) {
    return {
      ok: false,
      error: formatEnterpriseLoginError(err),
      code: err?.errorCode ?? err?.code ?? null
    }
  }
}))

function formatEnterpriseLoginError(err: any) {
  const raw = [err?.errorMessage, err?.message, err?.subError].filter(Boolean).join(' ')
  if (/invalid_client|AADSTS7000218/i.test(raw)) {
    return 'Entra rejected zspark as a public desktop client. In Azure Portal, open zspark-desktop -> Authentication -> Advanced settings -> Allow public client flows -> Yes, then try signing in again.'
  }
  return raw || String(err)
}

ipcMain.handle('enterprise:whoami', () => enterpriseRequest('/auth/whoami'))

ipcMain.handle('enterprise:workspaces', () => enterpriseRequest('/workspaces'))

ipcMain.handle('enterprise:createWorkspace', (_e, name?: string) => (
  enterpriseRequest('/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name })
  })
))

ipcMain.handle('enterprise:sessions', (_e, workspaceId: string) => (
  enterpriseRequest(`/workspaces/${encodeURIComponent(workspaceId)}/sessions`)
))

ipcMain.handle('enterprise:createSession', (_e, workspaceId: string, body: any = {}) => (
  enterpriseRequest(`/workspaces/${encodeURIComponent(workspaceId)}/sessions`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
))

ipcMain.handle('enterprise:readSession', (_e, workspaceId: string, sessionId: string) => (
  enterpriseRequest(`/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`)
))

ipcMain.handle('enterprise:updateSession', (_e, workspaceId: string, sessionId: string, body: any = {}) => (
  enterpriseRequest(`/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  })
))

ipcMain.handle('enterprise:deleteSession', (_e, workspaceId: string, sessionId: string) => (
  enterpriseRequest(`/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE'
  })
))

ipcMain.handle('enterprise:artifacts', (_e, workspaceId: string, sessionId: string) => (
  enterpriseRequest(`/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/artifacts`)
))

ipcMain.handle('enterprise:uploadArtifact', (_e, workspaceId: string, sessionId: string, filePath: string, meta: any = {}) => {
  try {
    if (!filePath) return { ok: false, error: 'Missing file path' }
    const safePath = resolveAllowedLocalPath(filePath)
    if (!existsSync(safePath)) return { ok: false, error: 'File does not exist' }
    const stat = statSync(safePath)
    if (!stat.isFile()) return { ok: false, error: 'Path is not a file' }
    if (stat.size > MAX_ARTIFACT_UPLOAD_BYTES) {
      return { ok: false, error: `File exceeds the ${Math.round(MAX_ARTIFACT_UPLOAD_BYTES / (1024 * 1024))} MB upload limit` }
    }
    const content = readFileSync(safePath)
    return enterpriseRequest(`/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/artifacts`, {
      method: 'POST',
      body: JSON.stringify({
        name: meta.name || basename(safePath),
        mimeType: meta.mimeType || artifactMimeType(safePath),
        localPath: safePath,
        turnId: meta.turnId,
        contentBase64: content.toString('base64')
      })
    })
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('enterprise:downloadArtifact', async (_e, workspaceId: string, sessionId: string, artifactId: string, name?: string) => {
  try {
    const fetched = await enterpriseFetchResponse(
      `/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifactId)}/download`
    )
    if (!fetched.response) return fetched
    const response = fetched.response
    if (!response.ok) {
      const text = await response.text()
      return { ok: false, status: response.status, error: text || `Download failed with HTTP ${response.status}` }
    }
    const defaultName = name || contentDispositionFileName(response.headers.get('content-disposition')) || artifactId
    const save = mainWindow
      ? await dialog.showSaveDialog(mainWindow, { defaultPath: join(app.getPath('downloads'), basename(defaultName)) })
      : await dialog.showSaveDialog({ defaultPath: join(app.getPath('downloads'), basename(defaultName)) })
    if (save.canceled || !save.filePath) return { ok: false, canceled: true }
    if (!response.body) return { ok: false, error: 'Download response did not include a body' }
    await pipeline(Readable.fromWeb(response.body as any), createWriteStream(save.filePath))
    return { ok: true, path: save.filePath }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('enterprise:downloadArtifactToCache', async (_e, workspaceId: string, sessionId: string, artifactId: string, name?: string) => {
  try {
    const fetched = await enterpriseFetchResponse(
      `/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifactId)}/download`
    )
    if (!fetched.response) return fetched
    const response = fetched.response
    if (!response.ok) {
      const text = await response.text()
      return { ok: false, status: response.status, error: text || `Download failed with HTTP ${response.status}` }
    }
    if (!response.body) return { ok: false, error: 'Download response did not include a body' }
    const defaultName = name || contentDispositionFileName(response.headers.get('content-disposition')) || artifactId
    const dir = sharedArtifactCacheDir(workspaceId, sessionId)
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, basename(defaultName))
    await pipeline(Readable.fromWeb(response.body as any), createWriteStream(filePath))
    return { ok: true, path: filePath }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('enterprise:openArtifactCache', async (_e, workspaceId?: string, sessionId?: string) => {
  try {
    const dir = sharedArtifactCacheDir(workspaceId, sessionId)
    mkdirSync(dir, { recursive: true })
    const error = await shell.openPath(dir)
    return error ? { ok: false, error } : { ok: true, path: dir }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('attachments:pick', async () => {
  const options: OpenDialogOptions = {
    title: 'Attach files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Supported files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'pdf', 'txt', 'md', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'] },
      { name: 'All files', extensions: ['*'] }
    ]
  }
  const picked = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options)
  if (picked.canceled || picked.filePaths.length === 0) {
    return { attachments: [], errors: [] }
  }
  return importAttachmentFiles(picked.filePaths, WORKSPACE_ROOT)
})

ipcMain.handle('attachments:saveBase64', async (_e, { base64, name, mime }: { base64: string; name: string; mime: string }) => {
  try {
    const attachmentsDir = ATTACHMENTS_DIR
    mkdirSync(attachmentsDir, { recursive: true })
    writeFileSync(join(attachmentsDir, '.gitignore'), '*\n!.gitignore\n')

    const buffer = Buffer.from(base64, 'base64')
    const safeName = sanitizeAttachmentName(name)
    const targetPath = join(attachmentsDir, `${Date.now()}-${randomBytes(4).toString('hex')}-${safeName}`)

    writeFileSync(targetPath, buffer)

    return {
      attachment: {
        name: safeName,
        path: targetPath,
        mime,
        kind: attachmentKindForMime(mime),
        size: buffer.length
      },
      error: null
    }
  } catch (err: any) {
    return {
      attachment: null,
      error: err?.message ?? String(err)
    }
  }
})

function getGitBranch(): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: WORKSPACE_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    }).trim()
    return branch
  } catch {
    return ''
  }
}

interface SlashCommandInfo {
  command: string
  description: string
  argumentHint?: string
}

function getSlashCommandRsPath(): string {
  let path = join(WORKSPACE_ROOT, 'codex-rs', 'tui', 'src', 'slash_command.rs')
  if (existsSync(path)) return path

  path = join(__dirname, '..', '..', '..', 'codex-rs', 'tui', 'src', 'slash_command.rs')
  if (existsSync(path)) return path

  path = join(process.cwd(), 'codex-rs', 'tui', 'src', 'slash_command.rs')
  if (existsSync(path)) return path

  return ''
}

function extractBraceContent(str: string, startIndex: number): string {
  const braceIndex = str.indexOf('{', startIndex)
  if (braceIndex === -1) {
    return ''
  }
  
  let depth = 0
  let inString = false
  let inChar = false
  let inComment: 'single' | 'multi' | false = false
  
  for (let i = braceIndex; i < str.length; i++) {
    const char = str[i]
    const prevChar = i > 0 ? str[i - 1] : ''
    const nextChar = i + 1 < str.length ? str[i + 1] : ''
    const isEscaped = prevChar === '\\' && (i < 2 || str[i - 2] !== '\\')
    
    if (inComment) {
      if (char === '\n' && inComment === 'single') {
        inComment = false
      } else if (char === '/' && prevChar === '*' && inComment === 'multi') {
        inComment = false
      }
      continue
    }
    
    if (inChar) {
      if (char === "'" && !isEscaped) {
        inChar = false
      }
      continue
    }
    
    if (inString) {
      if (char === '"' && !isEscaped) {
        inString = false
      }
      continue
    }
    
    if (char === '/' && nextChar === '/') {
      inComment = 'single'
      i++
      continue
    }
    if (char === '/' && nextChar === '*') {
      inComment = 'multi'
      i++
      continue
    }
    
    if (char === "'" && !isEscaped) {
      inChar = true
      continue
    }
    if (char === '"' && !isEscaped) {
      inString = true
      continue
    }
    
    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return str.substring(braceIndex + 1, i)
      }
    }
  }
  return ''
}

const FALLBACK_SLASH_COMMANDS: SlashCommandInfo[] = [
  { command: 'model', description: 'choose what model and reasoning effort to use' },
  { command: 'ide', description: 'include current selection, open files, and other context from your IDE', argumentHint: ' <参数>' },
  { command: 'permissions', description: 'choose what Codex is allowed to do' },
  { command: 'skills', description: 'use skills to improve how Codex performs specific tasks' },
  { command: 'plan', description: 'switch to Plan mode' },
  { command: 'goal', description: 'set or view the goal for a long-running task', argumentHint: ' <参数>' },
  { command: 'clear', description: 'clear the terminal and start a new chat' },
  { command: 'quit', description: 'exit Codex' }
]

function parseSlashCommands(filePath: string): SlashCommandInfo[] {
  try {
    if (!filePath || !existsSync(filePath)) {
      return []
    }
    const content = readFileSync(filePath, 'utf8')

    const enumIndex = content.indexOf('pub enum SlashCommand')
    if (enumIndex === -1) {
      return []
    }
    const enumContent = extractBraceContent(content, enumIndex)

    const descFuncIndex = content.indexOf('fn description')
    let descContent = ''
    if (descFuncIndex !== -1) {
      const matchSelfIndex = content.indexOf('match self', descFuncIndex)
      if (matchSelfIndex !== -1) {
        descContent = extractBraceContent(content, matchSelfIndex)
      }
    }

    const inlineMatch = content.match(/pub fn supports_inline_args[\s\S]*?matches!\(\s*self,\s*([\s\S]*?)\)/)
    const inlineContent = inlineMatch ? inlineMatch[1] : ''

    const inlineVariants = new Set<string>()
    if (inlineContent) {
      const variantMatches = inlineContent.match(/SlashCommand::(\w+)/g)
      if (variantMatches) {
        for (const m of variantMatches) {
          const v = m.replace('SlashCommand::', '').trim()
          inlineVariants.add(v)
        }
      }
    }

    const descMap = new Map<string, string>()
    if (descContent) {
      const armRegex = /SlashCommand::([A-Za-z0-9_|:\s\n]+)=>\s*/g
      let matchArr;
      while ((matchArr = armRegex.exec(descContent)) !== null) {
        const variantsPart = matchArr[1]
        const valueStartIndex = armRegex.lastIndex
        
        const variants = variantsPart.match(/[A-Za-z0-9]+/g)
        if (!variants) continue
        
        let descText = ''
        const firstChar = descContent[valueStartIndex]
        if (firstChar === '{') {
          const braceContent = extractBraceContent(descContent, valueStartIndex)
          const strMatch = braceContent.match(/"([\s\S]*?)"/)
          descText = strMatch ? strMatch[1] : ''
          const outerBraceEnd = descContent.indexOf('}', valueStartIndex)
          if (outerBraceEnd !== -1 && outerBraceEnd >= valueStartIndex) {
            armRegex.lastIndex = outerBraceEnd + 1
          } else {
            armRegex.lastIndex = descContent.indexOf('{', valueStartIndex) + 1 + braceContent.length + 1
          }
        } else if (firstChar === '"') {
          let strVal = ''
          let i = valueStartIndex + 1
          for (; i < descContent.length; i++) {
            if (descContent[i] === '"' && descContent[i - 1] !== '\\') {
              break
            }
            strVal += descContent[i]
          }
          descText = strVal
          armRegex.lastIndex = i + 1
        } else {
          const commaIndex = descContent.indexOf(',', valueStartIndex)
          if (commaIndex !== -1) {
            descText = descContent.substring(valueStartIndex, commaIndex).trim()
            armRegex.lastIndex = commaIndex + 1
          }
        }
        
        descText = descText.replace(/\s+/g, ' ').trim()
        
        for (const v of variants) {
          descMap.set(v.trim(), descText)
        }
      }
    }

    const cleanEnumContent = enumContent.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const variantRegex = /(?:#\[strum\(([^)]+)\)\]\s*)?\b([A-Z][A-Za-z0-9]+)\b/g
    const results: SlashCommandInfo[] = []
    let vMatch;
    while ((vMatch = variantRegex.exec(cleanEnumContent)) !== null) {
      const attr = vMatch[1] ? vMatch[1].trim() : ''
      const variantName = vMatch[2].trim()

      let commandWord = ''
      if (attr) {
        const toStringMatch = attr.match(/to_string\s*=\s*"([^"]+)"/)
        const serializeMatch = attr.match(/serialize\s*=\s*"([^"]+)"/)
        if (toStringMatch) {
          commandWord = toStringMatch[1]
        } else if (serializeMatch) {
          commandWord = serializeMatch[1]
        }
      }

      if (!commandWord) {
        commandWord = pascalToKebab(variantName)
      }

      const description = descMap.get(variantName) || ''
      const hasInlineArgs = inlineVariants.has(variantName)

      results.push({
        command: commandWord,
        description,
        argumentHint: hasInlineArgs ? ' <参数>' : undefined
      })
    }

    return results
  } catch (e) {
    console.error('Error parsing slash commands:', e)
    return []
  }
}

function pascalToKebab(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

ipcMain.handle('runtime:get', () => {
  const settings = loadSettings()
  return {
    workspaceRoot: WORKSPACE_ROOT,
    attachmentDir: ATTACHMENTS_DIR,
    codexRunning: Boolean(codex && !codex.killed),
    bridgePort,
    provider: settings.provider
      ? {
          baseUrl: normalizeProviderBaseUrl(settings.provider.baseUrl),
          model: settings.provider.model,
          wireApi: settings.provider.wireApi
        }
      : undefined,
    workspaceRuntime: workspaceRuntimeInfo(),
    recentWorkspaces: settings.recentWorkspaces || [],
    collapsedSections: settings.collapsedSections || {},
    gitBranch: getGitBranch()
  }
})

ipcMain.handle('slashCommands:get', () => {
  const rsFilePath = getSlashCommandRsPath()
  const parsed = parseSlashCommands(rsFilePath)
  if (parsed.length === 0) {
    return FALLBACK_SLASH_COMMANDS
  }
  return parsed
})

ipcMain.handle('skills:localAvailability', () => discoverLocalSkills(WORKSPACE_ROOT))

ipcMain.handle('path:open', async (_e, filePath: string) => {
  try {
    if (!filePath) return { ok: false, error: 'Missing file path' }
    const safePath = resolveAllowedLocalPath(filePath)
    ensureShellOpenAllowed(safePath)
    const error = await shell.openPath(safePath)
    return error ? { ok: false, error } : { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('skill:open', async (_e, filePath: string) => {
  try {
    if (!filePath) return { ok: false, error: 'Missing skill path' }
    const safePath = resolveAllowedSkillPath(filePath)
    ensureShellOpenAllowed(safePath)
    const error = await shell.openPath(safePath)
    return error ? { ok: false, error } : { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('path:reveal', (_e, filePath: string) => {
  try {
    if (!filePath) return { ok: false, error: 'Missing file path' }
    shell.showItemInFolder(resolveAllowedLocalPath(filePath))
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('path:download', async (_e, filePath: string) => {
  let safePath: string
  try {
    if (!filePath) return { ok: false, error: 'Missing file path' }
    safePath = resolveAllowedLocalPath(filePath)
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
  if (!existsSync(safePath)) return { ok: false, error: 'File does not exist' }
  const save = mainWindow
    ? await dialog.showSaveDialog(mainWindow, { defaultPath: join(app.getPath('downloads'), basename(safePath)) })
    : await dialog.showSaveDialog({ defaultPath: join(app.getPath('downloads'), basename(safePath)) })
  if (save.canceled || !save.filePath) return { ok: false, canceled: true }
  try {
    copyFileSync(safePath, save.filePath)
    return { ok: true, path: save.filePath }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('path:stat', (_e, filePath: string) => {
  if (!filePath) return { exists: false, error: 'Missing file path' }
  try {
    const safePath = resolveAllowedLocalPath(filePath)
    const stat = statSync(safePath)
    return {
      exists: true,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      size: stat.size,
      mtimeMs: stat.mtimeMs
    }
  } catch {
    return { exists: false, error: 'File is unavailable or outside the allowed zspark directories' }
  }
})

ipcMain.handle('url:openExternal', async (_e, rawUrl: string) => {
  try {
    await openExternalUrl(rawUrl)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('artifacts:scanRecent', (_e, options: { sinceMs?: number; limit?: number } = {}) => ({
  root: join(WORKSPACE_ROOT, 'outputs'),
  artifacts: scanRecentArtifacts(WORKSPACE_ROOT, {
    sinceMs: options.sinceMs,
    limit: options.limit
  })
}))

ipcMain.handle('workspace:pick', async () => {
  try {
    const options: OpenDialogOptions = {
      title: '选择工作目录',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '选择文件夹'
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths.length) {
      return { ok: true, canceled: true }
    }
    const selectedPath = result.filePaths[0]
    if (!existsSync(selectedPath)) {
      return { ok: false, error: '路径不存在' }
    }
    return { ok: true, path: selectedPath }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
})

ipcMain.handle('workspace:switch', async (_e, newPath: string) => {
  try {
    const validated = validateWorkspaceRoot(newPath)
    if (!validated) {
      return { ok: false, error: '路径无效或不是目录', requiresRestart: false }
    }

    const settings = loadSettings()
    const recentList = settings.recentWorkspaces || []
    const filtered = recentList.filter(p => p !== validated)
    const newRecent = [validated, ...filtered].slice(0, 10)

    const lastUsed = { ...settings.workspaceLastUsed }
    lastUsed[validated] = Date.now()

    const techStacks = { ...settings.workspaceTechStack }
    if (!techStacks[validated]) {
      techStacks[validated] = detectTechStack(validated)
    }

    const next: AppSettings = {
      ...settings,
      activeWorkspace: validated,
      recentWorkspaces: newRecent,
      workspaceLastUsed: lastUsed,
      workspaceTechStack: techStacks
    }
    saveSettings(next)

    updateWorkspaceRoot(validated)
    await restartCodex()

    return {
      ok: true,
      workspaceRoot: validated,
      attachmentDir: ATTACHMENTS_DIR,
      requiresRestart: true
    }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err), requiresRestart: false }
  }
})

ipcMain.handle('workspace:recent', () => {
  const settings = loadSettings()
  const recentPaths = settings.recentWorkspaces || []
  const techStacks = settings.workspaceTechStack || {}
  const lastUsed = settings.workspaceLastUsed || {}
  const active = WORKSPACE_ROOT

  return recentPaths.map(path => ({
    path,
    name: basename(path),
    techStack: techStacks[path] || detectTechStack(path),
    lastUsed: lastUsed[path],
    isActive: path === active
  }))
})

ipcMain.handle('workspace:detectTechStack', (_e, path: string) => {
  return detectTechStack(path)
})

ipcMain.handle('ides:detect', async (_event, forceRefresh: boolean) => {
  return await detectInstalledIDEs(forceRefresh)
})

ipcMain.handle('ides:open', async (_event, ide, projectPath) => {
  return await openInIDE(ide, projectPath)
})

app.whenReady().then(async () => {
  // Apply saved active workspace before spawning codex
  const settings = loadSettings()
  if (settings.activeWorkspace) {
    const validated = validateWorkspaceRoot(settings.activeWorkspace)
    if (validated) {
      updateWorkspaceRoot(validated)
    }
  }

  const b = await startBridge(BRIDGE_API_KEY)
  bridgePort = b.port
  bridgeClose = b.close
  spawnCodex()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  void killCodex(codex)
  bridgeClose?.()
  if (process.platform !== 'darwin') app.quit()
})
