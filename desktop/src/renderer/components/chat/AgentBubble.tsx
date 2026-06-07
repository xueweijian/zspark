import React from 'react'
import type { Block } from '../../appTypes'
import { Markdown } from '../Markdown'
import { MemoryCitationPill } from '../MemoryCitationPill'
import { MessageActions } from '../MessageActions'

type AgentBlock = Extract<Block, { type: 'agent' }>

type Props = {
  block: AgentBlock
  isStreaming: boolean
  artifactButtons?: React.ReactNode
  onCopy: (block: AgentBlock) => void
  onDelete: (block: AgentBlock) => void
  onRegenerate: (block: AgentBlock) => void
  disabled: boolean
}

export const AgentBubble = React.memo(function AgentBubble({ block, isStreaming, artifactButtons, onCopy, onDelete, onRegenerate, disabled }: Props) {
  return (
    <div className="message-wrap assistant">
      <div className={`bubble assistant${isStreaming ? ' streaming' : ''}`}>
        <Markdown text={block.text} />
        <MemoryCitationPill citation={block.memoryCitation} />
        {artifactButtons}
      </div>
      <MessageActions
        onCopy={() => onCopy(block)}
        onDelete={() => onDelete(block)}
        onRegenerate={() => onRegenerate(block)}
        disabled={disabled || isStreaming}
        copyDisabled={!block.text.trim()}
      />
    </div>
  )
})
