// context usage ring 百分比计算。
// 算法移植自 CM ComposerMetaBar:优先用 last.totalTokens(最近一次),没有才用 total;
// 展示"剩余 free %"。
//
// tokenUsage 结构(来自 codex app-server 的 thread/tokenUsage/updated):
//   { total: TokenUsageBreakdown, last: TokenUsageBreakdown, modelContextWindow: number | null }
// TokenUsageBreakdown: { totalTokens, inputTokens, outputTokens }

export interface TokenUsageBreakdown {
  totalTokens: number
  inputTokens: number
  outputTokens: number
}

export interface TokenUsage {
  total: TokenUsageBreakdown
  last: TokenUsageBreakdown
  modelContextWindow: number | null
}

export interface ContextRingInfo {
  /** 剩余上下文百分比(0-100)。 */
  freePercent: number
  /** 已用百分比(0-100)。 */
  usedPercent: number
  /** 上下文窗口总大小(tokens)。 */
  contextWindow: number
  /** 已用 tokens(用于展示)。 */
  usedTokens: number
  /** 总累计 tokens(用于展示)。 */
  totalTokens: number
  inputTokens: number
  outputTokens: number
}

const DEFAULT_CONTEXT_WINDOW = 128000

/** 计算 context ring 信息。tokenUsage 为 null 时返回零值。 */
export function computeContextRing(tokenUsage: any): ContextRingInfo {
  const ctx = tokenUsage as TokenUsage | null
  const contextWindow = ctx?.modelContextWindow ?? DEFAULT_CONTEXT_WINDOW
  const lastTokens = ctx?.last?.totalTokens ?? 0
  const totalTokens = ctx?.total?.totalTokens ?? 0
  // CM 算法:优先 last,没有才用 total。
  const usedTokens = lastTokens > 0 ? lastTokens : totalTokens
  const safeWindow = contextWindow > 0 ? contextWindow : DEFAULT_CONTEXT_WINDOW
  const usedPercent = Math.min(100, Math.max(0, Math.round((usedTokens / safeWindow) * 100)))
  const freePercent = 100 - usedPercent
  return {
    freePercent,
    usedPercent,
    contextWindow: safeWindow,
    usedTokens,
    totalTokens,
    inputTokens: ctx?.total?.inputTokens ?? 0,
    outputTokens: ctx?.total?.outputTokens ?? 0,
  }
}
