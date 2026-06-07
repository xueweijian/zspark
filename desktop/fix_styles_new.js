const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'renderer', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. approval-card
css = css.replace(
  /\.approval-card\{align-self:flex-start;width:min\(900px,100%\);/g,
  '.approval-card{align-self:center;margin:0 auto;width:100%;max-width:900px;box-sizing:border-box;'
);

// 2. act-detail and act-terminal
css = css.replace(
  /(\.act-detail\s*\{[^}]*max-height:\s*240px\s*!important;\s*)\}/g,
  '$1  overflow-y: auto !important;\n}\n\n.act-terminal {\n  background: #1e1e1e !important;\n  color: #cccccc !important;\n  border: 1px solid #333 !important;\n  border-left: 3px solid #666 !important;\n}'
);

// 3. chat-input-wrap padding
css = css.replace(
  /--composer-padding-x:\s*max\(15%,\s*80px\)\s*!important;[\s\r\n]*padding:\s*16px\s*var\(--composer-padding-x\)\s*20px\s*!important;/g,
  'padding: 16px 24px 20px !important;'
);

// 4. chat-input max-width
css = css.replace(
  /\.chat-input\s*\{\s*display:\s*flex\s*!important;/g,
  '.chat-input {\n  display: flex !important;\n  max-width: 900px !important;\n  width: 100% !important;\n  margin: 0 auto !important;\n  box-sizing: border-box !important;'
);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS Fixed');
