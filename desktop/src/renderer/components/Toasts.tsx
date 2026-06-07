import React from 'react'
import { useUiStore } from '../store/uiStore'
import { IconClose } from '../icons'

export function Toasts() {
  const { toasts, setToasts } = useUiStore()
  const dismiss = (id: string) => setToasts((p) => p.filter((t) => t.id !== id))

  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="body">{t.text}</div>
          <button className="close" onClick={() => dismiss(t.id)} aria-label="Dismiss"><IconClose /></button>
        </div>
      ))}
    </div>
  )
}
