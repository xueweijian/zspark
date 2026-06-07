import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useComposerStore } from '../../store/composerStore'
import {
  IconClose, IconSkills, IconFile, IconShield, IconChevron, IconCheck
} from '../../icons'
import { fmtBytes } from '../../appHelpers'
import { ComposerDropOverlay } from './ComposerDropOverlay'

type Props = {
  ready: boolean
  streaming: boolean
  composerBusy: boolean
  hasComposerContent: boolean
  filteredSlashCommands: any[]
  filteredSkills: any[]
  runtimeProvider?: string
  gitBranch?: string
  tokenUsage: any
  permissionLevel: 'default' | 'auto' | 'full'
  showPermissionMenu: boolean
  taRef: React.RefObject<HTMLTextAreaElement>
  onSubmit: () => void
  onStop: () => void
  onPickAttachments: () => void
  onRemoveAttachment: (id: string) => void
  onRemoveSkill: (path?: string) => void
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onExecuteSlashCommand: (cmd: any) => void
  onExecuteSkillSuggestion: (skill: any) => void
  onChangePermissionLevel: (level: 'default' | 'auto' | 'full') => void
  onTogglePermissionMenu: () => void
  getAttachmentPreviewUrl: (a: any) => string
  onFilesDropped?: (files: File[]) => void
}

export function ChatInput({
  ready,
  streaming,
  composerBusy,
  hasComposerContent,
  filteredSlashCommands,
  filteredSkills,
  runtimeProvider,
  gitBranch,
  tokenUsage,
  permissionLevel,
  showPermissionMenu,
  taRef,
  onSubmit,
  onStop,
  onPickAttachments,
  onRemoveAttachment,
  onRemoveSkill,
  onInputChange,
  onKeyDown,
  onPaste,
  onExecuteSlashCommand,
  onExecuteSkillSuggestion,
  onChangePermissionLevel,
  onTogglePermissionMenu,
  getAttachmentPreviewUrl,
  onFilesDropped
}: Props) {
  const { t } = useTranslation()
  const {
    input,
    attachments,
    selectedSkills,
    suggestionType,
    suggestionSelectedIndex,
    setZoomedImage
  } = useComposerStore()

  // IME composition state for CJK input
  const isComposing = useRef(false)
  const handleCompositionStart = () => { isComposing.current = true }
  const handleCompositionEnd = () => { isComposing.current = false }

  // Wrap onKeyDown to skip during IME composition
  const wrappedKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposing.current) return
    onKeyDown(e)
  }

  const content = (
    <div className="chat-input-wrap">
      {suggestionType === 'slash' && filteredSlashCommands.length > 0 && (
        <div className="slash-commands-menu glass-morphism">
          <div className="slash-commands-list">
            {filteredSlashCommands.map((cmd, idx) => (
              <div
                key={cmd.command}
                className={`slash-command-item ${idx === suggestionSelectedIndex ? 'active' : ''}`}
                onClick={() => onExecuteSlashCommand(cmd)}
              >
                <span className="command-name">/{cmd.command}</span>
                {cmd.argumentHint && <span className="command-hint">{t(`slash.${cmd.command}.hint`, { defaultValue: cmd.argumentHint })}</span>}
                <span className="command-desc">{t(`slash.${cmd.command}.desc`, { defaultValue: cmd.description })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestionType === 'skill' && filteredSkills.length > 0 && (
        <div className="skills-suggestions-menu glass-morphism">
          <div className="skills-suggestions-list">
            {filteredSkills.map((skill, idx) => (
              <div
                key={skill.path ?? skill.name}
                className={`skill-suggestion-item ${idx === suggestionSelectedIndex ? 'active' : ''}`}
                onClick={() => onExecuteSkillSuggestion(skill)}
              >
                <IconSkills />
                <span className="skill-name">{t(`skill.${skill.name}.name`, { defaultValue: skill.displayName ?? skill.name })}</span>
                <span className="skill-desc">{t(`skill.${skill.name}.desc`, { defaultValue: skill.shortDescription ?? skill.description })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`chat-input${composerBusy ? ' busy' : ''}`}>
        <div className="composer-input-row">
          <button
            className="attach-btn"
            onClick={onPickAttachments}
            disabled={!ready || composerBusy}
            aria-label="Attach files"
            title="Attach files"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          <div className="composer-input-center">
            {attachments.filter((a) => a.kind === 'image').length > 0 && (
              <div className="composer-image-previews">
                {attachments
                  .filter((a) => a.kind === 'image')
                  .map((a) => (
                    <div key={a.id} className="image-preview-card" title={a.name}>
                      <img
                        src={a.previewUrl || getAttachmentPreviewUrl(a)}
                        alt={a.name}
                        onClick={() => setZoomedImage(a)}
                      />
                      <button
                        className="remove-image-btn"
                        onClick={() => onRemoveAttachment(a.id)}
                        aria-label="Remove image"
                      >
                        <IconClose />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <textarea
              ref={taRef}
              rows={1}
              placeholder={composerBusy ? t('composer.busy') : ready ? t('composer.placeholder') : t('composer.connecting')}
              value={input}
              onChange={onInputChange}
              onKeyDown={wrappedKeyDown}
              onPaste={onPaste}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              disabled={!ready || composerBusy}
            />

            {(attachments.filter((a) => a.kind !== 'image').length > 0 || selectedSkills.length > 0) && (
              <div className="composer-chips">
                {selectedSkills.map((s) => (
                  <div key={s.path ?? s.name} className="composer-chip skill-chip" title={s.path}>
                    <IconSkills />
                    <span>{s.displayName ?? s.name}</span>
                    <button onClick={() => onRemoveSkill(s.path)} aria-label={`Remove ${s.name}`}><IconClose /></button>
                  </div>
                ))}
                {attachments
                  .filter((a) => a.kind !== 'image')
                  .map((a) => (
                    <div key={a.id} className="composer-chip" title={a.path}>
                      <IconFile />
                      <span>{a.name}</span>
                      <em>{fmtBytes(a.size)}</em>
                      <button onClick={() => onRemoveAttachment(a.id)} aria-label={`Remove ${a.name}`}><IconClose /></button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="composer-input-actions">
            {streaming ? (
              <button
                className="send-btn stop-mode"
                onClick={onStop}
                title="Stop"
                aria-label="Stop"
              >
                <span className="composer-action-stop-square" />
                <span className="composer-action-spinner" />
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={onSubmit}
                disabled={!ready || composerBusy || !hasComposerContent}
                aria-label="Send"
                title="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateY(-0.5px)' }}>
                  <path d="M12 5l6 6m-6-6L6 11m6-6v14" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="chat-status-capsules">
        <div className="capsules-left">
          <div className="model-status-container">
            <div className="status-capsule model-capsule" title={runtimeProvider ?? ''}>
              <span>{runtimeProvider || '—'}</span>
              {(() => {
                const activeTokenUsage = tokenUsage || {
                  modelContextWindow: 128000,
                  total: { totalTokens: 0, inputTokens: 0, outputTokens: 0 }
                }
                if (activeTokenUsage.modelContextWindow <= 0) return null
                const totalTokens = activeTokenUsage.total.totalTokens
                const maxTokens = activeTokenUsage.modelContextWindow
                const percent = Math.min(100, maxTokens > 0 ? Math.round((totalTokens / maxTokens) * 100) : 0)
                return (
                  <>
                    <div className="model-context-badge">
                      <span className="context-ring" style={{
                        background: `conic-gradient(#4f46e5 ${percent * 3.6}deg, #e2e8f0 0deg)`
                      }}>
                        <span className="context-ring-inner"></span>
                      </span>
                      <span className="context-percent">{percent}%</span>
                    </div>

                    <div className="context-dropdown-menu glass-morphism">
                      <div className="context-dropdown-header">
                        <div className="context-title">上下文使用情况</div>
                        <div className="context-percent-large">{percent}%</div>
                      </div>
                      <div className="context-dropdown-divider"></div>
                      <div className="context-dropdown-body">
                        <div className="context-info-row">
                          <span className="context-info-label">已使用</span>
                          <span className="context-info-value">{new Intl.NumberFormat().format(totalTokens)}</span>
                        </div>
                        <div className="context-info-row">
                          <span className="context-info-label">剩余</span>
                          <span className="context-info-value">{new Intl.NumberFormat().format(Math.max(0, maxTokens - totalTokens))}</span>
                        </div>
                        <div className="context-info-row">
                          <span className="context-info-label">总窗口大小</span>
                          <span className="context-info-value">{new Intl.NumberFormat().format(maxTokens)}</span>
                        </div>
                        <div className="context-dropdown-divider"></div>
                        <div className="context-info-row sub-tokens">
                          <span className="context-info-label">输入 Tokens (Input)</span>
                          <span className="context-info-value">{new Intl.NumberFormat().format(activeTokenUsage.total.inputTokens)}</span>
                        </div>
                        <div className="context-info-row sub-tokens">
                          <span className="context-info-label">输出 Tokens (Output)</span>
                          <span className="context-info-value">{new Intl.NumberFormat().format(activeTokenUsage.total.outputTokens)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          <div className="permission-selector-container">
            <button
              className={`status-capsule permission-capsule ${permissionLevel}`}
              onClick={onTogglePermissionMenu}
              disabled={!ready || composerBusy}
              title="点击切换安全与审批权限"
            >
              <IconShield />
              <span>{
                permissionLevel === 'full' ? t('permission.full') :
                permissionLevel === 'auto' ? t('permission.auto') : t('permission.default')
              }</span>
              <IconChevron />
            </button>

            {showPermissionMenu && (
              <div className="permission-dropdown-menu">
                <button
                  className={`permission-menu-item ${permissionLevel === 'default' ? 'active' : ''}`}
                  onClick={() => {
                    onChangePermissionLevel('default')
                    onTogglePermissionMenu()
                  }}
                >
                  <span className="dot default"></span>
                  <div className="menu-text">
                    <span className="title">{t('permission.default')}</span>
                    <span className="desc">{t('permission.defaultDesc')}</span>
                  </div>
                  {permissionLevel === 'default' && <IconCheck />}
                </button>
                <button
                  className={`permission-menu-item ${permissionLevel === 'auto' ? 'active' : ''}`}
                  onClick={() => {
                    onChangePermissionLevel('auto')
                    onTogglePermissionMenu()
                  }}
                >
                  <span className="dot auto"></span>
                  <div className="menu-text">
                    <span className="title">{t('permission.auto')}</span>
                    <span className="desc">{t('permission.autoDesc')}</span>
                  </div>
                  {permissionLevel === 'auto' && <IconCheck />}
                </button>
                <button
                  className={`permission-menu-item ${permissionLevel === 'full' ? 'active' : ''}`}
                  onClick={() => {
                    onChangePermissionLevel('full')
                    onTogglePermissionMenu()
                  }}
                >
                  <span className="dot full"></span>
                  <div className="menu-text">
                    <span className="title">{t('permission.full')}</span>
                    <span className="desc">{t('permission.fullDesc')}</span>
                  </div>
                  {permissionLevel === 'full' && <IconCheck />}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="capsules-right">
          {gitBranch && (
            <div className="status-capsule git-capsule" title={`Git Branch: ${gitBranch}`}>
              <svg className="git-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 15V9a4 4 0 0 0-4-4H9" />
                <line x1="6" y1="9" x2="6" y2="15" />
              </svg>
              <span>{gitBranch}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (onFilesDropped) {
    return <ComposerDropOverlay onFilesDropped={onFilesDropped}>{content}</ComposerDropOverlay>
  }
  return content
}
