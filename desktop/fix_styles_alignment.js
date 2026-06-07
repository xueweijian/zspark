const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'renderer', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 统一将 \r\n 转换为 \n
css = css.replace(/\r\n/g, '\n');

// 1. 替换消息流（chat-stream）和消息包裹层、卡片样式的核心部分
const targetSegment = `.chat-stream {
  flex: 1;
  overflow-y: auto;
  padding: 32px 0 20px !important;
  display: flex;
  flex-direction: column;
  gap: 16px !important;
  background: linear-gradient(180deg, #fafbfd 0%, #ffffff 50%, #fafbfd 100%) !important;
}

.message-wrap {
  width: 100% !important;
  max-width: 900px !important;
  margin: 0 auto !important;
  padding: 0 24px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important; /* 统一左对齐 */
  align-self: center !important;
  gap: 8px !important;
  box-sizing: border-box !important;
}

.bubble {
  max-width: 100% !important;
  font-size: 14.5px !important;
  line-height: 1.65 !important;
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
  overflow-wrap: anywhere !important;
}

.bubble.user {
  background: var(--cm-surface-bubble-user) !important;
  color: #1e40af !important; /* 用户气泡深蓝色 */
  padding: 12px 18px !important;
  border-radius: 16px !important;
  border: 1px solid rgba(77, 153, 255, 0.2) !important;
  box-shadow: 0 4px 12px rgba(77, 153, 255, 0.04) !important;
}

.bubble.assistant {
  color: var(--cm-text-primary) !important;
  width: 100% !important;
  white-space: normal !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 4px 0 4px 16px !important;
  border-left: 2px solid rgba(15, 23, 36, 0.08) !important; /* 左侧微弱线条 */
}

/* 原有 user 的 actions 需要在居左后保持靠左 */
.message-wrap .message-actions {
  left: 24px !important;
  right: auto !important;
}

/* 3. 步骤日志（Activity Card）垂直树状微缩列表 */
.activity-card {
  align-self: center !important;
  width: 100% !important;
  max-width: 900px !important;
  margin: 8px auto !important;
  padding: 0 24px !important;
  box-sizing: border-box !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  overflow: visible !important;
}`;

const replacementSegment = `.chat-stream {
  flex: 1;
  overflow-y: auto;
  padding: 32px 24px 20px !important;
  display: flex;
  flex-direction: column;
  gap: 16px !important;
  background: linear-gradient(180deg, #fafbfd 0%, #ffffff 50%, #fafbfd 100%) !important;
}

.message-wrap {
  width: 100% !important;
  max-width: 900px !important;
  margin: 0 auto !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  gap: 8px !important;
}

.message-wrap.assistant {
  align-self: center !important;
  align-items: flex-start !important;
}

.message-wrap.user {
  align-self: center !important;
  align-items: flex-end !important;
}

.bubble {
  max-width: 100% !important;
  font-size: 14.5px !important;
  line-height: 1.65 !important;
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
  overflow-wrap: anywhere !important;
}

.bubble.user {
  max-width: 78% !important;
  background: var(--cm-surface-bubble-user) !important;
  color: #1e40af !important; /* 用户气泡深蓝色 */
  padding: 12px 18px !important;
  border-radius: 16px !important;
  border: 1px solid rgba(77, 153, 255, 0.2) !important;
  box-shadow: 0 4px 12px rgba(77, 153, 255, 0.04) !important;
}

.bubble.assistant {
  color: var(--cm-text-primary) !important;
  width: 100% !important;
  white-space: normal !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 4px 0 4px 16px !important;
  border-left: 2px solid rgba(15, 23, 36, 0.08) !important; /* 左侧微弱线条 */
}

.message-wrap.assistant .message-actions {
  left: 16px !important;
  right: auto !important;
}

.message-wrap.user .message-actions {
  right: 0 !important;
  left: auto !important;
}

/* 3. 步骤日志（Activity Card）垂直树状微缩列表 */
.activity-card {
  align-self: center !important;
  width: 100% !important;
  max-width: 900px !important;
  margin: 8px auto !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  overflow: visible !important;
}`;

const normTarget = targetSegment.replace(/\r\n/g, '\n');
const normReplacement = replacementSegment.replace(/\r\n/g, '\n');

if (css.includes(normTarget)) {
  css = css.replace(normTarget, normReplacement);
  console.log('Successfully found and replaced the core layout segment.');
} else {
  console.log('Target segment not matched exactly. Attempting regex match...');
  
  // 备用正则替换
  css = css.replace(/padding:\s*32px\s*0\s*20px\s*!important;/g, 'padding: 32px 24px 20px !important;');
  css = css.replace(
    /\.message-wrap\s*\{([^}]+)\}/,
    `.message-wrap {
  width: 100% !important;
  max-width: 900px !important;
  margin: 0 auto !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  gap: 8px !important;
}`
  );

  if (!css.includes('.message-wrap.assistant')) {
    css = css.replace(
      /\.message-wrap\s*\{[^}]+\}/,
      match => match + '\n\n.message-wrap.assistant {\n  align-self: center !important;\n  align-items: flex-start !important;\n}\n\n.message-wrap.user {\n  align-self: center !important;\n  align-items: flex-end !important;\n}'
    );
  }

  css = css.replace(
    /\.bubble\.user\s*\{([^}]+)\}/,
    (match, p1) => {
      if (!p1.includes('max-width')) {
        return `.bubble.user {\n  max-width: 78% !important;${p1}}`;
      }
      return match;
    }
  );

  css = css.replace(
    /\.message-wrap\s+\.message-actions\s*\{[^}]+\}/g,
    `.message-wrap.assistant .message-actions {
  left: 16px !important;
  right: auto !important;
}

.message-wrap.user .message-actions {
  right: 0 !important;
  left: auto !important;
}`
  );

  css = css.replace(
    /\.activity-card\s*\{([^}]+)\}/,
    `.activity-card {
  align-self: center !important;
  width: 100% !important;
  max-width: 900px !important;
  margin: 8px auto !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  overflow: visible !important;
}`
  );
}

// 2. 兜底样式追加（审批卡和文件卡），先排重
const finalDoodle = `\n\n/* 兜底对齐：审批卡和生成文件卡 */\n.approval-card,\n.artifact-card {\n  align-self: center !important;\n  width: 100% !important;\n  max-width: 900px !important;\n  margin: 8px auto !important;\n  box-sizing: border-box !important;\n}\n`;
if (!css.includes('.approval-card,') && !css.includes('.artifact-card {') || !css.includes('兜底对齐')) {
  css += finalDoodle;
  console.log('Appended backup alignment styles.');
}

// 在 Windows 环境上将 \n 转换回 \r\n 以保持文件原有行尾风格
fs.writeFileSync(cssPath, css.replace(/\n/g, '\r\n'), 'utf8');
console.log('Done modifying styles.css');
