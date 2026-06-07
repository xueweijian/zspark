import React from 'react'
import type { Block } from '../../appTypes'
import { activitySummaryLabels } from '../../activityHelpers'
import { displayActivities } from '../../activityHelpers'
import { ToolCallBlock } from './ToolCallBlock'
import { ActivityDuration } from '../ActivityDuration'
import { IconChevron } from '../../icons'
import { ThinkingBlock } from './ThinkingBlock'

type TurnBlock = Extract<Block, { type: 'turn' }>

type Props = {
  block: TurnBlock
  onToggle: (turnId: string) => void
}

export const TurnCard = React.memo(function TurnCard({ block, onToggle }: Props) {
  const running = !block.endedAt
  const interrupted = block.status === 'interrupted'
  const failed = block.status === 'failed' || block.activities.some((a) => a.status === 'failed')
  const meaningful = block.activities.filter((a) => !(a.kind === 'reasoning' && a.id.startsWith('thinking-') && !a.detail))
  const summaryLabels = activitySummaryLabels(meaningful)
  const visibleActivities = displayActivities(block.activities)
  const stepsLabel = summaryLabels.length
    ? summaryLabels.slice(0, 2).join(' · ')
    : meaningful.length === 0
      ? (running ? 'waiting for activity' : (block.activities.some((a) => a.kind === 'reasoning' && a.detail) ? 'thought captured' : 'no tool activity'))
      : `${meaningful.length} step${meaningful.length === 1 ? '' : 's'}`

  return (
    <div className={`activity-card${block.collapsed ? ' collapsed' : ''}${running ? ' running' : ''}`}>
      <div className="activity-head" onClick={() => onToggle(block.turnId)}>
        <div className="head-left">
          <span className={`spinner${running ? ' spin' : ''}${failed ? ' failed' : ''}`} />
          <div className="head-copy">
            <div className="head-line">
              <span className="head-title">{running ? 'Working' : interrupted ? 'Stopped' : failed ? 'Needs attention' : 'Completed'}</span>
              <span className="head-meta">Activity log · <ActivityDuration startedAt={block.startedAt} endedAt={block.endedAt} /> · {stepsLabel}</span>
            </div>
          </div>
        </div>
        <button className="chev" aria-label="Toggle"><IconChevron /></button>
      </div>
      {!block.collapsed && (
        <div className="activity-body">
          {summaryLabels.length > 0 && (
            <div className="activity-summary" aria-label="Activity summary">
              {summaryLabels.map((label) => <span key={label} className="activity-pill">{label}</span>)}
            </div>
          )}
          {visibleActivities.length === 0 ? (
            <div className="empty-act">Preparing…</div>
          ) : visibleActivities.map((a) => {
            // Route reasoning activities with detail to ThinkingBlock
            if (a.kind === 'reasoning' && a.detail) {
              const isThinkingActive = a.status === 'running'
              return (
                <ThinkingBlock
                  key={a.id}
                  content={a.detail}
                  isActive={isThinkingActive}
                />
              )
            }
            // Route all other activities to ToolCallBlock (rich cards)
            const isPlaceholder = a.kind === 'reasoning' && a.id.startsWith('thinking-') && !a.detail && a.status === 'running'
            return (
              <ToolCallBlock key={a.id} activity={a} isPlaceholder={isPlaceholder} />
            )
          })}
        </div>
      )}
    </div>
  )
})
