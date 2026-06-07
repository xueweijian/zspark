const fs = require('fs');
const path = 'E:/go-project/zspark/desktop/src/renderer/App.tsx';
let c = fs.readFileSync(path, 'utf8');
const NL = c.includes('\r\n') ? '\r\n' : '\n';

const openTag = '<div className="slash-commands-menu">';
const openIdx = c.indexOf(openTag);
if (openIdx === -1) { console.log('open tag not found'); process.exit(1); }

const mapStart = c.indexOf('{filteredSlashCommands.map', openIdx);
if (mapStart === -1) { console.log('map not found'); process.exit(1); }

const lineStart = c.lastIndexOf('\n', mapStart) + 1;
const baseIndent = c.substring(lineStart, mapStart).match(/^\s*/)[0];

// Find ))}\n<baseIndent></div> after mapStart
const closeSearch = '))}' + NL + baseIndent + '</div>';
const closeIdx = c.indexOf(closeSearch, mapStart);
if (closeIdx === -1) { console.log('closing not found. baseIndent=[' + baseIndent + '] len=' + baseIndent.length); process.exit(1); }

const endIdx = closeIdx + closeSearch.length;

const newBlock = openTag + NL +
  baseIndent + '<div className="slash-commands-list">' + NL +
  baseIndent + '  {filteredSlashCommands.map((cmd, idx) => (' + NL +
  baseIndent + '    <div' + NL +
  baseIndent + '      key={cmd.command}' + NL +
  baseIndent + '      className={`slash-command-item ${idx === suggestionSelectedIndex ? \x27active\x27 : \x27\x27}}`}' + NL +
  baseIndent + '      onClick={() => executeSlashCommand(cmd)}' + NL +
  baseIndent + '    >' + NL +
  baseIndent + '      <span className="command-name">/{cmd.command}</span>' + NL +
  baseIndent + '      {cmd.argumentHint && <span className="command-hint">{cmd.argumentHint}</span>}' + NL +
  baseIndent + '      <span className="command-desc">{cmd.description}</span>' + NL +
  baseIndent + '    </div>' + NL +
  baseIndent + '  ))}' + NL +
  baseIndent + '</div>' + NL +
  baseIndent + '<div className="slash-commands-hints">' + NL +
  baseIndent + '  <kbd>\u2191\u2193</kbd><span>\u5BFC\u822A</span>' + NL +
  baseIndent + '  <kbd>Enter</kbd><span>\u9009\u62E9</span>' + NL +
  baseIndent + '  <kbd>Esc</kbd><span>\u5173\u95ED</span>' + NL +
  baseIndent + '</div>' + NL +
  baseIndent + '</div>';

c = c.substring(0, openIdx) + newBlock + c.substring(endIdx);
fs.writeFileSync(path, c, 'utf8');
console.log('OK - replaced slash menu JSX');
