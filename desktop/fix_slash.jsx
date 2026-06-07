const fs = require('fs');
let c = fs.readFileSync('E:/go-project/zspark/desktop/src/renderer/App.tsx', 'utf8');

const oldStr = '<div className="slash-commands-menu">\n              {filteredSlashCommands.map';
const idx = c.indexOf(oldStr);
if (idx === -1) { console.log('NOT FOUND'); process.exit(1); }

// Find the matching closing </div> for slash-commands-menu
const menuStart = idx;
let depth = 0;
let menuEnd = -1;
let inStr = false;
let i = c.indexOf('>', menuStart) + 1; // skip the opening tag
debugger;
for (; i < c.length; i++) {
  const ch = c[i];
  if (ch === '"' && (i === 0 || c[i-1] !== '\\')) inStr = !inStr;
  if (inStr) continue;
  if (ch === '{') depth++;
  else if (ch === '}') depth--;
  // Look for the closing pattern: )}\n            </div>\n          )}
  if (depth === 0 && c.substring(i, i+20) === ')}\n            </div>') {
    menuEnd = i + 20;
    break;
  }
}
if (menuEnd === -1) { console.log('CLOSING NOT FOUND'); process.exit(1); }

const oldBlock = c.substring(menuStart, menuEnd);
console.log('OLD BLOCK (' + oldBlock.length + ' chars):');
console.log(oldBlock);
