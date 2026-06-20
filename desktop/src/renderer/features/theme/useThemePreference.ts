import { useEffect } from 'react'

// 移植自 CM 的 useThemePreference(src/features/layout/hooks/useThemePreference.ts)。
// 通过在 <html> 上设 data-theme 属性切换主题:
// - 'dark' (默认):不设 data-theme,走 :root 的 dark 值
// - 'light':设 data-theme="light",走 :root[data-theme="light"] 覆盖
// - 'system':跟随系统 prefers-color-scheme

export type ThemePreference = 'system' | 'light' | 'dark'

const LS_KEY = 'zspark.theme'
const VALID: ThemePreference[] = ['system', 'light', 'dark']

export function readStoredTheme(): ThemePreference {
  const raw = localStorage.getItem(LS_KEY)
  return VALID.includes(raw as ThemePreference) ? (raw as ThemePreference) : 'dark'
}

/** 把主题应用到 <html>。system 模式根据系统偏好决定 dark/light。 */
export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement
  if (theme === 'system') {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    if (prefersLight) root.dataset.theme = 'light'
    else delete root.dataset.theme
  } else if (theme === 'light') {
    root.dataset.theme = 'light'
  } else {
    // dark:删掉 data-theme,走 :root 默认
    delete root.dataset.theme
  }
}

/** 监听主题变化并应用到 DOM。持久化到 localStorage。 */
export function useThemePreference(theme: ThemePreference) {
  // 应用 + 持久化
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(LS_KEY, theme)
  }, [theme])

  // system 模式下监听系统偏好变化
  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => applyTheme('system')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme])
}
