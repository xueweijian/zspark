import React from 'react'
import type { MemoryCitation } from '../appTypes'
import { memoryCitationTitle, memoryCitationDetail } from '../activityHelpers'
import { IconBrain } from '../icons'

export function MemoryCitationPill({ citation }: { citation?: MemoryCitation | null }) {
  if (!citation) return null
  const detail = memoryCitationDetail(citation)
  return (
    <div className="memory-citation" title={detail}>
      <IconBrain />
      <span>{memoryCitationTitle(citation)}</span>
    </div>
  )
}
