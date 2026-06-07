import React, { useState, useEffect } from 'react'
import { fmtDuration } from '../appHelpers'

export function ActivityDuration({ startedAt, endedAt }: { startedAt: number; endedAt?: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (endedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [endedAt])
  return <>{fmtDuration((endedAt ?? now) - startedAt)}</>
}
