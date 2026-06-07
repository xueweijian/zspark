import React, { useState } from 'react'
import { IconCopy, IconRegenerate, IconTrash, IconCheck } from '../icons'

export function MessageActions({
  onCopy,
  onDelete,
  onRegenerate,
  disabled,
  copyDisabled
}: {
  onCopy: () => void
  onDelete: () => void
  onRegenerate: () => void
  disabled?: boolean
  copyDisabled?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="message-actions" aria-label="Message actions">
      <button
        className={`message-action${copied ? ' copied' : ''}`}
        onClick={handleCopy}
        disabled={copyDisabled || copied}
        aria-label={copied ? "Copied" : "Copy"}
        title={copied ? "Copied" : "Copy"}
        style={copied ? { color: '#10b981', borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' } : undefined}
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </button>
      <button className="message-action" onClick={onRegenerate} disabled={disabled} aria-label="Regenerate" title="Regenerate">
        <IconRegenerate />
      </button>
      <button className="message-action danger" onClick={onDelete} disabled={disabled} aria-label="Delete" title="Delete">
        <IconTrash />
      </button>
    </div>
  )
}
