import { useState, useCallback } from 'react'

type Props = {
  text: string
  className?: string
  label?: string
  copiedLabel?: string
}

export function CopyButton({ text, className, label = 'Copy', copiedLabel = 'Copied' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={className}
      title={copied ? copiedLabel : label}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}
