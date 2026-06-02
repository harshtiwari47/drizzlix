import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getPetStatus } from '../../utils/gamification';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../../utils/push';
import { Flame, Bell, BellOff, Calendar } from 'lucide-react';
import './Gamification.css';

export default function GamificationPanel() {
  const { user, stats } = useAuth();
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    // Check if currently subscribed in browser
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsPushEnabled(!!sub);
        });
      });
    }
  }, []);

  if (!user || !stats) return null;

  const petStatus = getPetStatus(stats.xp || 0);
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

  const togglePush = async () => {
    setIsSubscribing(true);
    try {
      if (isPushEnabled) {
        await unsubscribeFromPushNotifications(localStorage.getItem('token'));
        setIsPushEnabled(false);
      } else {
        const sub = await subscribeToPushNotifications(localStorage.getItem('token'));
        if (sub) setIsPushEnabled(true);
      }
    } catch (err) {
      console.error('Push toggle error:', err);
      alert('Could not toggle push notifications. Please check site permissions.');
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="gamification-panel">
      {/* Mystic Pet Status */}
      <div className="gamification-card pet-card">
        <div className="pet-header">
          <h3>Your Companion</h3>
          <span className="pet-level-badge">Lvl {petStatus.level}</span>
        </div>
        <div className="pet-display">
          <motion.img 
            src={petStatus.image} 
            alt={petStatus.name}
            className="pet-avatar"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="pet-info">
            <h4>{petStatus.name}</h4>
            <div className="xp-bar-container">
              <div 
                className="xp-bar-fill" 
                style={{ width: `${petStatus.progressPercent}%` }} 
              />
            </div>
            <p className="xp-text">
              {petStatus.isMaxLevel 
                ? 'Max Level Reached!' 
                : `${petStatus.xpIntoCurrentLevel} / ${petStatus.xpNeededForNext} XP to evolve`}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Heatmap & Streak */}
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

      {/* Spaced Repetition Reminders */}
      <div className="gamification-card reminder-card">
        <div className="reminder-content">
          <Calendar size={20} color="var(--accent-primary)" />
          <div className="reminder-text">
            <h4>Daily Reminders</h4>
            <p>Opt-in to get reminded when cards are due.</p>
          </div>
        </div>
        <button 
          className={`push-toggle-btn ${isPushEnabled ? 'enabled' : ''}`}
          onClick={togglePush}
          disabled={isSubscribing}
        >
          {isPushEnabled ? <Bell size={16} /> : <BellOff size={16} />}
          {isPushEnabled ? 'Enabled' : 'Enable'}
        </button>
      </div>
    </div>
  );
}
