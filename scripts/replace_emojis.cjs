const fs = require('fs');
const path = require('path');

const emojiMap = {
  '📋': 'ClipboardList', '🎬': 'Clapperboard', '🎨': 'Palette', '⚡': 'Zap',
  '👤': 'User', '📸': 'Camera', '📐': 'Ruler', '🏠': 'Home', '🔧': 'Wrench',
  '🌅': 'Sunrise', '🛸': 'Ufo', '🔍': 'Search', '🌐': 'Globe', '📝': 'FileText',
  '💥': 'Flame', '🌙': 'Moon', '✨': 'Sparkles', '📷': 'Camera', '🌀': 'Tornado',
  '🖼️': 'Image', '🔄': 'RefreshCw', '🗣️': 'Mic', '🎵': 'Music', '🎙️': 'Mic',
  '🧊': 'Box', '✏️': 'Pencil', '🔊': 'Volume2', '👄': 'Smile', '✕': 'X',
  '✅': 'CheckCircle', '✓': 'Check', '💾': 'Save', '❌': 'XCircle', '🎭': 'Theater',
  '🛠️': 'PenTool', '🌍': 'Globe', '⚠️': 'AlertTriangle', '🚀': 'Rocket', '✔️': 'Check',
  '✖️': 'X', '💡': 'Lightbulb', '📜': 'ScrollText', '👁️': 'Eye', '🔥': 'Flame',
  '🗑️': 'Trash2', '📦': 'Package', '📁': 'Folder', '🏙️': 'Building', '🎥': 'Video',
  '🧪': 'FlaskConical', '🕸️': 'Network',
  // strip some invisible characters if needed
  '🖼': 'Image', '🗣': 'Mic', '🎙': 'Mic', '✏': 'Pencil', '🛠': 'PenTool', '⚠': 'AlertTriangle', '✔': 'Check', '✖': 'X', '👁': 'Eye', '🗑': 'Trash2', '🕸': 'Network', '🏙': 'Building'
};

const mapEntries = Object.entries(emojiMap);

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let usedIcons = new Set();
  
  // We will do a generic replacement of emojis outside of strings, or just string literals to JSX?
  // Actually, some emojis are in string literals like icon: '🎬'. If we replace that with `<Clapperboard size={14} />`, it will be a JSX element instead of a string. That works for ENHANCE_PRESETS.
  // For emojis inside JSX text like `> 🎬 Director <`, it becomes `> <Clapperboard size={16} /> Director <`.
  
  // Custom manual replace for ENHANCE_PRESETS icon strings
  mapEntries.forEach(([emoji, icon]) => {
    const rxStr = new RegExp(`icon:\\s*['"\`]${emoji}['"\`]`, 'gu');
    if (rxStr.test(content)) {
      usedIcons.add(icon);
      content = content.replace(rxStr, `icon: <${icon} size={14} />`);
    }

    // General text replacement for JSX
    const rxJsx = new RegExp(`>\\s*${emoji}\\s*<`, 'gu');
    if (rxJsx.test(content)) {
      usedIcons.add(icon);
      content = content.replace(rxJsx, `><${icon} size={16} className="lucide-icon" /><`);
    }
    
    const rxJsxLeft = new RegExp(`>\\s*${emoji}\\s+`, 'gu');
    if (rxJsxLeft.test(content)) {
      usedIcons.add(icon);
      content = content.replace(rxJsxLeft, `><${icon} size={16} className="lucide-icon" /> `);
    }

    const rxJsxRight = new RegExp(`\\s+${emoji}\\s*<`, 'gu');
    if (rxJsxRight.test(content)) {
      usedIcons.add(icon);
      content = content.replace(rxJsxRight, ` <${icon} size={16} className="lucide-icon" /><`);
    }
    
    // Sometimes it's just raw inside tags without spaces
    const rxRaw = new RegExp(`(?<=[>\\s])${emoji}(?=[<\\s])`, 'gu');
    if (rxRaw.test(content)) {
        usedIcons.add(icon);
        content = content.replace(rxRaw, `<${icon} size={16} className="lucide-icon" />`);
    }
  });

  if (usedIcons.size > 0) {
    const importStr = `import { ${Array.from(usedIcons).join(', ')} } from 'lucide-react';\n`;
    // insert right after other imports
    const rxImport = /import .* from '.*';\n/g;
    let lastMatch;
    while ((match = rxImport.exec(content)) !== null) {
      lastMatch = match;
    }
    if (lastMatch) {
      const idx = lastMatch.index + lastMatch[0].length;
      content = content.slice(0, idx) + importStr + content.slice(idx);
    } else {
      content = importStr + content;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath} with ${usedIcons.size} icons.`);
  } else {
    console.log(`No updates for ${filePath}.`);
  }
}

['src/App.jsx', 'src/NodeCanvas.jsx', 'src/StepExport.jsx'].forEach(p => {
  if (fs.existsSync(p)) processFile(p);
});
