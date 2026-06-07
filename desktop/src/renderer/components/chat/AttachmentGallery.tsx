import React from 'react'
import type { TurnInputItem } from '../../appTypes'

type Props = {
  attachments: TurnInputItem[]
  onRemove?: (index: number) => void
}

export const AttachmentGallery = React.memo(function AttachmentGallery({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null

  return (
    <div className="attachment-gallery">
      {attachments.map((item, index) => {
        if (item.type === 'image' || item.type === 'localImage') {
          const src = item.type === 'image' ? item.url : item.path
          return (
            <div key={index} className="attachment-item attachment-image">
              <img src={src} alt={`Attachment ${index + 1}`} />
              {onRemove && (
                <button
                  className="attachment-remove"
                  onClick={() => onRemove(index)}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          )
        }

        if (item.type === 'skill' || item.type === 'mention') {
          return (
            <div key={index} className="attachment-item attachment-file">
              <span className="file-icon">{item.type === 'skill' ? '⚡' : '@'}</span>
              <span className="file-name" title={item.path}>{item.name}</span>
              {onRemove && (
                <button
                  className="attachment-remove"
                  onClick={() => onRemove(index)}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          )
        }

        return null
      })}
    </div>
  )
})
