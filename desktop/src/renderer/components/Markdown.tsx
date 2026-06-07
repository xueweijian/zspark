import React from 'react'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'
import { normalizeMarkdownForDisplay } from '../markdown'

export function Markdown({ text }: { text: string }) {
  const normalized = normalizeMarkdownForDisplay(text || '')
  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as Element | null)?.closest?.('a[href]')
    const href = link?.getAttribute('href') ?? ''
    if (!link) return
    if (!/^(https?:|mailto:)/i.test(href)) {
      if (href && !/^(?:#|\/|\.{1,2}\/)/.test(href)) event.preventDefault()
      return
    }
    event.preventDefault()
    void window.zspark.openExternalUrl(href)
  }
  return <div className="md" onClick={onClick} onAuxClick={onClick}><MarkdownRenderer content={normalized} /></div>
}
