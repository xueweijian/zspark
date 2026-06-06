// desktop/src/renderer/browser/selectionComposer.test.ts

import { describe, expect, test } from 'vitest'
import { buildSelectionPrompt } from './selectionComposer'

describe('selectionComposer Prompt 拼装测试', () => {
  test('应该能够完美根据 payload 中有无 diff 和修改描述拼接格式化 Prompt', () => {
    // 1. 模拟包含了各种属性样式改动以及描述的 payload
    const payload1 = {
      element: {
        tag: 'button',
        selector: '#save-btn',
        nthPath: 'div > button:nth-child(2)',
      },
      change: {
        text: { from: '保存', to: '确认保存' },
        color: { from: 'rgb(0, 0, 0)', to: 'rgb(255, 0, 0)' },
        background: { from: 'rgb(255, 255, 255)', to: 'rgb(0, 0, 255)' },
        opacity: { from: '1', to: '0.8' },
        fontFamily: { from: 'Arial', to: 'sans-serif' },
        description: '麻烦修改下保存按钮的样式和文案，背景改成蓝色，文字改红色并且变更为确认保存'
      },
      pageUrl: 'http://localhost:5173/test',
      sourceHint: '测试网页'
    }

    const { promptText, displayName } = buildSelectionPrompt(payload1)
    
    expect(displayName).toBe('<button>')
    expect(promptText).toContain('请根据截图中带有编号 1 的蓝色高亮标注')
    expect(promptText).toContain('目标元素：<button>')
    expect(promptText).toContain('CSS 选择器：#save-btn')
    expect(promptText).toContain('DOM 路径：div > button:nth-child(2)')
    expect(promptText).toContain('页面 URL：http://localhost:5173/test')
    expect(promptText).toContain('描述说明：麻烦修改下保存按钮的样式和文案')
    expect(promptText).toContain('文本内容修改为：「确认保存」（原内容为：「保存」）')
    expect(promptText).toContain('字体颜色改为：rgb(255, 0, 0)')
    expect(promptText).toContain('背景色改为：rgb(0, 0, 255)')
    expect(promptText).toContain('透明度改为：0.8')
    expect(promptText).toContain('字体改为：sans-serif')

    // 2. 模拟无 diff、无描述的纯定位 payload
    const payload2 = {
      element: {
        tag: 'div',
        selector: '.container',
      },
      change: {}
    }

    const res2 = buildSelectionPrompt(payload2)
    expect(res2.displayName).toBe('<div>')
    expect(res2.promptText).toContain('描述说明：无额外说明，请根据改动项与截图意图进行修改。')
    expect(res2.promptText).not.toContain('样式改动参考')
  })

  test('应该能够支持多元素选择并完美拼接带有 1、2、3... 编号元素的列表 Prompt', () => {
    const payload3 = {
      elements: [
        {
          tag: 'h1',
          selector: 'h1.title',
          nthPath: 'div > h1:nth-child(1)',
          text: '欢迎访问系统',
          boundingBox: { x: 10, y: 20, w: 200, h: 50 }
        },
        {
          tag: 'p',
          selector: 'p.desc',
          nthPath: 'div > p:nth-child(2)',
          text: '这是描述文本',
          boundingBox: { x: 10, y: 80, w: 300, h: 40 }
        }
      ],
      change: {
        description: '请把标题改为中文标题，描述文本字号加粗。'
      },
      pageUrl: 'http://localhost:5173/dashboard',
      sourceHint: '控制台'
    }

    const { promptText, displayName } = buildSelectionPrompt(payload3)

    expect(displayName).toBe('多个元素 (2个)')
    expect(promptText).toContain('请根据截图中带有编号 1、2、3... 的蓝色高亮标注')
    expect(promptText).toContain('【元素 1】')
    expect(promptText).toContain('- 目标元素标签：<h1>')
    expect(promptText).toContain('- CSS 选择器：h1.title')
    expect(promptText).toContain('- 文本内容：「欢迎访问系统」')
    expect(promptText).toContain('【元素 2】')
    expect(promptText).toContain('- 目标元素标签：<p>')
    expect(promptText).toContain('- CSS 选择器：p.desc')
    expect(promptText).toContain('- 文本内容：「这是描述文本」')
    expect(promptText).toContain('描述说明：请把标题改为中文标题，描述文本字号加粗。')
  })
})
