const fs = require('fs');

// 1. App.css: title-sparkle-effect (move gradient to class, remove SVG shadow)
let appCssPath = 'src/App.css';
let appCss = fs.readFileSync(appCssPath, 'utf8');

// The class currently looks like:
// .title-sparkle-effect { position: relative; ... }
// We add background and text clipping
appCss = appCss.replace(/\.title-sparkle-effect\s*\{/g, `.title-sparkle-effect {
  background: linear-gradient(180deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`);

// SVG shadow remove? The SVGs are in JSX inline styles. I will strip them from JSX instead.
fs.writeFileSync(appCssPath, appCss, 'utf8');

// 2. Discover.jsx fixes
let discoverPath = 'src/pages/Discover.jsx';
if (fs.existsSync(discoverPath)) {
  let c = fs.readFileSync(discoverPath, 'utf8');
  // Remove shadow of SVG icon from heading
  c = c.replace(/color=["']var\(--accent-primary\)["']\s*style=\{\{\s*filter:\s*['"]drop-shadow\(0 0 10px var\(--accent-secondary\)\)['"]\s*\}\}/g, 'color="var(--accent-primary)" style={{}}');
  c = c.replace(/color=["']rgba\(147,197,253,0\.95\)["']\s*style=\{\{\s*filter:\s*['"]drop-shadow\(0 0 10px rgba\(147,197,253,0\.5\)\)['"]\s*\}\}/g, 'color="var(--accent-primary)" style={{}}');
  
  // app-content-visibility-grid card shadow
  c = c.replace(/boxShadow:\s*['"]0 8px 30px rgba\(0,0,0,0\.4\)['"]/g, "boxShadow: 'var(--shadow-color) 0px 4px 10px -5px'");
  
  // discover buttons `All 3`
  c = c.replace(/background:\s*['"]rgba\(147,\s*197,\s*253,\s*0\.14\)['"]/g, "background: 'var(--badge-bg)'");
  c = c.replace(/color:\s*['"]rgb\(219,\s*234,\s*254\)['"]/g, "color: 'var(--badge-text)'");
  c = c.replace(/background:\s*['"]rgba\(0,\s*0,\s*0,\s*0\.2\)['"]/g, "background: 'var(--card-hover)'");
  c = c.replace(/background:\s*['"]rgba\(99,\s*179,\s*237,\s*0\.1\)['"]/g, "background: 'var(--badge-bg)'");
  c = c.replace(/border:\s*['"]1px solid rgba\(99,\s*179,\s*237,\s*0\.35\)['"]/g, "border: '1px solid var(--accent-primary)'");
  
  fs.writeFileSync(discoverPath, c, 'utf8');
}

// 3. DeckLibrary.jsx fixes
let deckLibPath = 'src/pages/DeckLibrary.jsx';
if (fs.existsSync(deckLibPath)) {
  let c = fs.readFileSync(deckLibPath, 'utf8');
  c = c.replace(/color=["']var\(--accent-primary\)["']\s*style=\{\{\s*filter:\s*['"]drop-shadow\(0 0 10px var\(--accent-secondary\)\)['"]\s*\}\}/g, 'color="var(--accent-primary)" style={{}}');
  c = c.replace(/color=["']rgba\(147,197,253,0\.95\)["']\s*style=\{\{\s*filter:\s*['"]drop-shadow\(0 0 10px rgba\(147,197,253,0\.5\)\)['"]\s*\}\}/g, 'color="var(--accent-primary)" style={{}}');
  fs.writeFileSync(deckLibPath, c, 'utf8');
}

// 4. NotesPage.jsx fixes
let notesPath = 'src/pages/NotesPage.jsx';
if (fs.existsSync(notesPath)) {
  let c = fs.readFileSync(notesPath, 'utf8');
  c = c.replace(/color=["']var\(--accent-primary\)["']\s*style=\{\{\s*filter:\s*['"]drop-shadow\(0 0 10px var\(--accent-secondary\)\)['"]\s*\}\}/g, 'color="var(--accent-primary)" style={{}}');
  c = c.replace(/color=["']rgba\(147,197,253,0\.95\)["']\s*style=\{\{\s*filter:\s*['"]drop-shadow\(0 0 10px rgba\(147,197,253,0\.5\)\)['"]\s*\}\}/g, 'color="var(--accent-primary)" style={{}}');
  fs.writeFileSync(notesPath, c, 'utf8');
}

// 5. Dashboard / DeckGallery hover text color
let deckGalleryCss = 'src/components/DeckGallery.css';
if (fs.existsSync(deckGalleryCss)) {
  let c = fs.readFileSync(deckGalleryCss, 'utf8');
  c = c.replace(/background:\s*rgba\(30,\s*30,\s*30,\s*0\.8\);/g, 'background: var(--card-hover);\n  color: var(--text-primary);');
  c = c.replace(/\.deck-card:hover\s*\{\s*transform:\s*none;\s*box-shadow:\s*0 10px 30px rgba\(0,\s*0,\s*0,\s*0\.3\);\s*background:\s*var\(--glass-surface\);\s*\}/g, `.deck-card:hover { transform: none; box-shadow: var(--shadow-color) 0px 4px 10px -5px; background: var(--card-hover); color: var(--text-primary); }`);
  fs.writeFileSync(deckGalleryCss, c, 'utf8');
}

// 6. CreateDeck.css fixes
let createDeckCss = 'src/pages/CreateDeck.css';
if (fs.existsSync(createDeckCss)) {
  let c = fs.readFileSync(createDeckCss, 'utf8');
  c = c.replace(/background:\s*var\(--shadow-color\);/g, 'background: var(--card-bg);'); // editor-pane
  c = c.replace(/background:\s*rgba\(2,\s*2,\s*2,\s*0\.6\);/g, 'background: var(--card-hover);'); // accent-pane
  c = c.replace(/background:\s*rgba\(10,\s*10,\s*10,\s*0\.4\);/g, 'background: var(--input-bg); color: var(--text-primary);'); // btn-add-node
  fs.writeFileSync(createDeckCss, c, 'utf8');
}

console.log('Final polish batch applied');
