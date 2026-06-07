import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Block, WorkspaceFile } from '../../appTypes'
import { shortPath } from '../../runtimeDisplay'
import { IconFile } from '../../icons'

type FilesBlock = Extract<Block, { type: 'files' }>

type Props = {
  block: FilesBlock
  onOpen: (file: WorkspaceFile) => void
  onDownload: (file: WorkspaceFile) => void
  onReveal: (file: WorkspaceFile) => void
}

export const FilesCard = React.memo(function FilesCard({ block, onOpen, onDownload, onReveal }: Props) {
  const { t } = useTranslation()
  return (
    <div className={`artifact-card${block.tone === 'warn' ? ' warn' : ''}`}>
      <div className="artifact-head">
        <div>
          <div className="artifact-title">{block.title}</div>
          <div className="artifact-sub">{block.subtitle ?? 'Generated in this turn'}</div>
        </div>
        <IconFile />
      </div>
      <div className="artifact-list">
        {block.files.map((file) => (
          <div className="artifact-row" key={file.path}>
            <div className="artifact-file">
              <span className={`file-status file-status-${file.status}`}>{file.status}</span>
              <button title={file.path} onClick={() => onOpen(file)} disabled={file.status === 'missing'}>{file.name}</button>
              <small title={file.path}>{file.sharedArtifact ? t('nav.sharedArtifact') : shortPath(file.path)}</small>
            </div>
            <div className="artifact-actions">
              <button className="primary" onClick={() => onDownload(file)} disabled={file.status === 'missing'}>Download</button>
              <button onClick={() => onOpen(file)} disabled={file.status === 'missing'}>{file.sharedArtifact ? 'Save' : 'Open'}</button>
              <button onClick={() => onReveal(file)} disabled={file.status === 'missing' || Boolean(file.sharedArtifact)}>Reveal</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
