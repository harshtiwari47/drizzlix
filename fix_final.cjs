const fs = require('fs');

// 1. Fix themeService.js
const themeFile = 'src/services/themeService.js';
let themeContent = fs.readFileSync(themeFile, 'utf8');

// Pastel adjustments to avoid stark white cards on `#fdf6f0` bg
themeContent = themeContent.replace(
  /'--card-bg':\s*'rgba\(255,\s*255,\s*255,\s*0\.7\)'/g,
  "'--card-bg': 'rgba(255, 255, 255, 0.35)'" // less opaque white blends better with pastel bg
);
themeContent = themeContent.replace(
  /'--input-bg':\s*'rgba\(255,\s*255,\s*255,\s*0\.5\)'/g,
  "'--input-bg': 'rgba(255, 255, 255, 0.25)'"
);

// Light theme adjustments
themeContent = themeContent.replace(
  /'--card-bg':\s*'rgba\(255,\s*255,\s*255,\s*0\.9\)'/g,
  "'--card-bg': 'rgba(255, 255, 255, 0.6)'"
);

// Midnight Theme extra variables? We could add `--scrollbar-thumb` directly in elements, but they are already vars.
fs.writeFileSync(themeFile, themeContent, 'utf8');
console.log('Fixed themeService.js');

// 2. Fix Discover/DeckLibrary/NotesPage/Settings/CreateDeck title-sparkle-effect
const fixSparkle = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // The generic regex didn't catch things with specific vars or `WebkitTextFillColor`.
  content = content.replace(/background:\s*['"]linear-gradient\(180deg,\s*#fff\s*0%,\s*(#9ca3af|var\(--text-secondary\))\s*100%\)['"]/g, "background: 'linear-gradient(180deg, var(--text-primary) 0%, var(--text-secondary) 100%)'");
  content = content.replace(/background:\s*['"]linear-gradient\(180deg,\s*var\(--text-primary\)\s*0%,\s*var\(--secondary\)\s*100%\)['"]/g, "background: 'linear-gradient(180deg, var(--text-primary) 0%, var(--text-secondary) 100%)'");
  content = content.replace(/color=["']rgba\(147,\s*197,\s*253,\s*0\.95\)["']/g, 'color="var(--accent-primary)"');
  content = content.replace(/filter:\s*['"]drop-shadow\(0 0 10px rgba\(147,\s*197,\s*253,\s*0\.5\)\)['"]/g, "filter: 'drop-shadow(0 0 10px var(--accent-secondary))'");
  content = content.replace(/color:\s*['"]black['"]/g, "color: 'var(--text-inverse)'");

  fs.writeFileSync(filePath, content, 'utf8');
};

['src/pages/Discover.jsx', 'src/pages/DeckLibrary.jsx', 'src/pages/NotesPage.jsx', 'src/pages/CreateDeck.jsx', 'src/pages/Settings.jsx', 'src/pages/Mastery.jsx'].forEach(fixSparkle);
console.log('Fixed sparkle effects');

// 3. Fix NotesPage.jsx (massive hardcoded colors)
let notesPath = 'src/pages/NotesPage.jsx';
let notesContent = fs.readFileSync(notesPath, 'utf8');
notesContent = notesContent.replace(/rgba\(5,\s*5,\s*15,\s*0\.[34]5?\)/g, 'var(--card-bg)');
notesContent = notesContent.replace(/rgba\(10,\s*10,\s*20,\s*0\.3\)/g, 'var(--glass-surface-solid)');
notesContent = notesContent.replace(/border:\s*['"]1px solid #444['"]/g, "border: '1px solid var(--outline)'");
notesContent = notesContent.replace(/border:\s*['"]1px solid #555['"]/g, "border: '1px solid var(--outline)'");
notesContent = notesContent.replace(/color:\s*['"]rgba\(231,\s*246,\s*255,\s*0\.96\)['"]/g, "color: 'var(--text-primary)'");
notesContent = notesContent.replace(/color:\s*['"]rgba\(255,\s*255,\s*255,\s*1\)['"]/g, "color: 'var(--text-primary)'");
notesContent = notesContent.replace(/color:\s*['"]violet['"]/g, "color: 'var(--accent-primary)'");
notesContent = notesContent.replace(/scrollbarColor:\s*['"]rgba\(120,120,120,0\.62\)\s*rgba\(10,10,10,0\.92\)['"]/g, "scrollbarColor: 'var(--scrollbar-thumb) var(--scrollbar-track)'");
fs.writeFileSync(notesPath, notesContent, 'utf8');
console.log('Fixed NotesPage');

// 4. Fix Due buttons in DeckLibrary.jsx
let deckLibPath = 'src/pages/DeckLibrary.jsx';
let deckLibContent = fs.readFileSync(deckLibPath, 'utf8');
deckLibContent = deckLibContent.replace(/rgba\(217,\s*119,\s*6,\s*0\.12\)/g, 'var(--badge-bg)');
fs.writeFileSync(deckLibPath, deckLibContent, 'utf8');
console.log('Fixed DeckLibrary due buttons');

