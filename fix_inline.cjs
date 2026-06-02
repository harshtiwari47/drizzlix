const fs = require('fs');

const fixJSX = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  let c = fs.readFileSync(filePath, 'utf8');
  // We need to strip: `background: 'linear-gradient(180deg, var(--text-primary) 0%, var(--text-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', `
  c = c.replace(/background:\s*['"]linear-gradient[^"']+['"],\s*WebkitBackgroundClip:\s*['"]text['"],\s*WebkitTextFillColor:\s*['"]transparent['"],?/g, '');
  
  // also strip any leftover shadows in icons that might not have matched exactly
  c = c.replace(/color=["']rgba\(147,\s*197,\s*253,\s*0\.95\)["']/gi, 'color="var(--accent-primary)"');
  c = c.replace(/style=\{\{\s*filter:\s*['"]drop-shadow[^'"]+['"]\s*\}\}/g, '');
  
  fs.writeFileSync(filePath, c, 'utf8');
};

['src/pages/Discover.jsx', 'src/pages/DeckLibrary.jsx', 'src/pages/NotesPage.jsx', 'src/pages/CreateDeck.jsx', 'src/pages/Settings.jsx', 'src/pages/Mastery.jsx', 'src/pages/Dashboard.jsx'].forEach(fixJSX);
console.log('Stripped inline styles');
