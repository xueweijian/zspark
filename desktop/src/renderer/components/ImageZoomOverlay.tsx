import React from 'react'
import { useComposerStore } from '../store/composerStore'
import { IconClose } from '../icons'
import { fmtBytes } from '../appHelpers'

export function ImageZoomOverlay() {
  const { zoomedImage, setZoomedImage, loadedPreviews } = useComposerStore()

  if (!zoomedImage) return null

  return (
    <div className="image-zoom-overlay" onClick={() => setZoomedImage(null)}>
      <div className="image-zoom-content" onClick={(e) => e.stopPropagation()}>
        <img
          src={zoomedImage.previewUrl || loadedPreviews[zoomedImage.id] || ''}
          alt={zoomedImage.name}
          onClick={() => setZoomedImage(null)}
        />
        <button className="image-zoom-close" onClick={() => setZoomedImage(null)} aria-label="Close zoom">
          <IconClose />
        </button>
        <div className="image-zoom-meta">
          <span>{zoomedImage.name} ({fmtBytes(zoomedImage.size)})</span>
        </div>
      </div>
    </div>
  )
}
