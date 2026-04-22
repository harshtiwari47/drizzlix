import React, { useEffect } from 'react';
import { CloudLightning, Orbit, Rocket } from 'lucide-react';
import './StudyControls.css';

export default function StudyControls({ onNext }) {
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;
      
      if (e.key === '1') onNext('hard');
      if (e.key === '2') onNext('good');
      if (e.key === '3') onNext('easy');
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext]);

  return (
    <div className="study-controls">
      <button className="control-btn btn-hard" onClick={() => onNext('hard')}>
        <div className="btn-glow" />
        <div className="btn-shimmer" />
        <CloudLightning className="btn-icon" />
        <div className="btn-label">
          <span className="label-text">Hard</span>
          <span className="shortcut-pill">1</span>
        </div>
      </button>

      <button className="control-btn btn-good" onClick={() => onNext('good')}>
        <div className="btn-glow" />
        <div className="btn-shimmer" />
        <Orbit className="btn-icon" />
        <div className="btn-label">
          <span className="label-text">Good</span>
          <span className="shortcut-pill">2</span>
        </div>
      </button>

      <button className="control-btn btn-easy" onClick={() => onNext('easy')}>
        <div className="btn-glow" />
        <div className="btn-shimmer" />
        <Rocket className="btn-icon" />
        <div className="btn-label">
          <span className="label-text">Easy</span>
          <span className="shortcut-pill">3</span>
        </div>
      </button>
    </div>
  );
}

