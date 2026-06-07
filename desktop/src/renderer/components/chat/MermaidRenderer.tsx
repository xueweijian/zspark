import { useEffect, useRef, useState } from 'react'

type Props = {
  code: string
}

export function MermaidRenderer({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily: 'var(--font-mono, monospace)',
        })
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
        const { svg: renderedSvg } = await mermaid.render(id, code)
        if (!cancelled) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Failed to render diagram')
          setSvg(null)
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [code])

  if (error) {
    return (
      <div style={{
        padding: 16,
        borderRadius: 8,
        border: '1px solid var(--border, #333)',
        background: 'var(--code-bg, #1a1a2e)',
        color: 'var(--muted, #888)',
        fontSize: 12,
        whiteSpace: 'pre-wrap',
        fontFamily: 'var(--font-mono, monospace)',
      }}>
        <div style={{ marginBottom: 8, color: '#f07178' }}>Mermaid Error</div>
        <div>{error}</div>
        <pre style={{ marginTop: 8, opacity: 0.7 }}>{code}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        borderRadius: 8,
        border: '1px solid var(--border, #333)',
        background: 'var(--code-bg, #1a1a2e)',
        color: 'var(--muted, #888)',
        fontSize: 11,
      }}>
        Rendering diagram...
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram"
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 8,
        border: '1px solid var(--border, #333)',
        background: 'var(--code-bg, #1a1a2e)',
        overflow: 'auto',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
