import React from 'react';
import { Lightbulb, Fingerprint, Zap } from 'lucide-react';
import './InsightPanel.css';

export default function InsightPanel({ currentCard }) {
  if (!currentCard) return null;

  return (
    <aside className="insight-panel">
      <div className="insight-header">
        <Lightbulb size={20} className="insight-icon" />
        <h3>AI Insight Analysis</h3>
      </div>
      
      <div className="insight-content">
        <div className="insight-block">
          <div className="block-title">
            <Fingerprint size={14} /> Cognitive Link
          </div>
          <p>This concept relates intrinsically to the structural topology of your previous queries. Focus on the foundational layer first.</p>
        </div>
        
        <div className="insight-block">
          <div className="block-title">
            <Zap size={14} /> Mastery Tip
          </div>
          <p>Mnemonic association yields an 80% higher retention rate for this exact domain. Try connecting it to a physical location.</p>
        </div>
      </div>
    </aside>
  );
}

