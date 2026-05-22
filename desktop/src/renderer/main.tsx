import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './i18n'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
createRoot(root).render(<App />)
