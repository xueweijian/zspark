import React, { useEffect, useState, useRef } from 'react'

import vscodePng from './vscode_logo.png'
import visualstudioPng from './visualstudio_logo.png'
import cursorPng from './cursor_logo.png'
import zedPng from './zed_logo.png'
import folderPng from './folder_logo.png'
import finderPng from './finder_logo.png'

interface IDEInfo {
  id: string
  name: string
  executable: string
  icon: string
}

interface OpenInIDEButtonProps {
  projectPath: string
}

const STORAGE_KEY = 'zspark:defaultIdeId'

// --- 彩色官方高保真图像图标组件 ---
const getIconComponent = (iconType: string) => {
  let src = folderPng
  switch (iconType) {
    case 'vscode':
      src = vscodePng
      break
    case 'visualstudio':
      src = visualstudioPng
      break
    case 'cursor':
      src = cursorPng
      break
    case 'zed':
      src = zedPng
      break
    case 'finder':
      src = finderPng
      break
    case 'explorer':
    case 'folder':
      src = folderPng
      break
    default:
      src = folderPng
      break
  }
  return (
    <img 
      src={src} 
      alt={iconType} 
      style={{ width: '16px', height: '16px', objectFit: 'contain', display: 'block' }} 
    />
  )
}


export const OpenInIDEButton: React.FC<OpenInIDEButtonProps> = ({ projectPath }) => {
  const [ides, setIdes] = useState<IDEInfo[]>([])
  const [defaultIdeId, setDefaultIdeId] = useState<string | null>(localStorage.getItem(STORAGE_KEY))
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
  const [hoveredRefresh, setHoveredRefresh] = useState(false)
  
  // Split Button 左右两半的 hover 状态
  const [isLeftHovered, setIsLeftHovered] = useState(false)
  const [isRightHovered, setIsRightHovered] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // 初始化加载 IDE 列表
  const loadIDEs = async (force = false) => {
    setIsLoading(true)
    try {
      const detected = await (window as any).zspark.detectIdes(force)
      // 彻底过滤与 Antigravity 相关的项
      const filtered = detected.filter((ide: IDEInfo) => 
        !ide.id.toLowerCase().includes('antigravity') && 
        !ide.name.toLowerCase().includes('antigravity')
      )
      setIdes(filtered)
      
      if (defaultIdeId && !filtered.find((i: IDEInfo) => i.id === defaultIdeId)) {
        if (filtered.length > 0) {
          setDefaultIdeId(filtered[0].id)
          localStorage.setItem(STORAGE_KEY, filtered[0].id)
        } else {
          setDefaultIdeId(null)
        }
      } else if (!defaultIdeId && filtered.length > 0) {
        setDefaultIdeId(filtered[0].id)
        localStorage.setItem(STORAGE_KEY, filtered[0].id)
      }
    } catch (err) {
      console.error('Failed to load IDEs', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadIDEs()

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [defaultIdeId])

  const handleOpenIde = async (ideId: string) => {
    const selectedIde = ides.find(i => i.id === ideId)
    if (!selectedIde || !projectPath) return

    try {
      setDefaultIdeId(ideId)
      localStorage.setItem(STORAGE_KEY, ideId)
      setIsOpen(false)

      await (window as any).zspark.openInIde(selectedIde, projectPath)
      console.log(`Opening ${projectPath} in ${selectedIde.name}`)
    } catch (err: any) {
      alert(`无法打开 IDE: ${err.message}`)
    }
  }

  const handleMainButtonClick = () => {
    if (defaultIdeId) {
      handleOpenIde(defaultIdeId)
    }
  }

  const defaultIde = ides.find(i => i.id === defaultIdeId)
  const isDisabled = !projectPath || ides.length === 0 || isLoading

  // 下拉菜单图标的 SVG
  const ChevronIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )

  const CheckIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )

  return (
    <div className="relative" style={{ display: 'inline-flex', alignItems: 'center' }} ref={dropdownRef}>
      {/* 按钮主体组 (Split Button) - 药丸形 */}
      <div 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: '9999px',
          border: '1px solid var(--border)',
          background: 'var(--surface, #fff)',
          boxSizing: 'border-box',
          overflow: 'hidden',
          opacity: isDisabled ? 0.5 : 1,
          pointerEvents: isDisabled ? 'none' : 'auto',
          height: '30px', // 精确对齐原生 header-btn 高度
          transition: 'border-color 0.12s, box-shadow 0.12s'
        }}
        title={isDisabled ? '未检测到任何受支持的原生 IDE 或工作区路径无效' : `使用 ${defaultIde?.name || 'IDE'} 打开`}
      >
        {/* 左半侧 (主按钮，只显示官方彩色图标，无文字) */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleMainButtonClick}
          onMouseEnter={() => setIsLeftHovered(true)}
          onMouseLeave={() => setIsLeftHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: '9999px 0 0 9999px',
            background: isLeftHovered ? 'var(--surface-soft, #f4f4f5)' : 'transparent',
            padding: '6px 8px 6px 12px',
            cursor: 'pointer',
            height: '100%',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'background 0.12s'
          }}
        >
          {defaultIde ? getIconComponent(defaultIde.icon) : <span style={{ width: 16, height: 16 }} />}
        </button>

        {/* 右半侧 (下拉箭头) */}
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setIsRightHovered(true)}
          onMouseLeave={() => setIsRightHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: '0 9999px 9999px 0',
            background: isRightHovered ? 'var(--surface-soft, #f4f4f5)' : 'transparent',
            padding: '6px 12px 6px 8px',
            borderLeft: '1px solid var(--border)',
            cursor: 'pointer',
            height: '100%',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'background 0.12s',
            color: 'var(--text-muted, #71717a)'
          }}
        >
          <ChevronIcon />
        </button>
      </div>

      {/* 下拉菜单 (圆角提升到 12px，阴影更柔顺高级) */}
      {isOpen && !isDisabled && (
        <div 
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '6px',
            width: '220px',
            backgroundColor: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e4e4e7)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
            zIndex: 1000,
            padding: '6px 0',
            overflow: 'hidden'
          }}
        >
          {ides.map(ide => (
            <button
              key={ide.id}
              onClick={() => handleOpenIde(ide.id)}
              onMouseEnter={() => setHoveredItemId(ide.id)}
              onMouseLeave={() => setHoveredItemId(null)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
                fontSize: '12.5px',
                backgroundColor: hoveredItemId === ide.id ? 'var(--surface-soft, #f4f4f5)' : 'transparent',
                color: 'var(--text-main, #3f3f46)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.08s'
              }}
              title={ide.executable} // hover 时显示完整路径
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                {getIconComponent(ide.icon)}
                <span style={{ fontWeight: 500 }}>{ide.name}</span>
              </div>
              {ide.id === defaultIdeId && (
                <div style={{ color: 'var(--text-main, #3f3f46)', display: 'flex', alignItems: 'center' }}>
                  <CheckIcon />
                </div>
              )}
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border, #e4e4e7)', marginTop: '6px', paddingTop: '4px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                loadIDEs(true) // 强制刷新
              }}
              onMouseEnter={() => setHoveredRefresh(true)}
              onMouseLeave={() => setHoveredRefresh(false)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '6px 16px',
                fontSize: '11.5px',
                color: 'var(--text-muted, #71717a)',
                backgroundColor: hoveredRefresh ? 'var(--surface-soft, #f4f4f5)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.08s'
              }}
            >
              刷新工具列表
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
