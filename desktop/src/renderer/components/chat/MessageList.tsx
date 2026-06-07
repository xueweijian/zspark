import React, { useMemo } from 'react'
import type { Block, WorkspaceFile, ApprovalRequest, ApprovalDecisionMode } from '../../appTypes'
import { EmptyState } from './EmptyState'
import { UserBubble } from './UserBubble'
import { AgentBubble } from './AgentBubble'
import { FilesCard } from './FilesCard'
import { ApprovalCard } from './ApprovalCard'
import { TurnCard } from './TurnCard'
import { StreamingIndicator } from './StreamingIndicator'
import { VirtualList, VirtualItemBlock } from './VirtualList'

type UserBlock = Extract<Block, { type: 'user' }>
type AgentBlock = Extract<Block, { type: 'agent' }>

type Props = {
  blocks: Block[]
  streaming: boolean
  streamingAgentId: string | null
  runtime: any
  workspaceFiles: WorkspaceFile[]
  composerBusy: boolean
  messageActionBusy: boolean
  onStarterClick: (text: string) => void
  onCopy: (block: Block) => void
  onDelete: (block: Block) => void
  onRegenerate: (block: Block) => void
  onOpenFile: (file: WorkspaceFile) => void
  onDownloadFile: (file: WorkspaceFile) => void
  onRevealFile: (file: WorkspaceFile) => void
  onApprovalDecision: (request: ApprovalRequest, mode: ApprovalDecisionMode) => void
  onToggleTurn: (turnId: string) => void
  renderArtifactButtons?: (block: AgentBlock) => React.ReactNode
}

export function MessageList({
  blocks,
  streaming,
  streamingAgentId,
  composerBusy,
  messageActionBusy,
  onStarterClick,
  onCopy,
  onDelete,
  onRegenerate,
  onOpenFile,
  onDownloadFile,
  onRevealFile,
  onApprovalDecision,
  onToggleTurn,
  renderArtifactButtons
}: Props) {
  if (blocks.length === 0) {
    return <EmptyState onStarterClick={onStarterClick} />
  }

  // Find the last turn block for streaming indicator
  const lastTurnBlock = streaming
    ? [...blocks].reverse().find((b) => b.type === 'turn' && !b.endedAt) as Extract<Block, { type: 'turn' }> | undefined
    : undefined

  // Check if virtual scrolling should be enabled
  // Trigger when: 120+ blocks OR 120000+ characters
  const shouldUseVirtualScroll = useMemo(() => {
    if (blocks.length >= 120) return true
    const totalChars = blocks.reduce((sum, b) => {
      if (b.type === 'user' || b.type === 'agent') {
        return sum + (b.text?.length || 0)
      }
      return sum
    }, 0)
    return totalChars >= 120000
  }, [blocks])

  // Prepare virtual items
  const virtualItems = useMemo(() => {
    return blocks.map((b) => ({
      id: b.id,
      height: 100, // Default height, will be measured
    }))
  }, [blocks])

  const renderBlock = (b: Block) => {
    if (b.type === 'user') {
      return (
        <UserBubble
          key={b.id}
          block={b}
          onCopy={(ub) => onCopy(ub)}
          onDelete={(ub) => onDelete(ub)}
          onRegenerate={(ub) => onRegenerate(ub)}
          disabled={composerBusy}
          messageActionBusy={messageActionBusy}
        />
      )
    }
    if (b.type === 'agent') {
      const isStreamingAgent = streaming && b.id === streamingAgentId
      return (
        <AgentBubble
          key={b.id}
          block={b}
          isStreaming={isStreamingAgent}
          artifactButtons={renderArtifactButtons?.(b)}
          onCopy={(ab) => onCopy(ab)}
          onDelete={(ab) => onDelete(ab)}
          onRegenerate={(ab) => onRegenerate(ab)}
          disabled={composerBusy || messageActionBusy}
        />
      )
    }
    if (b.type === 'files') {
      return (
        <FilesCard
          key={b.id}
          block={b}
          onOpen={onOpenFile}
          onDownload={onDownloadFile}
          onReveal={onRevealFile}
        />
      )
    }
    if (b.type === 'approval') {
      return (
        <ApprovalCard
          key={b.id}
          request={b.request}
          onDecision={onApprovalDecision}
        />
      )
    }
    // type === 'turn'
    return (
      <React.Fragment key={b.id}>
        <TurnCard
          block={b}
          onToggle={onToggleTurn}
        />
        {streaming && lastTurnBlock && b.id === lastTurnBlock.id && (
          <StreamingIndicator
            turn={lastTurnBlock}
            activities={lastTurnBlock.activities}
          />
        )}
      </React.Fragment>
    )
  }

  if (shouldUseVirtualScroll) {
    return (
      <VirtualList
        items={virtualItems}
        sessionId="current"
        className="message-list-virtual"
        style={{ height: '100%' }}
      >
        {(visibleItems) =>
          visibleItems.map(({ item, offset }) => {
            const block = blocks.find((b) => b.id === item.id)
            if (!block) return null
            return (
              <VirtualItemBlock key={item.id} itemId={item.id} style={{ position: 'absolute', top: offset, width: '100%' }}>
                {renderBlock(block)}
              </VirtualItemBlock>
            )
          })
        }
      </VirtualList>
    )
  }

  return (
    <>
      {blocks.map(renderBlock)}
    </>
  )
}
