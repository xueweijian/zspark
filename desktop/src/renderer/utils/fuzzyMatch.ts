/**
 * Fuzzy matching utilities for slash commands and file search.
 *
 * Supports:
 * - Substring match (highest priority)
 * - Consecutive character match
 * - Acronym match (first letters of words)
 */

export function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const t = target.toLowerCase()

  // 1. Substring match
  if (t.includes(q)) return true

  // 2. Character sequence match (all query chars appear in order)
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  if (qi === q.length) return true

  // 3. Acronym match (first letters of hyphen/underscore/space-separated words)
  const words = t.split(/[-_/\s]+/)
  const acronym = words.map((w) => w[0] || '').join('')
  if (acronym.includes(q)) return true

  return false
}

export function fuzzyScore(query: string, target: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()

  // Exact match
  if (t === q) return 1000

  // Starts with
  if (t.startsWith(q)) return 900

  // Substring match
  if (t.includes(q)) return 800

  // Character sequence match
  let qi = 0
  let score = 0
  let lastMatch = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += (lastMatch === ti - 1) ? 10 : 5 // bonus for consecutive
      lastMatch = ti
      qi++
    }
  }
  if (qi === q.length) return 500 + score

  // Acronym match
  const words = t.split(/[-_/\s]+/)
  const acronym = words.map((w) => w[0] || '').join('')
  if (acronym.includes(q)) return 400

  return 0
}

/**
 * Filter and sort items by fuzzy matching on a string key.
 */
export function fuzzyFilter<T>(query: string, items: T[], getKey: (item: T) => string): T[] {
  if (!query) return items
  return items
    .map((item) => ({ item, score: fuzzyScore(query, getKey(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)
}
