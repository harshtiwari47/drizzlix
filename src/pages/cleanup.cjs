const fs = require('fs');

const notesFile = 'c:\\Users\\HARSH TIWARI\\Desktop\\CODING WORKSPACE\\ui agents\\drizzlix\\src\\pages\\NotesPage.jsx';
let notesContent = fs.readFileSync(notesFile, 'utf8');
notesContent = notesContent.replace(/#e2e8f0/g, 'var(--text-primary)');
notesContent = notesContent.replace(/#9ca3af/g, 'var(--secondary)');
notesContent = notesContent.replace(/#fff\b/g, 'var(--text-primary)');
fs.writeFileSync(notesFile, notesContent, 'utf8');

const tasksFile = 'c:\\Users\\HARSH TIWARI\\Desktop\\CODING WORKSPACE\\ui agents\\drizzlix\\src\\pages\\TasksPage.jsx';
let tasksContent = fs.readFileSync(tasksFile, 'utf8');
tasksContent = tasksContent.replace(/#a78bfa80/g, 'var(--accent-primary)'); // this is fine since opacity is hard to map without css-mix or specific vars
tasksContent = tasksContent.replace(/#a78bfa/g, 'var(--accent-primary)');
tasksContent = tasksContent.replace(/#FFFFFF/g, 'var(--text-primary)');
fs.writeFileSync(tasksFile, tasksContent, 'utf8');

console.log('Cleanup complete');
