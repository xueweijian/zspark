import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'
// CM 风格覆盖层:必须在 styles.css 之后加载,用 !important 覆盖主文件里的硬编码浅色。
import './theme-overrides/sidebar.css'
import './theme-overrides/chat.css'
import './theme-overrides/composer.css'
import './theme-overrides/right-panel.css'
import './theme-overrides/plan.css'
import './theme-overrides/git.css'
import './i18n'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
