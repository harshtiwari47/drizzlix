import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Save, X, Edit3, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { rephraseFlashcard } from '../services/gemini';

function normalizeEscapedText(text = '') {
  return String(text)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ');
}

export default function DraftEditor({ draftDeck, setDraftDeck, onSave, onDiscard }) {
  const [toneByCardId, setToneByCardId] = useState({});
  const [rephrasingByCardId, setRephrasingByCardId] = useState({});
  const [cardErrorById, setCardErrorById] = useState({});

  const handleRemoveCard = (cardId) => {
    setDraftDeck(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== cardId)
    }));
  };

  const handleTitleChange = (e) => {
    setDraftDeck(prev => ({ ...prev, title: e.target.value }));
  };

  const handleThumbnailChange = (e) => {
    setDraftDeck(prev => ({ ...prev, thumbnail: e.target.value }));
  };

  const handleLabelsChange = (e) => {
    const raw = e.target.value;
    const labels = raw.split(',').map(s => s.trim()).filter(Boolean);
    setDraftDeck(prev => ({ ...prev, labels }));
  };


  const normalizeMarkdown = (text = '') => {
    const normalized = normalizeEscapedText(text)
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/^\s*[-*]\s*/gm, '- ')
      .trim();
    return normalized;
  };

  const handleCardToneChange = (cardId, tone) => {
    setToneByCardId(prev => ({ ...prev, [cardId]: tone }));
  };

  const handleRephraseCard = async (card) => {
    const cardId = card.id;
    const selectedTone = toneByCardId[cardId] || 'clear and concise';

    setCardErrorById(prev => ({ ...prev, [cardId]: '' }));
    setRephrasingByCardId(prev => ({ ...prev, [cardId]: true }));

    try {
      const rewritten = await rephraseFlashcard({
        front: normalizeEscapedText(card.front || ''),
        back: normalizeEscapedText(card.back || ''),
        failedImageUrls: Array.isArray(card.failedImageUrls) ? card.failedImageUrls : []
      }, selectedTone);

      setDraftDeck(prev => ({
        ...prev,
        cards: prev.cards.map(c => c.id === cardId ? {
          ...c,
          front: normalizeMarkdown(rewritten.front || c.front),
          back: normalizeMarkdown(rewritten.back || c.back),
          failedImageUrls: Array.isArray(rewritten.failedImageUrls)
            ? rewritten.failedImageUrls
            : (Array.isArray(c.failedImageUrls) ? c.failedImageUrls : [])
        } : c)
      }));
    } catch (error) {
      setCardErrorById(prev => ({
        ...prev,
        [cardId]: error?.message || 'Failed to rephrase this card. Please retry.'
      }));
    } finally {
      setRephrasingByCardId(prev => ({ ...prev, [cardId]: false }));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="draft-editor-container"
      style={{ width: '100%', maxWidth: '800px', margin: '0 auto', background: 'var(--glass-surface)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-xl)', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
    >
      <div className="draft-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Edit3 size={24} color="var(--primary)"/> Neural Draft Placed
          </h2>
          <p style={{ color: 'var(--secondary)', margin: '0.5rem 0 0 0', fontFamily: 'var(--font-body)', fontSize: '1rem' }}>Curate your synthesized nodes before committing to the Cloud grid.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <button onClick={onDiscard} style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.3)', color: '#ff6b6b', padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease', fontFamily: 'var(--font-body)', fontWeight: 600 }} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,100,100,0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}>
             <X size={16} /> Discard
           </button>
           <button onClick={() => onSave(draftDeck)} style={{ background: 'var(--primary)', border: 'none', color: 'black', padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-body)', fontWeight: 700, transition: 'all 0.2s ease', boxShadow: '0 4px 15px rgba(217, 119, 6, 0.3)' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
             <Save size={16} /> Approve
           </button>
        </div>
      </div>

      <div className="draft-meta-forms" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ color: 'var(--secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Deck Title</label>
          <input type="text" value={draftDeck.title} onChange={handleTitleChange} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.9rem', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontSize: '1rem', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = 'var(--primary)'} onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ color: 'var(--secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Cover Image URL (Optional)</label>
          <input type="text" value={draftDeck.thumbnail || ''} onChange={handleThumbnailChange} placeholder="https://..." style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.9rem', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontSize: '1rem', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = 'var(--primary)'} onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'} />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ color: 'var(--secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Categorical Tags <span style={{opacity: 0.5, textTransform: 'none'}}>(Comma separated)</span></label>
          <input type="text" value={draftDeck.labels.join(', ')} onChange={handleLabelsChange} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.9rem', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontSize: '1rem', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = 'var(--primary)'} onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'} />
        </div>

        {String(draftDeck.generationPrompt || '').trim() && (
          <div style={{ gridColumn: '1 / -1', background: 'rgba(42, 58, 88, 0.22)', border: '1px solid rgba(151, 194, 255, 0.26)', borderRadius: 'var(--radius-lg)', padding: '0.95rem' }}>
            <p style={{ margin: 0, color: 'white', fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
              Original AI Prompt
            </p>
            <p style={{ margin: '0.55rem 0 0 0', color: 'rgba(224,235,255,0.92)', fontSize: '0.84rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-body)' }}>
              {String(draftDeck.generationPrompt || '')}
            </p>
          </div>
        )}
      </div>

      <div className="draft-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        <h3 style={{ color: 'white', fontFamily: 'var(--font-display)', margin: 0, fontSize: '1.2rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Synthesized Nodes ({draftDeck.cards.length})</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {draftDeck.cards.map((card, idx) => (
            <div key={card.id} style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-lg)', padding: '1.2rem', alignItems: 'flex-start', gap: '1.2rem', transition: 'all 0.2s ease' }} onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }} onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)' }}>
              <div style={{ background: 'linear-gradient(135deg, #1f1f1f, #2a2a2a)', color: 'var(--primary)', border: '1px solid rgba(255,255,255,0.1)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0 }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ fontWeight: 600, color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.1rem', lineHeight: 1.4 }}>{normalizeEscapedText(card.front)}</div>
                <div className="markdown-card-content" style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {normalizeEscapedText(card.back || '')}
                  </ReactMarkdown>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={toneByCardId[card.id] || 'clear and concise'}
                    onChange={(e) => handleCardToneChange(card.id, e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)', padding: '0.42rem 0.55rem', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}
                  >
                    <option value="clear and concise">Clear and concise</option>
                    <option value="beginner friendly">Beginner friendly</option>
                    <option value="exam-ready academic">Exam-ready academic</option>
                    <option value="professional technical">Professional technical</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRephraseCard(card)}
                    disabled={Boolean(rephrasingByCardId[card.id])}
                    style={{ border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: 'var(--radius-md)', padding: '0.42rem 0.68rem', cursor: rephrasingByCardId[card.id] ? 'not-allowed' : 'pointer', opacity: rephrasingByCardId[card.id] ? 0.65 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontFamily: 'var(--font-body)' }}
                  >
                    <RefreshCw size={13} className={rephrasingByCardId[card.id] ? 'spin' : ''} />
                    {rephrasingByCardId[card.id] ? 'Rephrasing...' : 'Rephrase'}
                  </button>
                </div>
                {cardErrorById[card.id] && (
                  <div style={{ color: '#fca5a5', fontSize: '0.76rem', fontFamily: 'var(--font-body)' }}>
                    {cardErrorById[card.id]}
                  </div>
                )}
              </div>
              <button onClick={() => handleRemoveCard(card.id)} title="Discard Node" style={{ background: 'transparent', color: 'rgba(255,255,255,0.3)', border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.color = '#ff6b6b'; e.currentTarget.style.background = 'rgba(255,50,50,0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'transparent'; }}>
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          {draftDeck.cards.length === 0 && (
             <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#ff6b6b', border: '1px dashed rgba(255,50,50,0.3)', borderRadius: 'var(--radius-md)', background: 'rgba(255,50,50,0.05)' }}>
               <strong>Warning:</strong> No nodes remaining. This deck is empty and cannot be initialized.
             </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

