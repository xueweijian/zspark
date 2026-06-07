import React from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  onStarterClick: (text: string) => void
}

export function EmptyState({ onStarterClick }: Props) {
  const { t } = useTranslation()
  return (
    <div className="empty">
      <div className="h">{t('emptyState.heading')}</div>
      <div className="sub">{t('emptyState.subtitle')}</div>
      <div className="grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="card" key={i} onClick={() => onStarterClick(t(`emptyState.starter${i}Desc`))}>
            <div className="t">{t(`emptyState.starter${i}Title`)}</div>
            <div className="d">{t(`emptyState.starter${i}Desc`)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
