const fs = require('fs');
const path = 'E:/go-project/zspark/desktop/src/renderer/styles.css';
let c = fs.readFileSync(path, 'utf8');
const NL = c.includes('\r\n') ? '\r\n' : '\n';

const newCSS = `/* 斜杠命令弹出菜单 */
.slash-commands-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1000;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 10px 40px rgba(15,23,42,.12), 0 2px 6px rgba(15,23,42,.08);
}

.slash-commands-list {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.slash-command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.slash-command-item:hover,
.slash-command-item.active {
  background: var(--surface-hover);
}

.slash-command-item .command-name {
  flex-shrink: 0;
  min-width: 100px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--accent);
}

.slash-command-item .command-hint {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--muted);
  background: var(--surface-soft);
  padding: 2px 6px;
  border-radius: 4px;
}

.slash-command-item .command-desc {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slash-commands-hints {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  background: var(--surface-soft);
  font-size: 11px;
  color: var(--muted);
}

.slash-commands-hints kbd {
  display: inline-block;
  padding: 2px 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.slash-commands-hints span {
  color: var(--muted);
}

/* Skills suggestion menu */
.skills-suggestions-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1000;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 10px 40px rgba(15,23,42,.12), 0 2px 6px rgba(15,23,42,.08);
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.skill-suggestion-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.skill-suggestion-item:hover,
.skill-suggestion-item.active {
  background: var(--surface-hover);
}

.skill-suggestion-item svg {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--accent);
}

.skill-suggestion-item .skill-name {
  flex-shrink: 0;
  min-width: 100px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-strong);
}

.skill-suggestion-item .skill-desc {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`;

// Find and remove first block (L866-L902 area)
const startMarker = '.slash-commands-menu {';
const startIdx1 = c.indexOf(startMarker);
if (startIdx1 === -1) { console.log('first block not found'); process.exit(1); }
const lineStart1 = c.lastIndexOf(NL, startIdx1) + 1;

// Find end of first block - look for empty line after .slash-command-item .command-desc
let endIdx1 = c.indexOf('}', c.indexOf('.command-desc {', startIdx1)) + 1;
const afterBlock1 = c.substring(endIdx1, endIdx1 + 10);
if (afterBlock1.startsWith(NL)) endIdx1 += NL.length; // skip trailing newline

// Remove first block
c = c.substring(0, lineStart1) + c.substring(endIdx1);

// Now find second block - look for ".slash-commands-menu," or ".skills-suggestions-menu"
const secondMarker = '.slash-commands-menu,';
const startIdx2 = c.indexOf(secondMarker);
if (startIdx2 === -1) { console.log('second block not found'); process.exit(1); }
const lineStart2 = c.lastIndexOf(NL, startIdx2) + 1;

// Find end of second block - after ".active {" closing brace and NL
const activeMatch = '.active {';
let searchPos = startIdx2;
for (let i = 0; i < 4; i++) { searchPos = c.indexOf(activeMatch, searchPos) + 1; }
const endIdx2 = c.indexOf('}', searchPos) + 1;
const afterBlock2 = c.substring(endIdx2, endIdx2 + 10);
if (afterBlock2.startsWith(NL)) { /* include the trailing newline */ }

// Replace second block with new CSS
c = c.substring(0, lineStart2) + newCSS + c.substring(endIdx2 + (afterBlock2.startsWith(NL) ? NL.length : 0));

fs.writeFileSync(path, c, 'utf8');
console.log('OK - CSS replaced');
