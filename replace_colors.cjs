const fs = require('fs');
const files = [
  'src/pages/Discover.jsx',
  'src/pages/Profile.jsx',
  'src/pages/ProfileEdit.jsx',
  'src/pages/DeckLibrary.jsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Colors mapping
  content = content.replace(/#ffffff/gi, "var(--text-primary)");
  content = content.replace(/color:\s*['"]white['"]/gi, "color: 'var(--text-primary)'");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.[4567]\)/gi, "var(--text-secondary)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.45\)/gi, "var(--text-secondary)");
  content = content.replace(/#63b3ed|#93c5fd/gi, "var(--accent-primary)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.0[1-5]\)/gi, "var(--card-bg)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.0[6-9]\)/gi, "var(--card-hover)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.1[0-5]?\)/gi, "var(--card-border)");
  content = content.replace(/rgba\(99,\s*179,\s*237,\s*0\.1[58]\)/gi, "var(--badge-bg)");
  content = content.replace(/rgba\(99,\s*179,\s*237,\s*0\.2[05]?\)/gi, "var(--badge-bg)");
  content = content.replace(/rgba\(99,\s*179,\s*237,\s*0\.4\)/gi, "var(--accent-primary)");
  content = content.replace(/#f87171|#ef4444|#fca5a5/gi, "var(--danger)");
  content = content.replace(/rgba\(248,\s*113,\s*113,\s*0\.[0-9]+\)/gi, "var(--danger)");
  content = content.replace(/#4ade80|#22c55e/gi, "var(--success)");
  content = content.replace(/#fbbf24/gi, "var(--warning)");
  content = content.replace(/rgba\(12,\s*12,\s*12,\s*0\.97\)/gi, "var(--glass-surface-solid)");
  content = content.replace(/rgba\(10,\s*10,\s*10,\s*0\.98\)/gi, "var(--glass-surface-solid)");
  content = content.replace(/rgba\(0,\s*0,\s*0,\s*0\.8[58]\)/gi, "var(--shadow-color)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.35?\)/gi, "var(--text-secondary)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.25?\)/gi, "var(--text-secondary)");
  content = content.replace(/rgba\(34,\s*197,\s*94,\s*0\.[0-9]+\)/gi, "var(--success)");

  fs.writeFileSync(file, content, 'utf8');
});
console.log("Done");
