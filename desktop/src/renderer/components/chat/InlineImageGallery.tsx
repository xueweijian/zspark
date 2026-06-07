import React, { useState } from 'react'

type Props = {
  images: string[]
  maxDisplay?: number
}

export const InlineImageGallery = React.memo(function InlineImageGallery({ images, maxDisplay = 3 }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (images.length === 0) return null

  const displayImages = expanded ? images : images.slice(0, maxDisplay)
  const remaining = images.length - maxDisplay

  return (
    <div className="inline-image-gallery">
      <div className="gallery-grid">
        {displayImages.map((src, index) => (
          <div key={index} className="gallery-item" onClick={() => window.open(src, '_blank')}>
            <img src={src} alt={`Image ${index + 1}`} loading="lazy" />
          </div>
        ))}
        {!expanded && remaining > 0 && (
          <div className="gallery-more" onClick={() => setExpanded(true)}>
            +{remaining}
          </div>
        )}
      </div>
    </div>
  )
})
