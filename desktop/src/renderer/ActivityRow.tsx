import React, { useState } from 'react'
import type { Activity } from './appTypes'
import { fmtDuration } from './appHelpers'
import { publicActivityDetail } from './activityHelpers'
import {
  IconChevron,
  IconBrain,
  IconTerminal,
  IconFile,
  IconTool,
  IconGlobe
} from './icons'

interface ActivityRowProps {
  activity: Activity & { displayTitle: string; repeatCount: number }
  isPlaceholder: boolean
}

function getActIcon(k: Activity['kind']) {
  switch (k) {
    case 'reasoning': return <IconBrain />
    case 'command': return <IconTerminal />
    case 'file': return <IconFile />
    case 'tool': return <IconTool />
    case 'web': return <IconGlobe />
    case 'memory': return <IconBrain />
    default: return <IconTerminal />
  }
}

export function ActivityRow({ activity, isPlaceholder }: ActivityRowProps) {
  const [expanded, setExpanded] = useState(false)
  const rawDetail = activity.detail?.trim()
  const hasDetail = !!rawDetail
  const isCollapsible = activity.kind === 'command' || activity.kind === 'tool' || activity.kind === 'web'

  // 对于 reasoning 和 memory，依然沿用原有的 publicActivityDetail 渲染逻辑
  const defaultDetail = publicActivityDetail(activity)
  const showDetail = isCollapsible ? expanded : !!defaultDetail

  // 解析终端的命令和输出，进行极客风格的分行高亮
  const parseTerminalContent = (detailText: string) => {
    const parts = detailText.split('\n\n')
    let commandPart = ''
    let outputPart = ''

    if (parts.length > 1) {
      commandPart = parts[0].trim()
      outputPart = parts.slice(1).join('\n\n').trim()
    } else {
      const lineParts = detailText.split('\n')
      if (lineParts.length > 1) {
        commandPart = lineParts[0].trim()
        outputPart = lineParts.slice(1).join('\n').trim()
      } else {
        outputPart = detailText.trim()
      }
    }

    return { commandPart, outputPart }
  }

  const renderTerminal = (detailText: string) => {
    const { commandPart, outputPart } = parseTerminalContent(detailText)
    const isCommand = activity.kind === 'command'
    const statusText = activity.status === 'failed' ? '失败' : '成功'
    const statusClass = activity.status === 'failed' ? 'failed' : 'success'

    return (
      <div className="act-terminal">
        <div className="act-terminal-header">
          <div className="act-terminal-meta">
            <span className="act-terminal-icon">
              {activity.kind === 'command' ? <IconTerminal /> : activity.kind === 'tool' ? <IconTool /> : <IconGlobe />}
            </span>
            <span className="act-terminal-title">
              {activity.kind === 'command' ? 'Terminal' : activity.kind === 'tool' ? 'Tool Invocation' : 'Web Search'}
            </span>
          </div>
        </div>
        <div className="act-terminal-body">
          {commandPart && (
            <div className="act-terminal-line command">
              <span className="act-terminal-prompt">{isCommand ? '$ ' : '> '}</span>
              <span className="act-terminal-code">{commandPart}</span>
            </div>
          )}
          {outputPart && (
            <div className="act-terminal-line output">
              <pre className="act-terminal-pre">{outputPart}</pre>
            </div>
          )}
        </div>
        <div className={`act-terminal-footer ${statusClass}`}>
          <span className="act-terminal-status-icon">
            {activity.status === 'failed' ? '✗' : '✓'}
          </span>
          <span className="act-terminal-status-text">{statusText}</span>
        </div>
      </div>
    )
  }

  const handleRowClick = () => {
    if (isCollapsible && hasDetail) {
      setExpanded(!expanded)
    }
  }

  const collapsibleClass = isCollapsible && hasDetail ? 'act-collapsible' : ''
  const expandedClass = expanded ? 'act-expanded' : ''

  return (
    <div 
      className={`act act-${activity.kind} act-${activity.status} ${collapsibleClass} ${expandedClass}`}
      onClick={handleRowClick}
    >
      <div className="act-icon">{getActIcon(activity.kind)}</div>
      <div className="act-meat">
        <div className="act-title">
          {activity.displayTitle}
          {activity.repeatCount > 1 ? ` x${activity.repeatCount}` : ''}
          {isPlaceholder ? ' · waiting for first token' : ''}
          {isCollapsible && hasDetail && (
            <span className={`act-collapse-icon ${expanded ? 'open' : ''}`}>
              <IconChevron />
            </span>
          )}
        </div>
        {!isCollapsible && showDetail && defaultDetail && (
          <div className="act-detail">{defaultDetail}</div>
        )}
        {isCollapsible && showDetail && rawDetail && (
          <div className="act-expanded-body" onClick={(e) => e.stopPropagation()}>
            {renderTerminal(rawDetail)}
          </div>
        )}
        {activity.status === 'failed' && <div className="act-note">Needs attention</div>}
      </div>
      <div className="act-status">
        {activity.status === 'running' ? '· · ·' :
         activity.status === 'failed' ? 'failed' :
         activity.endedAt ? fmtDuration(activity.endedAt - activity.startedAt) : ''}
      </div>
    </div>
  )
}
