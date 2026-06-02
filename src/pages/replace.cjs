const fs = require('fs');

const files = [
  'c:\\Users\\HARSH TIWARI\\Desktop\\CODING WORKSPACE\\ui agents\\drizzlix\\src\\pages\\StudySession.jsx',
  'c:\\Users\\HARSH TIWARI\\Desktop\\CODING WORKSPACE\\ui agents\\drizzlix\\src\\pages\\CreateDeck.jsx',
  'c:\\Users\\HARSH TIWARI\\Desktop\\CODING WORKSPACE\\ui agents\\drizzlix\\src\\pages\\TasksPage.jsx',
  'c:\\Users\\HARSH TIWARI\\Desktop\\CODING WORKSPACE\\ui agents\\drizzlix\\src\\pages\\NotesPage.jsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // #a78bfa -> var(--accent-primary)
  content = content.replace(/(['"`])#a78bfa\1/ig, "$1var(--accent-primary)$1");
  
  // #63b3ed -> var(--accent-primary) (from prompt)
  content = content.replace(/(['"`])#63b3ed\1/ig, "$1var(--accent-primary)$1");
  
  // #c4b5fd -> var(--badge-text)
  content = content.replace(/(['"`])#c4b5fd\1/ig, "$1var(--badge-text)$1");
  
  // #fde047 -> var(--warning)
  content = content.replace(/(['"`])#fde047\1/ig, "$1var(--warning)$1");
  
  // #22d3ee -> var(--accent-secondary)
  content = content.replace(/(['"`])#22d3ee\1/ig, "$1var(--accent-secondary)$1");

  // gray gradient components to use standard backgrounds
  // background: 'radial-gradient(circle at 15% 20%, #303030, #101010 40%, #000000)'
  content = content.replace(/(['"`])radial-gradient\([^)]+\)\1/ig, "$1var(--bg-gradient)$1");
  content = content.replace(/(['"`])linear-gradient\([^)]+#3d3d3d[^)]+\)\1/ig, "$1var(--bg-gradient)$1");
  content = content.replace(/(['"`])linear-gradient\([^)]+#4d4d4d[^)]+\)\1/ig, "$1var(--bg-gradient)$1");
  
  // #141414 -> var(--glass-surface-solid)
  content = content.replace(/(['"`])#141414\1/ig, "$1var(--glass-surface-solid)$1");
  // #1a1a1a -> var(--glass-surface-solid)
  content = content.replace(/(['"`])#1a1a1a\1/ig, "$1var(--glass-surface-solid)$1");
  // #2a2a2a -> var(--outline)
  content = content.replace(/(['"`])#2a2a2a\1/ig, "$1var(--outline)$1");

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
