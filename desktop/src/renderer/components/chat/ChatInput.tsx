import React, { useRef } from 'react'
  import { useTranslation } from 'react-i18next'
  import { useComposerStore } from '../../store/composerStore'
  import {
    IconClose, IconSkills, IconFile
  } from '../../icons'
  import { fmtBytes } from '../../appHelpers'
  import { ComposerDropOverlay } from './ComposerDropOverlay'
  import { ComposerMetaBar } from './ComposerMetaBar'

type Props = {
  ready: boolean
  streaming: boolean
  composerBusy: boolean
  hasComposerContent: boolean
  filteredSlashCommands: any[]
  filteredSkills: any[]
  gitBranch?: string
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
  gitBranch,
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

      {/* MetaBar: Plan toggle + Model + Effort + Permission + Context ring */}
      <ComposerMetaBar />

      {/* Git branch capsule */}
      {gitBranch && (
        <div className="chat-status-capsules" style={{ justifyContent: 'flex-end', marginTop: '4px' }}>
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
        </div>
      )}
    </div>
  )

  if (onFilesDropped) {
    return <ComposerDropOverlay onFilesDropped={onFilesDropped}>{content}</ComposerDropOverlay>
  }
  return content
}
