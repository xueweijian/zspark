// desktop/src/renderer/browser/selectionComposer.ts

export function buildSelectionPrompt(payload: any) {
  const { element, elements, change, pageUrl, sourceHint } = payload
  const desc = change?.description || ''

  if (elements && Array.isArray(elements) && elements.length > 0) {
    // 多选模式
    const itemsPrompt = elements.map((el, i) => {
      const tag = el.tag || 'element'
      return `【元素 ${i + 1}】
- 目标元素标签：<${tag}>
- CSS 选择器：${el.selector || '—'}
- DOM 路径：${el.nthPath || '—'}
- 文本内容：${el.text ? `「${el.text}」` : '—'}
- 尺寸包围盒：x=${el.boundingBox?.x}, y=${el.boundingBox?.y}, w=${el.boundingBox?.w}, h=${el.boundingBox?.h}`
    }).join('\n\n')

    const prompt = `
请根据截图中带有编号 1、2、3... 的蓝色高亮标注，对本地的前端代码进行修改。

【目标元素列表】
${itemsPrompt}

【定位上下文】
- 页面 URL：${pageUrl || '—'} (标题: ${sourceHint || '—'})

【用户修改要求】
- 描述说明：${desc || '无额外说明，请根据改动项与截图意图进行修改。'}

请优先依据截图中编号的高亮框判断被修改的元素及其在项目文件中的具体位置，Selector 仅作为辅助参考线索。
    `.trim()

    return {
      promptText: prompt,
      displayName: `多个元素 (${elements.length}个)`
    }
  }

  // 单选模式 (原有逻辑)
  const tag = element?.tag || 'element'
  
  const diffs: string[] = []
  if (change?.text && change.text.from !== change.text.to) {
    diffs.push(`- 文本内容修改为：「${change.text.to}」（原内容为：「${change.text.from}」）`)
  }
  if (change?.color && change.color.from !== change.color.to) {
    diffs.push(`- 字体颜色改为：${change.color.to}`)
  }
  if (change?.background && change.background.from !== change.background.to) {
    diffs.push(`- 背景色改为：${change.background.to}`)
  }
  if (change?.opacity && change.opacity.from !== change.opacity.to) {
    diffs.push(`- 透明度改为：${change.opacity.to}`)
  }
  if (change?.fontFamily && change.fontFamily.from !== change.fontFamily.to) {
    diffs.push(`- 字体改为：${change.fontFamily.to}`)
  }

  const prompt = `
请根据截图中带有编号 1 的蓝色高亮标注，对本地的前端代码进行修改。

【定位上下文】
- 目标元素：<${tag}>
- CSS 选择器：${element?.selector || '—'}
- DOM 路径：${element?.nthPath || '—'}
- 页面 URL：${pageUrl || '—'} (标题: ${sourceHint || '—'})

【用户修改要求】
- 描述说明：${desc || '无额外说明，请根据改动项与截图意图进行修改。'}
${diffs.length > 0 ? '\n【样式改动参考】\n' + diffs.join('\n') : ''}

请优先依据截图中编号 1 的高亮框判断被修改的元素及其在项目文件中的具体位置，Selector 仅作为辅助参考线索。
  `.trim()

  return {
    promptText: prompt,
    displayName: `<${tag}>`,
  }
}
