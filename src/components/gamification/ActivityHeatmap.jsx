import React from 'react';
import { Flame } from 'lucide-react';
import './Gamification.css';

export default function ActivityHeatmap({ stats }) {
  if (!stats) return null;

  const streak = stats.streakDays || 0;
  
  // Heatmap generation (last 30 days for UI)
  const today = new Date();
  const activityLog = stats.activityLog || [];
  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const dStr = d.toISOString().split('T')[0];
    return { date: dStr, active: activityLog.includes(dStr) };
  });

  return (
    <div className="gamification-card activity-card">
      <div className="activity-header">
        <div className="streak-indicator">
          <Flame size={20} color={streak > 0 ? "var(--warning)" : "var(--text-muted)"} />
          <span className={streak > 0 ? "streak-active" : ""}>{streak} Day Streak</span>
        </div>
      </div>
      <div className="heatmap-grid">
        {days.map((day, i) => (
          <div 
            key={i} 
            className={`heatmap-cell ${day.active ? 'active' : ''}`}
            title={day.date}
          />
        ))}
      </div>
    </div>
  );
}
