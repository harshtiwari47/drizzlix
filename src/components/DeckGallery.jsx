import React, { useMemo, useCallback } from 'react';
import { ArrowRight, Brain, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeck } from '../context/DeckContext';
import './DeckGallery.css';

import chromeBrain from '../assets/chrome_brain.png';
import silverSphere from '../assets/silver_sphere.png';
import silverFluid from '../assets/silver_fluid.png';

const DeckGallery = React.memo(function DeckGallery() {
  const { decks } = useDeck();
  const navigate = useNavigate();

  // Map recent real decks to gallery cards.
  const displayItems = useMemo(() => (
    decks.slice(-3).reverse().map((d, i) => ({
      id: d.id,
      title: d.title,
      subtitle: 'Custom Neural Vector',
      stats: `${d.cards.length} Nodes`,
      icon: i % 2 === 0 ? <Brain size={14} /> : <Cpu size={14} />,
      image: i % 3 === 0 ? chromeBrain : i % 3 === 1 ? silverFluid : silverSphere
    }))
  ), [decks]);

  const openLibrary = useCallback(() => {
    navigate('/decks');
  }, [navigate]);

  const openDiscover = useCallback(() => {
    navigate('/discover');
  }, [navigate]);

  return (
    <section className="deck-gallery">
      <div className="gallery-header">
        <h3 className="gallery-title">{decks.length > 0 ? "Recent Syntheses" : "No Decks Yet"}</h3>
        <button className="view-all-btn" onClick={openLibrary}>
          View Library <ArrowRight size={14} />
        </button>
      </div>
      
      {displayItems.length > 0 ? (
        <div className="gallery-grid">
          {displayItems.map(deck => (
            <div
              key={deck.id}
              className="deck-card"
              onClick={() => navigate(`/study/${deck.id}`)}
            >
              <div className="deck-image-container">
                <img src={deck.image} alt={deck.title} className="deck-image" />
                <div className="deck-badge">
                  {deck.icon}
                  <span>{deck.stats}</span>
                </div>
              </div>
              <div className="deck-info">
                <h4>{deck.title}</h4>
                <p>{deck.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: '1px dashed rgba(255,255,255,0.16)', borderRadius: 'var(--radius-lg)', padding: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
          <p style={{ margin: 0, color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
            Your library is empty. Generate a deck or explore Discover.
          </p>
          <button className="view-all-btn" onClick={openDiscover}>Open Discover</button>
        </div>
      )}
    </section>
  );
});

export default DeckGallery;

