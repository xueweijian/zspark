import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconClose } from '../icons'
import type {
  EnterpriseForm,
  McpServerStartupView,
  McpServerView,
  ProviderForm
} from '../appTypes'

export function newMcpDraft(): McpServerView {
  return {
    id: `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    command: '',
    args: [],
    env: {},
    enabled: true
  }
}

export const mcpStartupLabels: Record<string, string> = {
  starting: 'mcp.status.starting',
  ready: 'mcp.status.ready',
  failed: 'mcp.status.failed',
  cancelled: 'mcp.status.stopped'
}

export function McpServersEditor({
  servers,
  mcpStartup,
  onChange
}: {
  servers: McpServerView[]
  mcpStartup: Record<string, McpServerStartupView>
  onChange: (next: McpServerView[]) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<string | null>(null)
  const updateAt = (id: string, patch: Partial<McpServerView>) => {
    onChange(servers.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }
  const remove = (id: string) => onChange(servers.filter((s) => s.id !== id))
  const add = () => {
    const draft = newMcpDraft()
    onChange([...servers, draft])
    setEditing(draft.id)
  }
  return (
    <div className="mcp-list">
      {servers.length === 0 && <p className="modal-hint">No MCP servers configured yet. Add one to expose extra tools to the assistant.</p>}
      {servers.map((server) => {
        const open = editing === server.id
        const startup = server.name ? mcpStartup[server.name] : undefined
        return (
          <div key={server.id} className="mcp-row">
            <div className="mcp-row-head">
              <label className="mcp-toggle">
                <input
                  type="checkbox"
                  checked={server.enabled}
                  onChange={(e) => updateAt(server.id, { enabled: e.target.checked })}
                />
                <span className="mcp-server-name">{server.name || '(unnamed)'}</span>
                {startup && (
                  <span className={`mcp-status ${startup.status}`}>
                    {mcpStartupLabels[startup.status] ?? startup.status}
                  </span>
                )}
              </label>
              <div className="mcp-row-actions">
                <button className="ghost" onClick={() => setEditing(open ? null : server.id)}>{open ? 'Done' : 'Edit'}</button>
                <button className="ghost" onClick={() => setEditing(open ? null : server.id)}>{open ? t('mcp.done') : t('mcp.edit')}</button>
                <button className="ghost" onClick={() => remove(server.id)}>{t('mcp.delete')}</button>
              </div>
            </div>
            {startup?.error && <div className="mcp-error" role="status">{startup.error}</div>}
            {open && (
              <div className="mcp-row-body">
                <label>Name<input value={server.name} onChange={(e) => updateAt(server.id, { name: e.target.value })} placeholder="gmail" /></label>
                <label>{t('mcp.name')}<input value={server.name} onChange={(e) => updateAt(server.id, { name: e.target.value })} placeholder={t('mcp.namePlaceholder')} /></label>
                <label>{t('mcp.command')}<input value={server.command} onChange={(e) => updateAt(server.id, { command: e.target.value })} placeholder={t('mcp.commandPlaceholder')} /></label>
                <label>{t('mcp.args')}
                  <textarea
                    rows={3}
                    value={server.args.join('\n')}
                    onChange={(e) => updateAt(server.id, { args: e.target.value.split('\n').map((s) => s.trim()).filter((s) => s.length > 0) })}
                  />
                </label>
                <label>Env (KEY=VALUE per line)
                  <textarea
                    rows={3}
                    value={Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n')}
                    onChange={(e) => {
                      const env: Record<string, string> = {}
                      for (const line of e.target.value.split('\n')) {
                        const idx = line.indexOf('=')
                        if (idx <= 0) continue
                        const k = line.slice(0, idx).trim()
                        const v = line.slice(idx + 1)
                        if (k) env[k] = v
                      }
                      updateAt(server.id, { env })
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        )
      })}
      <button className="ghost mcp-add" onClick={add}>+ Add MCP server</button>
    </div>
  )
}

export function SettingsModal({
  mcpStartup,
  currentWorkspacePath,
  onPickWorkspace,
  workspaceBusy,
  onClose
}: {
  mcpStartup: Record<string, McpServerStartupView>
  currentWorkspacePath: string
  onPickWorkspace: () => void
  workspaceBusy: boolean
  onClose: () => void
}) {
  const { t, i18n: settingsI18n } = useTranslation()
  const [form, setForm] = useState<ProviderForm>({ baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', wireApi: 'responses' })
  const [enterprise, setEnterprise] = useState<EnterpriseForm>({
    serverUrl: '',
    tenantId: '',
    clientId: '',
    apiScope: '',
    authority: ''
  })
  const [mcpServers, setMcpServers] = useState<McpServerView[]>([])
  const [saving, setSaving] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const handlePickWorkspace = async () => {
    onPickWorkspace()
  }
  useEffect(() => {
    window.zspark.getSettings().then((s) => {
      if (s.provider) setForm((p) => ({ ...p, ...s.provider }))
      if (s.enterprise) setEnterprise((p) => ({ ...p, ...s.enterprise }))
      if (s.mcpServers) setMcpServers(s.mcpServers)
      setWarnings(s.warnings ?? [])
    })
  }, [])
  const save = async () => {
    setSaving(true)
    const result = await window.zspark.saveSettings({ provider: form, enterprise, mcpServers })
    setWarnings(result.warnings ?? [])
    setSaving(false)
    if (!result.ok) {
      setWarnings([result.error ?? 'Settings could not be saved', ...(result.warnings ?? [])])
      return
    }
    onClose()
  }
  return (
    <div className="modal-bg">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="modal-x" onClick={onClose} aria-label={t('common.close')}><IconClose /></button>
        </div>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
          <label style={{ fontSize: 13, color: 'var(--muted-strong)' }}>{t('settings.language')}</label>
          <select
            value={settingsI18n.language}
            onChange={(e) => settingsI18n.changeLanguage(e.target.value)}
            style={{ fontSize: 13, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="settings-group">
          <div>
            <h3>{t('workspace.local')}</h3>
            <p className="modal-hint">{t('workspace.current')}</p>
          </div>
          <div className="settings-workspace-current">
            <input value={currentWorkspacePath} readOnly />
            <button onClick={handlePickWorkspace} disabled={workspaceBusy}>{workspaceBusy ? '...' : t('workspace.selectDirectory')}</button>
          </div>
        </div>
        <div className="settings-group">
          <div>
            <h3>{t('settings.modelProvider')}</h3>
            <p className="modal-hint">{t('settings.modelProviderHint')}</p>
          </div>
          <label>{t('settings.baseUrl')}<input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} /></label>
          <label>{t('settings.apiKey')}<input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={t('settings.apiKeyPlaceholder')} /></label>
          <label>{t('settings.model')}<input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
          <label>{t('settings.wireApi')}
            <select value={form.wireApi} onChange={(e) => setForm({ ...form, wireApi: e.target.value as any })}>
              <option value="responses">Responses API</option>
              <option value="chat">{t('settings.wireApiChat')}</option>
            </select>
          </label>
          {warnings.length > 0 && (
            <div className="settings-warning" role="alert">
              {warnings.map((warning) => <div key={warning}>{warning}</div>)}
            </div>
          )}
        </div>
        <div className="settings-group">
          <div>
            <h3>MCP servers</h3>
            <p className="modal-hint">{t('settings.mcpHint')}</p>
          </div>
          <McpServersEditor servers={mcpServers} mcpStartup={mcpStartup} onChange={setMcpServers} />
        </div>
        <div className="settings-group">
          <div>
            <h3>Shared workspaces</h3>
            <p className="modal-hint">{t('settings.entraHint')}</p>
          </div>
          <label>Server URL<input value={enterprise.serverUrl} onChange={(e) => setEnterprise({ ...enterprise, serverUrl: e.target.value })} placeholder="https://zspark.your-corp.cn" /></label>
          <label>{t('settings.serverUrl')}<input value={enterprise.serverUrl} onChange={(e) => setEnterprise({ ...enterprise, serverUrl: e.target.value })} placeholder={t('settings.serverUrlPlaceholder')} /></label>
          <label>{t('settings.tenantId')}<input value={enterprise.tenantId} onChange={(e) => setEnterprise({ ...enterprise, tenantId: e.target.value })} /></label>
          <label>{t('settings.clientId')}<input value={enterprise.clientId} onChange={(e) => setEnterprise({ ...enterprise, clientId: e.target.value })} /></label>
          <label>{t('settings.apiScope')}<input value={enterprise.apiScope} onChange={(e) => setEnterprise({ ...enterprise, apiScope: e.target.value })} /></label>
          <label>{t('settings.authority')}<input value={enterprise.authority} onChange={(e) => setEnterprise({ ...enterprise, authority: e.target.value })} /></label>
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button onClick={save} disabled={saving || !form.apiKey || !form.baseUrl || !form.model}>{saving ? t('settings.saving') : t('settings.saveRestart')}</button>
        </div>
      </div>
    </div>
  )
}
