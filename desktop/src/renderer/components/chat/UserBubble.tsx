import React from 'react'
import type { Block } from '../../appTypes'
import { stripInternalPromptContext } from '../../appHelpers'
import { MessageActions } from '../MessageActions'

type UserBlock = Extract<Block, { type: 'user' }>

type Props = {
  block: UserBlock
  onCopy: (block: UserBlock) => void
  onDelete: (block: UserBlock) => void
  onRegenerate: (block: UserBlock) => void
  disabled: boolean
  messageActionBusy: boolean
}

export const UserBubble = React.memo(function UserBubble({ block, onCopy, onDelete, onRegenerate, disabled, messageActionBusy }: Props) {
  const visibleText = stripInternalPromptContext(block.text)
  return (
    <div className="message-wrap user">
      <div className="bubble user">{visibleText}</div>
      <MessageActions
        onCopy={() => onCopy(block)}
        onDelete={() => onDelete(block)}
        onRegenerate={() => onRegenerate(block)}
        disabled={disabled || messageActionBusy}
        copyDisabled={!visibleText}
      />
    </div>
  )
})
