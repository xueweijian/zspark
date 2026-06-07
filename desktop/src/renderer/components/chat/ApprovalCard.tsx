import React from 'react'
import type { ApprovalRequest, ApprovalDecisionMode } from '../../appTypes'
import { approvalTopline, approvalStatusLabel } from '../../approvalHelpers'
import { shortPath } from '../../runtimeDisplay'
import { IconShield, IconTerminal, IconFile, IconTool } from '../../icons'
import { TerminalChrome } from './TerminalChrome'
import { DiffViewer } from './DiffViewer'

type Props = {
  request: ApprovalRequest
  onDecision: (request: ApprovalRequest, mode: ApprovalDecisionMode) => void
}

export function ApprovalCard({ request, onDecision }: Props) {
  const actionable = request.status === 'pending'
  const compact = !actionable
  const approvedAll = request.status === 'approvedAll'
  
  // Get icon based on approval kind
  const getIcon = () => {
    switch (request.kind) {
      case 'command':
        return <IconTerminal />
      case 'fileChange':
        return <IconFile />
      case 'permissions':
        return <IconShield />
      default:
        return <IconTool />
    }
  }
  
  // Render preview based on kind
  const renderPreview = () => {
    if (compact) return null
    
    if (request.kind === 'command' && request.commandPreview) {
      return (
        <div className="approval-preview">
          <TerminalChrome title="Command Preview">
            <pre>{request.commandPreview}</pre>
          </TerminalChrome>
        </div>
      )
    }
    
    if (request.kind === 'fileChange' && request.paths.length > 0) {
      // Show diff preview for file changes
      const filePath = request.paths[0]
      const fileName = filePath.split('/').pop() || filePath
      return (
        <div className="approval-preview">
          <DiffViewer
            fileName={fileName}
            newCode={request.detail || request.description}
          />
        </div>
      )
    }
    
    return null
  }
  
  return (
    <div className={`approval-card approval-${request.status}${compact ? ' approval-compact' : ''}`}>
      <div className="approval-mark">{getIcon()}</div>
      <div className="approval-content">
        <div className="approval-topline">
          <span>{approvalTopline(request.status)}</span>
          <em>{approvalStatusLabel(request.status)}</em>
        </div>
        <div className="approval-title">{request.title}</div>
        {!compact && <div className="approval-desc">{request.description}</div>}
        {compact && approvedAll && <div className="approval-desc">Future actions in this run can continue without another prompt.</div>}
        {!compact && (request.reason || request.cwd || request.detail || request.commandPreview || request.paths.length > 0) && (
          <div className="approval-meta">
            {request.reason && <div><strong>Reason</strong><span>{request.reason}</span></div>}
            {request.cwd && <div><strong>Working folder</strong><span title={request.cwd}>{shortPath(request.cwd)}</span></div>}
            {request.detail && <div><strong>Details</strong><span>{request.detail}</span></div>}
            {request.paths.slice(0, 4).map((path) => (
              <div key={path}><strong>Path</strong><span title={path}>{shortPath(path)}</span></div>
            ))}
            {request.commandPreview && <div className="approval-command"><strong>Command</strong><span>{request.commandPreview}</span></div>}
          </div>
        )}
        {renderPreview()}
        {actionable && (
          <div className="approval-actions">
            <button className="approval-approve" onClick={() => onDecision(request, 'approve')}>Approve</button>
            <button className="approval-approve-all" onClick={() => onDecision(request, 'approveAll')}>Approve all</button>
            <button className="approval-deny" onClick={() => onDecision(request, 'deny')}>Deny</button>
          </div>
        )}
      </div>
    </div>
  )
}
