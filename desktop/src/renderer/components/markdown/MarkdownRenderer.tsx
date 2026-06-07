import { memo, useMemo } from 'react'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { marked, type Tokens } from 'marked'
import { CodeViewer } from '../chat/CodeViewer'
import { MermaidRenderer } from '../chat/MermaidRenderer'

type Props = {
  content: string
  streaming?: boolean
  className?: string
}

type CodeBlock = {
  id: string
  code: string
  language: string | undefined
}

type MathBlock = {
  id: string
  tex: string
  displayMode: boolean
}

type HtmlPart = { type: 'html'; content: string }
type CodePart = { type: 'code'; block: CodeBlock }
type MarkdownPart = HtmlPart | CodePart

const MERMAID_LANGUAGE = 'mermaid'
const PLAINTEXT_LANGUAGES = new Set(['', 'text', 'plaintext', 'plain'])
const MERMAID_DIAGRAM_START = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|requirementDiagram|quadrantChart|xychart-beta|sankey-beta|block-beta)\b/i
const CODE_FENCE_START = /^ {0,3}(`{3,}|~{3,})/
const MATH_RENDER_CACHE_LIMIT = 200
const mathRenderCache = new Map<string, string>()

function normalizeCodeLanguage(language: string | undefined): string | undefined {
  const normalized = language?.trim().split(/\s+/)[0]?.toLowerCase()
  return normalized || undefined
}

function looksLikeMermaid(code: string): boolean {
  const firstLine = code.split('\n').map((l) => l.trim()).find(Boolean)
  return firstLine ? MERMAID_DIAGRAM_START.test(firstLine) : false
}

function shouldRenderAsMermaid(block: CodeBlock): boolean {
  const lang = normalizeCodeLanguage(block.language)
  if (lang === MERMAID_LANGUAGE) return true
  if (!PLAINTEXT_LANGUAGES.has(lang ?? '')) return false
  return looksLikeMermaid(block.code)
}

// --- marked renderer with code block placeholders ---
const renderer = new marked.Renderer()
let pendingCodeBlocks: CodeBlock[] = []

renderer.code = function ({ text, lang }: Tokens.Code) {
  const id = `cb-${pendingCodeBlocks.length}`
  pendingCodeBlocks.push({ id, code: text, language: normalizeCodeLanguage(lang || undefined) })
  return `<div data-codeblock-id="${id}"></div>`
}

marked.setOptions({ breaks: true, gfm: true })
marked.use({ renderer })

// --- Math extraction ---
function findUnescapedDelimiter(text: string, delimiter: string, fromIndex: number): number {
  let index = text.indexOf(delimiter, fromIndex)
  while (index !== -1) {
    let backslashCount = 0
    for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) backslashCount++
    if (backslashCount % 2 === 0) return index
    index = text.indexOf(delimiter, index + delimiter.length)
  }
  return -1
}

function consumeMath(content: string, mathBlocks: MathBlock[], start: number, open: string, close: string, displayMode: boolean) {
  const contentStart = start + open.length
  const end = findUnescapedDelimiter(content, close, contentStart)
  if (end === -1) return null
  const tex = content.slice(contentStart, end)
  if (!tex.trim()) return null
  if (!displayMode && /[\n\r]/.test(tex)) return null
  if (open === '$' && (/\s/.test(content[contentStart] ?? '') || /\s/.test(content[end - 1] ?? ''))) return null
  const id = `math-${mathBlocks.length}`
  mathBlocks.push({ id, tex, displayMode })
  const tag = displayMode ? 'div' : 'span'
  const spacing = displayMode ? '\n\n' : ''
  return { replacement: `${spacing}<${tag} data-math-id="${id}"></${tag}>${spacing}`, end: end + close.length }
}

function extractMathFromSegment(segment: string, mathBlocks: MathBlock[]): string {
  let output = ''
  let index = 0
  while (index < segment.length) {
    if (segment[index] === '`') {
      const match = /^`+/.exec(segment.slice(index))
      const ticks = match?.[0] ?? '`'
      const end = segment.indexOf(ticks, index + ticks.length)
      if (end !== -1) { output += segment.slice(index, end + ticks.length); index = end + ticks.length; continue }
    }
    const displayDollar = segment.startsWith('$$', index) ? consumeMath(segment, mathBlocks, index, '$$', '$$', true) : null
    if (displayDollar) { output += displayDollar.replacement; index = displayDollar.end; continue }
    const displayBracket = segment.startsWith('\\[', index) ? consumeMath(segment, mathBlocks, index, '\\[', '\\]', true) : null
    if (displayBracket) { output += displayBracket.replacement; index = displayBracket.end; continue }
    const inlineParen = segment.startsWith('\\(', index) ? consumeMath(segment, mathBlocks, index, '\\(', '\\)', false) : null
    if (inlineParen) { output += inlineParen.replacement; index = inlineParen.end; continue }
    const inlineDollar = segment[index] === '$' && segment[index + 1] !== '$' ? consumeMath(segment, mathBlocks, index, '$', '$', false) : null
    if (inlineDollar) { output += inlineDollar.replacement; index = inlineDollar.end; continue }
    output += segment[index]
    index++
  }
  return output
}

function extractMath(content: string): { markdown: string; mathBlocks: MathBlock[] } {
  const mathBlocks: MathBlock[] = []
  const lines = content.match(/[^\n]*\n|[^\n]+/g) ?? ['']
  let output = ''
  let pendingMarkdown = ''
  let inFence: string | null = null
  const flush = () => { if (pendingMarkdown) { output += extractMathFromSegment(pendingMarkdown, mathBlocks); pendingMarkdown = '' } }
  for (const line of lines) {
    const fenceMatch = CODE_FENCE_START.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!.charAt(0)
      if (!inFence) { flush(); inFence = marker } else if (inFence === marker) { inFence = null }
      output += line; continue
    }
    if (inFence) { output += line } else { pendingMarkdown += line }
  }
  flush()
  return { markdown: output, mathBlocks }
}

function renderMath(block: MathBlock): string {
  const cacheKey = `${block.displayMode ? 'block' : 'inline'}\0${block.tex}`
  const cached = mathRenderCache.get(cacheKey)
  if (cached) return cached
  try {
    const rendered = katex.renderToString(block.tex, { displayMode: block.displayMode, output: 'html', throwOnError: false, strict: false })
    mathRenderCache.set(cacheKey, rendered)
    if (mathRenderCache.size > MATH_RENDER_CACHE_LIMIT) { const first = mathRenderCache.keys().next().value; if (first) mathRenderCache.delete(first) }
    return rendered
  } catch {
    return DOMPurify.sanitize(block.tex)
  }
}

function enhanceMarkdownHtml(html: string, mathBlocks: MathBlock[]): string {
  const cleanHtml = DOMPurify.sanitize(html, { ADD_TAGS: ['use'], ADD_ATTR: ['xlink:href'] })
  if (mathBlocks.length === 0 && !/<(?:a|table)\b/i.test(cleanHtml)) return cleanHtml
  if (typeof document === 'undefined') return cleanHtml

  const container = document.createElement('div')
  container.innerHTML = cleanHtml
  const mathById = new Map(mathBlocks.map((b) => [b.id, b]))

  container.querySelectorAll<HTMLElement>('[data-math-id]').forEach((placeholder) => {
    const block = mathById.get(placeholder.dataset.mathId ?? '')
    if (!block) return
    const rendered = document.createElement(block.displayMode ? 'div' : 'span')
    rendered.className = block.displayMode ? 'md-math-display' : 'md-math-inline'
    rendered.innerHTML = renderMath(block)
    placeholder.replaceWith(rendered)
  })

  container.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('md-table-wrap')) return
    const wrapper = document.createElement('div')
    wrapper.className = 'md-table-wrap'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })

  container.querySelectorAll('a[href]').forEach((link) => {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noreferrer noopener')
  })

  return container.innerHTML
}

function parseMarkdown(content: string): { html: string; codeBlocks: CodeBlock[]; mathBlocks: MathBlock[] } {
  pendingCodeBlocks = []
  const { markdown, mathBlocks } = extractMath(content)
  const html = marked.parse(markdown) as string
  const codeBlocks = [...pendingCodeBlocks]
  pendingCodeBlocks = []
  return { html, codeBlocks, mathBlocks }
}

// --- Cache ---
type CacheEntry = { parsed: ReturnType<typeof parseMarkdown>; chars: number }
const FINALIZED_CACHE_MAX = 200
const STREAMING_CACHE_MAX = 4
const finalizedCache = new Map<string, CacheEntry>()
const streamingCache = new Map<string, CacheEntry>()
let finalizedChars = 0

function fnv1a(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function cacheKey(content: string) { return `${content.length}:${fnv1a(content).toString(36)}` }

function getCachedParse(content: string, streaming: boolean): ReturnType<typeof parseMarkdown> {
  const cache = streaming ? streamingCache : finalizedCache
  const key = cacheKey(content)
  const cached = cache.get(key)
  if (cached) { cache.delete(key); cache.set(key, cached); return cached.parsed }
  const parsed = parseMarkdown(content)
  const entry: CacheEntry = { parsed, chars: content.length }
  cache.set(key, entry)
  if (streaming) { while (streamingCache.size > STREAMING_CACHE_MAX) { const oldest = streamingCache.keys().next().value; if (oldest) streamingCache.delete(oldest) } }
  else { finalizedChars += content.length; while (finalizedCache.size > FINALIZED_CACHE_MAX || finalizedChars > 8_000_000) { const oldest = finalizedCache.keys().next().value; if (!oldest) break; const e = finalizedCache.get(oldest); finalizedCache.delete(oldest); if (e) finalizedChars -= e.chars } }
  return parsed
}

// --- Component ---
export const MarkdownRenderer = memo(function MarkdownRenderer({ content, streaming = false, className }: Props) {
  const { html, codeBlocks, mathBlocks } = useMemo(
    () => getCachedParse(content, streaming),
    [content, streaming]
  )

  const parts = useMemo(() => {
    if (codeBlocks.length === 0) return [{ type: 'html' as const, content: enhanceMarkdownHtml(html, mathBlocks) }]
    const result: MarkdownPart[] = []
    let remaining = html
    for (const block of codeBlocks) {
      const marker = `<div data-codeblock-id="${block.id}"></div>`
      const idx = remaining.indexOf(marker)
      if (idx === -1) continue
      const before = remaining.slice(0, idx)
      if (before) result.push({ type: 'html', content: enhanceMarkdownHtml(before, mathBlocks) })
      result.push({ type: 'code', block })
      remaining = remaining.slice(idx + marker.length)
    }
    if (remaining) result.push({ type: 'html', content: enhanceMarkdownHtml(remaining, mathBlocks) })
    return result
  }, [html, codeBlocks, mathBlocks])

  const proseClass = className ?? 'markdown-prose'

  if (codeBlocks.length === 0) {
    return <div className={proseClass} dangerouslySetInnerHTML={{ __html: parts[0]?.type === 'html' ? parts[0].content : '' }} />
  }

  return (
    <div className={proseClass}>
      {parts.map((part, i) =>
        part.type === 'html' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: part.content }} />
        ) : shouldRenderAsMermaid(part.block) ? (
          streaming ? (
            <div key={part.block.id} style={{ padding: 16, textAlign: 'center', color: 'var(--muted, #888)', fontSize: 11 }}>Generating diagram...</div>
          ) : (
            <MermaidRenderer key={part.block.id} code={part.block.code} />
          )
        ) : (
          <div key={part.block.id} style={{ margin: '8px 0' }}>
            <CodeViewer code={part.block.code} language={part.block.language} />
          </div>
        )
      )}
    </div>
  )
})
