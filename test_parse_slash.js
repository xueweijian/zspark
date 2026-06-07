const fs = require('fs');
const path = require('path');

const getRsPath = () => 'codex-rs/tui/src/slash_command.rs';

function extractBraceContent(str, startIndex) {
  const braceIndex = str.indexOf('{', startIndex)
  if (braceIndex === -1) {
    return ''
  }
  
  let depth = 0
  let inString = false
  let inChar = false
  let inComment = false
  
  for (let i = braceIndex; i < str.length; i++) {
    const char = str[i]
    const prevChar = i > 0 ? str[i - 1] : ''
    const nextChar = i + 1 < str.length ? str[i + 1] : ''
    const isEscaped = prevChar === '\\' && (i < 2 || str[i - 2] !== '\\')
    
    if (inComment) {
      if (char === '\n' && inComment === 'single') {
        inComment = false
      } else if (char === '/' && prevChar === '*' && inComment === 'multi') {
        inComment = false
      }
      continue
    }
    
    if (inChar) {
      if (char === "'" && !isEscaped) {
        inChar = false
      }
      continue
    }
    
    if (inString) {
      if (char === '"' && !isEscaped) {
        inString = false
      }
      continue
    }
    
    if (char === '/' && nextChar === '/') {
      inComment = 'single'
      i++
      continue
    }
    if (char === '/' && nextChar === '*') {
      inComment = 'multi'
      i++
      continue
    }
    
    if (char === "'" && !isEscaped) {
      inChar = true
      continue
    }
    if (char === '"' && !isEscaped) {
      inString = true
      continue
    }
    
    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return str.substring(braceIndex + 1, i)
      }
    }
  }
  return ''
}

function pascalToKebab(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

function parseSlashCommands(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      console.log('file not found');
      return []
    }
    const content = fs.readFileSync(filePath, 'utf8')

    const enumIndex = content.indexOf('pub enum SlashCommand')
    if (enumIndex === -1) {
      console.log('enum not found');
      return []
    }
    const enumContent = extractBraceContent(content, enumIndex)

    const descFuncIndex = content.indexOf('fn description')
    let descContent = ''
    if (descFuncIndex !== -1) {
      const matchSelfIndex = content.indexOf('match self', descFuncIndex)
      if (matchSelfIndex !== -1) {
        descContent = extractBraceContent(content, matchSelfIndex)
      }
    }

    const inlineMatch = content.match(/pub fn supports_inline_args[\s\S]*?matches!\(\s*self,\s*([\s\S]*?)\)/)
    const inlineContent = inlineMatch ? inlineMatch[1] : ''

    const inlineVariants = new Set()
    if (inlineContent) {
      const variantMatches = inlineContent.match(/SlashCommand::(\w+)/g)
      if (variantMatches) {
        for (const m of variantMatches) {
          const v = m.replace('SlashCommand::', '').trim()
          inlineVariants.add(v)
        }
      }
    }

    const descMap = new Map()
    if (descContent) {
      const armRegex = /SlashCommand::([A-Za-z0-9_|:\s\n]+)=>\s*/g
      let matchArr;
      while ((matchArr = armRegex.exec(descContent)) !== null) {
        const variantsPart = matchArr[1]
        const valueStartIndex = armRegex.lastIndex
        
        const variants = variantsPart.match(/[A-Za-z0-9]+/g)
        if (!variants) continue
        
        let descText = ''
        const firstChar = descContent[valueStartIndex]
        if (firstChar === '{') {
          const braceContent = extractBraceContent(descContent, valueStartIndex)
          const strMatch = braceContent.match(/"([\s\S]*?)"/)
          descText = strMatch ? strMatch[1] : ''
          const outerBraceEnd = descContent.indexOf('}', valueStartIndex)
          if (outerBraceEnd !== -1 && outerBraceEnd >= valueStartIndex) {
            armRegex.lastIndex = outerBraceEnd + 1
          } else {
            armRegex.lastIndex = descContent.indexOf('{', valueStartIndex) + 1 + braceContent.length + 1
          }
        } else if (firstChar === '"') {
          let strVal = ''
          let i = valueStartIndex + 1
          for (; i < descContent.length; i++) {
            if (descContent[i] === '"' && descContent[i - 1] !== '\\') {
              break
            }
            strVal += descContent[i]
          }
          descText = strVal
          armRegex.lastIndex = i + 1
        } else {
          const commaIndex = descContent.indexOf(',', valueStartIndex)
          if (commaIndex !== -1) {
            descText = descContent.substring(valueStartIndex, commaIndex).trim()
            armRegex.lastIndex = commaIndex + 1
          }
        }
        
        descText = descText.replace(/\s+/g, ' ').trim()
        
        for (const v of variants) {
          descMap.set(v.trim(), descText)
        }
      }
    }

    const cleanEnumContent = enumContent.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const variantRegex = /(?:#\[strum\(([^)]+)\)\]\s*)?\b([A-Z][A-Za-z0-9]+)\b/g
    const results = []
    let vMatch;
    while ((vMatch = variantRegex.exec(cleanEnumContent)) !== null) {
      const attr = vMatch[1] ? vMatch[1].trim() : ''
      const variantName = vMatch[2].trim()

      let commandWord = ''
      if (attr) {
        const toStringMatch = attr.match(/to_string\s*=\s*"([^"]+)"/)
        const serializeMatch = attr.match(/serialize\s*=\s*"([^"]+)"/)
        if (toStringMatch) {
          commandWord = toStringMatch[1]
        } else if (serializeMatch) {
          commandWord = serializeMatch[1]
        }
      }

      if (!commandWord) {
        commandWord = pascalToKebab(variantName)
      }

      const description = descMap.get(variantName) || ''
      const hasInlineArgs = inlineVariants.has(variantName)

      results.push({
        command: commandWord,
        description,
        argumentHint: hasInlineArgs ? ' <参数>' : undefined
      })
    }

    return results
}
console.log(JSON.stringify(parseSlashCommands(getRsPath()), null, 2))
