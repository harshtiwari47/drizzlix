const fs = require('fs');

const filesToProcess = {
  // 1. Heading Gradients
  'src/pages/Discover.jsx': (content) => content.replace(/linear-gradient\(135deg,\s*#ffffff\s*0%,\s*#a5b4fc\s*100%\)/g, 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)'),
  'src/pages/CreateDeck.jsx': (content) => content.replace(/linear-gradient\(135deg,\s*#ffffff\s*0%,\s*#a5b4fc\s*100%\)/g, 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)'),
  'src/pages/DeckLibrary.jsx': (content) => {
    let c = content.replace(/linear-gradient\(135deg,\s*#ffffff\s*0%,\s*#a5b4fc\s*100%\)/g, 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)');
    // 4 & 5. Due Buttons & Nodes label, 6 & 7. Dropdown Menus
    c = c.replace(/#22c55e|#4ade80/g, 'var(--success)');
    c = c.replace(/#facc15|#fbbf24/g, 'var(--warning)');
    c = c.replace(/#ef4444|#f87171|#fca5a5/g, 'var(--danger)');
    c = c.replace(/#9ca3af/g, 'var(--text-secondary)');
    c = c.replace(/rgba\(20,\s*20,\s*20,\s*0\.9\)/g, 'var(--glass-surface-solid)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.1\)/g, 'var(--card-border)');
    return c;
  },
  'src/pages/NotesPage.jsx': (content) => {
    let c = content.replace(/linear-gradient\(135deg,\s*#ffffff\s*0%,\s*#a5b4fc\s*100%\)/g, 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)');
    // 10. Fixes in NotesPage
    c = c.replace(/#ffffff/gi, 'var(--text-primary)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.[4-7]\)/g, 'var(--text-secondary)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.0[1-5]\)/g, 'var(--card-bg)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.0[6-9]\)/g, 'var(--card-hover)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.1[0-5]?\)/g, 'var(--card-border)');
    c = c.replace(/rgba\(0,\s*0,\s*0,\s*0\.8[0-9]?\)/g, 'var(--shadow-color)');
    c = c.replace(/rgba\(10,\s*10,\s*10,\s*0\.9\)/g, 'var(--glass-surface-solid)');
    return c;
  },
  // 9. Active Date
  'src/pages/TasksPage.jsx': (content) => content.replace(/color:\s*isSelected\(d\)\s*\?\s*['"]white['"]\s*:\s*['"]var\(--text-secondary\)['"]/g, "color: isSelected(d) ? 'var(--text-primary)' : 'var(--text-secondary)'"),

  // 2. Nav Item Active
  'src/components/Sidebar.css': (content) => {
    let c = content.replace(/color:\s*#ffffff;/g, 'color: var(--text-primary);');
    c = c.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.04\);/g, 'background: var(--card-hover);');
    c = c.replace(/linear-gradient\(90deg,\s*transparent,\s*#fff,\s*transparent\)/g, 'linear-gradient(90deg, transparent, var(--text-primary), transparent)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.8\)/g, 'var(--text-secondary)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.4\)/g, 'var(--card-border)');
    return c;
  },

  // 3. Model Selector Btn
  'src/components/AICommandInput.css': (content) => {
    let c = content.replace(/background:\s*rgba\(30,30,30,0\.6\);/g, 'background: var(--input-bg);');
    c = c.replace(/border:\s*1px solid rgba\(255,255,255,0\.08\);/g, 'border: 1px solid var(--input-border);');
    c = c.replace(/background:\s*rgba\(50,50,50,0\.8\);/g, 'background: var(--card-hover);');
    c = c.replace(/border-color:\s*rgba\(255,255,255,0\.2\);/g, 'border-color: var(--outline);');
    return c;
  },

  // 8. Create Deck Form & CreateDeck.css
  'src/pages/CreateDeck.css': (content) => {
    let c = content;
    c = c.replace(/#FFFFFF|#fff/gi, 'var(--text-primary)');
    c = c.replace(/#000/g, 'var(--text-inverse)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.0[1-5]\)/g, 'var(--card-bg)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.0[6-9]\)/g, 'var(--card-hover)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.1[0-5]?\)/g, 'var(--card-border)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.2[0-9]?\)/g, 'var(--outline)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.3\)/g, 'var(--outline)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.[4-7][0-9]?\)/g, 'var(--text-secondary)');
    c = c.replace(/rgba\(255,\s*255,\s*255,\s*0\.9[0-9]?\)/g, 'var(--text-primary)');
    
    // Custom colors in CreateDeck.css
    c = c.replace(/rgba\(147,\s*197,\s*253,\s*0\.95\)/g, 'var(--accent-primary)');
    c = c.replace(/rgba\(147,\s*197,\s*253,\s*0\.5\)/g, 'var(--accent-primary)');
    c = c.replace(/rgba\(147,\s*197,\s*253,\s*0\.65\)/g, 'var(--focus-ring)');
    c = c.replace(/rgba\(10,\s*10,\s*10,\s*0\.6\)/g, 'var(--glass-surface-solid)');
    c = c.replace(/#0a0a0a/g, 'var(--bg-color)');
    c = c.replace(/rgba\(15,\s*15,\s*15,\s*0\.85\)/g, 'var(--glass-surface-solid)');
    c = c.replace(/rgba\(10,\s*10,\s*10,\s*0\.92\)/g, 'var(--scrollbar-track)');
    c = c.replace(/rgba\(120,\s*120,\s*120,\s*0\.62\)/g, 'var(--scrollbar-thumb)');
    c = c.replace(/rgba\(0,\s*0,\s*0,\s*0\.[3-8]\)/g, 'var(--shadow-color)');
    c = c.replace(/rgba\(12,\s*12,\s*12,\s*0\.6\)/g, 'var(--glass-surface-solid)');
    c = c.replace(/rgba\(148,\s*163,\s*184,\s*0\.[2-5][0-9]?\)/g, 'var(--outline)');
    c = c.replace(/#cbd5e1|#e2e8f0/g, 'var(--text-primary)');
    c = c.replace(/rgba\(15,\s*23,\s*42,\s*0\.4\)/g, 'var(--input-bg)');
    c = c.replace(/rgba\(30,\s*41,\s*59,\s*0\.56\)/g, 'var(--card-hover)');
    c = c.replace(/rgba\(96,\s*165,\s*250,\s*0\.46\)/g, 'var(--accent-primary)');
    c = c.replace(/rgba\(30,\s*64,\s*175,\s*0\.2\)/g, 'var(--badge-bg)');
    c = c.replace(/#bfdbfe/g, 'var(--badge-text)');
    
    // Danger colors
    c = c.replace(/#fda4af|#ff4444/gi, 'var(--danger)');
    c = c.replace(/rgba\(255,\s*68,\s*68,\s*0\.6\)/g, 'var(--danger)');
    c = c.replace(/rgba\(255,\s*68,\s*68,\s*0\.1\)/g, 'rgba(var(--danger-rgb), 0.1)'); // Requires fallback if rgb not present, we will just use var(--danger) with 0.2 opacity? The theme doesn't have --danger-rgb. Let's just map it to danger or outline.
    c = c.replace(/rgba\(255,\s*68,\s*68,\s*0\.1\)/g, 'var(--badge-bg)');
    c = c.replace(/rgba\(251,\s*113,\s*133,\s*0\.35\)/g, 'var(--danger)');
    c = c.replace(/rgba\(159,\s*18,\s*57,\s*0\.18\)/g, 'var(--badge-bg)');
    
    c = c.replace(/#9ca3af/g, 'var(--text-secondary)');
    c = c.replace(/rgba\(209,\s*213,\s*219,\s*0\.[78][0-9]?\)/g, 'var(--outline)');
    return c;
  }
};

for (const [filePath, replaceFn] of Object.entries(filesToProcess)) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = replaceFn(content);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  } else {
    console.warn(`File not found: ${filePath}`);
  }
}
