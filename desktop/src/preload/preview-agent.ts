// desktop/src/preload/preview-agent.ts

(() => {
  // 检查是否已经初始化，避免重复注入
  if ((window as any).__PREVIEW_AGENT_ACTIVE__) return
  ;(window as any).__PREVIEW_AGENT_ACTIVE__ = true

  // 1. 发送消息到主进程 IPC 接口
  const postToHost = (raw: string) => {
    const post = (window as any).__DESKTOP_PREVIEW_POST__
    if (post) post(raw)
  }

  // 2. 状态存储
  let pickerActive = false
  let activeElement: HTMLElement | null = null
  let activeBubble: {
    host: HTMLElement
    destroy: () => void
    updateCount: (count: number) => void
    setMulti: (multi: boolean) => void
  } | null = null

  // 多选元素存储
  let selectedElements: { element: HTMLElement; badge: HTMLDivElement }[] = []

  // 3. 创建高亮浮层及 Shadow DOM (防网页 CSS 污染)
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;'
  const shadow = host.attachShadow({ mode: 'open' })

  // 注入高亮框 CSS 样式，包含红蓝交替闪烁 3 次动画
  const styleTag = document.createElement('style')
  styleTag.textContent = `
    @keyframes flicker-highlight {
      0%, 100% {
        border-color: #ef4444 !important;
        background-color: rgba(239, 68, 68, 0.25) !important;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.6) !important;
      }
      50% {
        border-color: #3b82f6 !important;
        background-color: rgba(59, 130, 246, 0.25) !important;
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.6) !important;
      }
    }
    .flicker {
      animation: flicker-highlight 0.5s ease-in-out 3;
    }
  `
  shadow.appendChild(styleTag)

  const highlightBox = document.createElement('div')
  highlightBox.style.cssText = 'position:fixed;border:2px solid #2f7bff;background:rgba(47,123,255,0.12);pointer-events:none;box-sizing:border-box;transition:all 0.1s ease;'
  highlightBox.hidden = true
  shadow.appendChild(highlightBox)

  // 绘制蓝色高亮框
  const drawHighlight = (el: Element | null) => {
    if (!el) {
      highlightBox.hidden = true
      return
    }
    const rect = el.getBoundingClientRect()
    highlightBox.hidden = false
    highlightBox.style.left = `${rect.left}px`
    highlightBox.style.top = `${rect.top}px`
    highlightBox.style.width = `${rect.width}px`
    highlightBox.style.height = `${rect.height}px`
  }

  // 4. 计算 CSS 选择器 (Selector) 与绝对路径 (NthPath)
  function cssTag(el: Element): string {
    const tag = el.tagName.toLowerCase()
    const parent = el.parentElement
    if (!parent) return tag
    const same = Array.from(parent.children).filter((c) => c.tagName === el.tagName)
    if (same.length <= 1) return tag
    return `${tag}:nth-of-type(${same.indexOf(el) + 1})`
  }

  function buildSelector(el: Element): string {
    if (el.id) return `#${el.id}`
    const parts: string[] = []
    let node: Element | null = el
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html' && node.tagName.toLowerCase() !== 'body') {
      if (node.id) {
        parts.unshift(`#${node.id}`)
        break
      }
      parts.unshift(cssTag(node))
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  // 绝对路径计算
  function buildNthPath(el: Element): string {
    const parts: string[] = []
    let node: Element | null = el
    while (node && node.parentElement) {
      const idx = Array.from(node.parentElement.children).indexOf(node) + 1
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${idx})`)
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  // DOM 降噪：去除冗长 Tailwind 类名
  function cleanTailwindClasses(node: Element) {
    for (let i = 0; i < node.children.length; i++) {
      cleanTailwindClasses(node.children[i])
    }

    if (node.className) {
      const classes = Array.from(node.classList)
      // 匹配 Tailwind 常见布局/间距/样式类名前缀
      const tailwindRegex = /^(p[xytrbl]?-|m[xytrbl]?-|w-|h-|min-w-|max-w-|min-h-|max-h-|flex|grid|items-|justify-|self-|col-|row-|gap-|border-|rounded-|shadow-|bg-|text-|hover:|focus:|active:|sm:|md:|lg:|xl:|2xl:|dark:)/
      
      const filtered = classes.filter(cls => {
        if (tailwindRegex.test(cls)) {
          // 保留含关键业务语义的词缀，如 btn, nav 等
          const keywordRegex = /(btn|nav|menu|item|title|content|header|footer|logo|card|sidebar|modal)/i
          return keywordRegex.test(cls)
        }
        return true
      })

      if (filtered.length > 0) {
        node.className = filtered.join(' ')
      } else {
        node.removeAttribute('class')
      }
    }
  }

  // DOM 树瘦身：精简折叠空元素
  function simplifyDomTree(node: Element, depth: number) {
    const keepTags = ['img', 'svg', 'input', 'button', 'a', 'iframe', 'textarea', 'select', 'video', 'audio']
    const hasText = (node.textContent ?? '').trim().length > 0
    const isInteractiveOrMedia = keepTags.includes(node.tagName.toLowerCase()) || node.hasAttribute('src') || node.hasAttribute('href')

    if (!hasText && !isInteractiveOrMedia && node.children.length > 0) {
      node.innerHTML = ''
      node.setAttribute('data-folded', 'true')
      return
    }

    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i]
      const childHasText = (child.textContent ?? '').trim().length > 0
      const childInteractive = keepTags.includes(child.tagName.toLowerCase()) || child.hasAttribute('src') || child.hasAttribute('href')
      
      if (depth >= 2 && !childHasText && !childInteractive) {
        child.remove()
      } else {
        simplifyDomTree(child, depth + 1)
      }
    }
  }

  // 抓取元素元数据与计算样式
  const STYLE_KEYS = ['color', 'backgroundColor', 'opacity', 'fontFamily', 'fontSize', 'fontWeight', 'padding', 'margin']
  function buildElementMetadata(el: Element) {
    const cs = window.getComputedStyle(el)
    const styles: Record<string, string> = {}
    for (const k of STYLE_KEYS) {
      styles[k] = (cs as any)[k] ?? ''
    }
    const r = el.getBoundingClientRect()
    const selector = buildSelector(el)

    // 深拷贝并精简 DOM，降低 LLM 噪声和 token 消耗
    const cloned = el.cloneNode(true) as HTMLElement
    cleanTailwindClasses(cloned)
    simplifyDomTree(cloned, 0)

    return {
      selector,
      nthPath: buildNthPath(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: Array.from(el.classList),
      text: (el.textContent ?? '').trim().slice(0, 200) || undefined,
      boundingBox: { x: r.x, y: r.y, w: r.width, h: r.height },
      computedStyles: styles,
      outerHtmlSnippet: cloned.outerHTML.slice(0, 1000)
    }
  }

  // 5. 可视化编辑与实时预览样式抓取
  type EditableSnapshot = { text: string; color: string; background: string; opacity: string; fontFamily: string }
  function snapshotEditableStyles(el: HTMLElement): EditableSnapshot {
    const cs = window.getComputedStyle(el)
    return {
      text: el.textContent ?? '',
      color: cs.color,
      background: cs.backgroundColor,
      opacity: cs.opacity,
      fontFamily: cs.fontFamily,
    }
  }

  function applyEdit(el: HTMLElement, input: Partial<EditableSnapshot>) {
    const cs = window.getComputedStyle(el)
    const diff: any = {}
    if (input.text !== undefined && input.text !== el.textContent) {
      diff.text = { from: el.textContent ?? '', to: input.text }
      el.textContent = input.text
    }
    if (input.color) {
      diff.color = { from: cs.color, to: input.color }
      el.style.color = input.color
    }
    if (input.background) {
      diff.background = { from: cs.backgroundColor, to: input.background }
      el.style.background = input.background
    }
    if (input.opacity) {
      diff.opacity = { from: cs.opacity, to: input.opacity }
      el.style.opacity = input.opacity
    }
    if (input.fontFamily) {
      diff.fontFamily = { from: cs.fontFamily, to: input.fontFamily }
      el.style.fontFamily = input.fontFamily
    }
    return diff
  }

  // 计算发生改变的属性 diff
  function computeChange(original: EditableSnapshot, current: EditableSnapshot) {
    const d: any = {}
    if (current.text !== original.text) d.text = { from: original.text, to: current.text }
    if (current.color !== original.color) d.color = { from: original.color, to: current.color }
    if (current.background !== original.background) d.background = { from: original.background, to: current.background }
    if (current.opacity !== original.opacity) d.opacity = { from: original.opacity, to: current.opacity }
    if (current.fontFamily !== original.fontFamily) d.fontFamily = { from: original.fontFamily, to: current.fontFamily }
    return d
  }

  // 6. 属性编辑气泡创建
  const FIELDS = [
    { key: 'text', label: '文本' },
    { key: 'color', label: '文字颜色' },
    { key: 'background', label: '背景' },
    { key: 'opacity', label: 'Opacity' },
    { key: 'fontFamily', label: '字体' },
  ]

  function createEditBubble(
    el: HTMLElement,
    isMulti: boolean,
    deps: { onConfirm: (change: any, description: string) => void; onCancel: () => void }
  ) {
    const original = snapshotEditableStyles(el)
    const current = { ...original }
    let description = ''

    const bubbleHost = document.createElement('div')
    const rect = el.getBoundingClientRect()
    const top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 380))
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 356))
    bubbleHost.style.cssText = `position:fixed;top:${top}px;left:${left}px;z-index:2147483647;`
    
    const bubbleShadow = bubbleHost.attachShadow({ mode: 'open' })
    const wrap = document.createElement('div')
    wrap.setAttribute('style', 'width:340px;box-sizing:border-box;background:#fff;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.2);padding:12px;font:13px/1.45 -apple-system,system-ui,sans-serif;color:#111;')

    // 描述框
    const desc = document.createElement('input')
    desc.placeholder = '描述这些更改...'
    desc.setAttribute('style', 'width:100%;box-sizing:border-box;border:none;outline:none;font-size:14px;padding:6px 4px;border-bottom:1px solid #eee;margin-bottom:6px;')
    desc.addEventListener('input', () => { description = desc.value })
    wrap.appendChild(desc)

    // 多选时的元素个数指示
    const countLabel = document.createElement('div')
    countLabel.textContent = `已选择 ${selectedElements.length} 个元素`
    countLabel.setAttribute('style', 'color:#2f7bff;font-weight:600;padding:4px 4px;margin-bottom:6px;')
    countLabel.style.display = isMulti ? 'block' : 'none'
    wrap.appendChild(countLabel)

    const tag = document.createElement('div')
    tag.textContent = isMulti ? '已开启多元素圈选' : `元素: <${el.tagName.toLowerCase()}>`
    tag.setAttribute('style', 'color:#8a8a8a;margin-top:6px;padding:4px 4px;font-weight:600;')
    wrap.appendChild(tag)

    // 各属性输入 row 列表 (收集以便于动态显隐)
    const rows: HTMLElement[] = []
    for (const f of FIELDS) {
      const row = document.createElement('label')
      row.setAttribute('style', 'display:flex;align-items:center;gap:10px;padding:5px 4px;')
      row.style.display = isMulti ? 'none' : 'flex'
      
      const lab = document.createElement('span')
      lab.textContent = f.label
      lab.setAttribute('style', 'width:74px;color:#555;flex:none;')
      const inp = document.createElement('input')
      inp.value = (original as any)[f.key]
      inp.setAttribute('style', 'flex:1;min-width:0;border:1px solid #e2e2e2;border-radius:8px;padding:5px 9px;font:inherit;')
      
      const key = f.key as keyof EditableSnapshot
      inp.addEventListener('input', () => {
        (current as any)[key] = inp.value
        applyEdit(el, { [key]: inp.value })
      })

      row.appendChild(lab)
      row.appendChild(inp)
      wrap.appendChild(row)
      rows.push(row)
    }

    // 底部确认/取消按钮
    const footer = document.createElement('div')
    footer.setAttribute('style', 'display:flex;justify-content:space-between;align-items:center;margin-top:12px;')
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.setAttribute('style', 'border:none;background:#f1f1f1;border-radius:18px;padding:7px 16px;cursor:pointer;font:inherit;')
    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = '确定 (✓)'
    confirmBtn.setAttribute('style', 'border:none;background:#2f7bff;color:#fff;border-radius:18px;padding:7px 16px;cursor:pointer;font-weight:600;')

    cancelBtn.addEventListener('click', () => {
      if (!isMulti) {
        applyEdit(el, original) // 还原最初样式
      }
      deps.onCancel()
    })
    confirmBtn.addEventListener('click', () => {
      const diff = isMulti ? null : computeChange(original, current)
      deps.onConfirm(diff, description)
    })

    footer.appendChild(cancelBtn)
    footer.appendChild(confirmBtn)
    wrap.appendChild(footer)

    bubbleShadow.appendChild(wrap)
    document.documentElement.appendChild(bubbleHost)

    return {
      host: bubbleHost,
      destroy: () => {
        bubbleHost.remove()
      },
      updateCount: (count: number) => {
        countLabel.textContent = `已选择 ${count} 个元素`
      },
      setMulti: (multi: boolean) => {
        countLabel.style.display = multi ? 'block' : 'none'
        tag.textContent = multi ? '已开启多元素圈选' : `元素: <${el.tagName.toLowerCase()}>`
        rows.forEach(row => {
          row.style.display = multi ? 'none' : 'flex'
        })
      }
    }
  }

  // 7. 数字标注角标管理
  const createBadge = (el: HTMLElement, index: number) => {
    const rect = el.getBoundingClientRect()
    const badge = document.createElement('div')
    badge.style.cssText = `
      position: fixed;
      left: ${rect.left + rect.width / 2 - 13}px;
      top: ${Math.max(4, rect.top - 30)}px;
      width: 26px;
      height: 26px;
      background: #2f7bff;
      color: white;
      border: 2px solid white;
      border-radius: 50%;
      text-align: center;
      line-height: 22px;
      font-weight: bold;
      font-size: 14px;
      box-sizing: border-box;
      z-index: 2147483647;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      pointer-events: none;
    `
    badge.textContent = String(index)
    document.body.appendChild(badge)
    return badge
  }

  // 刷新所有已选角标的位置和文字
  const refreshBadges = () => {
    selectedElements.forEach(({ element, badge }, i) => {
      const rect = element.getBoundingClientRect()
      badge.style.left = `${rect.left + rect.width / 2 - 13}px`
      badge.style.top = `${Math.max(4, rect.top - 30)}px`
      badge.textContent = String(i + 1)
    })
  }

  // 滚动时动态刷新标注位置，防止视觉位移
  window.addEventListener('scroll', () => {
    if (selectedElements.length > 0) {
      refreshBadges()
    }
  }, { passive: true })

  // 单选时的角标存储
  let annotationBadge: HTMLDivElement | null = null
  const addAnnotationBadgeSingle = (el: HTMLElement) => {
    annotationBadge = createBadge(el, 1)
  }

  const removeAnnotationBadge = () => {
    if (annotationBadge) {
      annotationBadge.remove()
      annotationBadge = null
    }
  }

  // 双向通信：平滑滚动到指定元素位置并闪烁高亮 3 次
  const scrollToElement = (selector: string) => {
    try {
      const el = document.querySelector(selector) as HTMLElement
      if (!el) {
        console.warn('[preview-agent] Element not found for selector:', selector)
        return
      }

      // 平滑滚动
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })

      // 触发闪烁高亮
      triggerFlickerHighlight(el)
    } catch (err) {
      console.error('[preview-agent] Failed to scroll to element:', err)
    }
  }

  const triggerFlickerHighlight = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    highlightBox.hidden = false
    highlightBox.style.left = `${rect.left}px`
    highlightBox.style.top = `${rect.top}px`
    highlightBox.style.width = `${rect.width}px`
    highlightBox.style.height = `${rect.height}px`

    // 强力闪烁
    highlightBox.classList.remove('flicker')
    void highlightBox.offsetWidth // 强行触发重绘以重新开开启动画
    highlightBox.classList.add('flicker')

    setTimeout(() => {
      highlightBox.classList.remove('flicker')
      if (!pickerActive) {
        highlightBox.hidden = true
      } else {
        drawHighlight(activeElement || el)
      }
    }, 1500)
  }

  // 8. 绑定页面控制命令接收端口到 window.__PREVIEW_BRIDGE__
  const bridge = {
    handleHostRaw: (raw: string) => {
      try {
        const msg = JSON.parse(raw)
        if (msg.type === 'enter-picker') {
          pickerActive = true
          teardown()
        } else if (msg.type === 'exit-picker') {
          pickerActive = false
          teardown()
        } else if (msg.type === 'screenshot-done') {
          // 截图完成移除全部标注
          teardown()
        } else if (msg.type === 'scroll-to-element') {
          const selector = msg.selector
          if (selector) {
            scrollToElement(selector)
          }
        }
      } catch (e) {
        console.error('[preview-agent] failed to parse host message:', e)
      }
    }
  }
  ;(window as any).__PREVIEW_BRIDGE__ = bridge

  // 全局退出/恢复方法
  const teardown = () => {
    activeBubble?.destroy()
    activeBubble = null
    highlightBox.hidden = true
    activeElement = null
    
    // 移除单选角标
    removeAnnotationBadge()
    
    // 移除多选所有角标并清空
    selectedElements.forEach(item => {
      item.badge.remove()
    })
    selectedElements = []
  }

  const openBubble = (el: HTMLElement) => {
    const isMulti = selectedElements.length > 0
    activeBubble = createEditBubble(el, isMulti, {
      onConfirm: (change, desc) => {
        if (selectedElements.length > 0) {
          // 多选确认
          const elementsMeta = selectedElements.map(item => buildElementMetadata(item.element))
          
          postToHost(JSON.stringify({
            type: 'selection',
            payload: {
              pageUrl: window.location.href,
              sourceHint: document.title || undefined,
              elements: elementsMeta,
              change: { description: desc || undefined }
            }
          }))
        } else {
          // 单选确认并截图
          addAnnotationBadgeSingle(el)
          
          postToHost(JSON.stringify({
            type: 'selection',
            payload: {
              pageUrl: window.location.href,
              sourceHint: document.title || undefined,
              element: buildElementMetadata(el),
              change: { ...change, description: desc || undefined }
            }
          }))
        }
      },
      onCancel: () => {
        teardown()
      }
    })
  }

  const updateBubbleCount = () => {
    if (activeBubble) {
      // 如果本来是单选，突变为了多选，我们需要把之前的 activeElement 也转换进多选数组中
      if (activeElement && selectedElements.length === 0) {
        const firstBadge = createBadge(activeElement, 1)
        selectedElements.push({ element: activeElement, badge: firstBadge })
        activeElement = null
      }
      
      const isMulti = selectedElements.length > 0
      activeBubble.setMulti(isMulti)
      activeBubble.updateCount(selectedElements.length)
    }
  }

  // 9. 事件绑定
  document.addEventListener('mousemove', (e) => {
    if (!pickerActive || activeBubble) return
    const t = e.target
    if (t instanceof Element) {
      if (t === host || host.contains(t)) return
      drawHighlight(t)
    }
  }, true)

  document.addEventListener('click', (e) => {
    if (!pickerActive || activeBubble) return
    const t = e.target as HTMLElement
    if (!t) return
    
    // 避免点击我们创建的高亮框或者 bubble 宿主上
    if (t === host || host.contains(t)) return
    
    // 阻止原生点击跳转事件
    e.preventDefault()
    e.stopPropagation()
    
    const isShift = e.shiftKey
    const existingIndex = selectedElements.findIndex(item => item.element === t)

    if (isShift || selectedElements.length > 0) {
      // 进入多选逻辑
      if (existingIndex > -1) {
        // 取消选择该元素
        selectedElements[existingIndex].badge.remove()
        selectedElements.splice(existingIndex, 1)
        refreshBadges()
      } else {
        // 添加选择
        const badge = createBadge(t, selectedElements.length + 1)
        selectedElements.push({ element: t, badge })
      }

      if (!activeBubble) {
        openBubble(t)
      }
      // 触发多选气泡状态更新
      updateBubbleCount()
    } else {
      // 单选逻辑
      drawHighlight(t)
      activeElement = t
      openBubble(t)
    }
  }, true)

  // 页面就绪后向主进程发送 navigated 和 ready 事件
  const reportReady = () => {
    postToHost(JSON.stringify({ type: 'ready' }))
    postToHost(JSON.stringify({
      type: 'navigated',
      url: window.location.href,
      title: document.title
    }))
  }

  if (document.readyState !== 'loading') reportReady()
  else document.addEventListener('DOMContentLoaded', reportReady)

  if (!host.isConnected) document.documentElement.appendChild(host)
})()
export {}
