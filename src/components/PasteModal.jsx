// PasteModal — allow user to paste raw JSON text from any AI
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ClipboardPaste } from 'lucide-react';

export default function PasteModal({ onClose, onImport }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleImport = () => {
    if (!text.trim()) { setError('Please paste some JSON first.'); return; }
    onImport(text);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-2xl)', padding: '2rem', maxWidth: '640px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardPaste size={20} color="var(--primary)" /> Paste JSON Text
            </h2>
            <p style={{ color: 'var(--secondary)', margin: '0.4rem 0 0 0', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
              Paste the JSON output directly from any AI. Both raw arrays and Drizzlix exports are accepted.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--secondary)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setError(''); }}
          placeholder={'[\n  { "front": "What is...", "back": "It is..." },\n  ...\n]'}
          autoFocus
          style={{ width: '100%', minHeight: '240px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 'var(--radius-lg)', padding: '1rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#d4d4d8', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = 'rgba(217,119,6,0.5)'}
          onBlur={e => e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}
        />

        {error && <p style={{ color: '#fca5a5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', margin: 0 }}>⚠️ {error}</p>}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.65rem 1.2rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--secondary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleImport} style={{ padding: '0.65rem 1.5rem', background: 'var(--primary)', color: 'black', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={15} /> Import Deck
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

