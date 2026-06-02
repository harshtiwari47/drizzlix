import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../../utils/push';
import { Bell, BellOff, Calendar, Send } from 'lucide-react';
import ActivityHeatmap from './ActivityHeatmap';
import './Gamification.css';

export default function GamificationPanel() {
  const { user, stats } = useAuth();
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsPushEnabled(!!sub);
        });
      });
    }
  }, []);

  if (!user || !stats) return null;

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

  const testPush = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const token = localStorage.getItem('token');
      const res = await fetch(`${baseUrl}/push/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Test push failed');
    } catch (err) {
      console.error(err);
      alert('Could not send test push. Make sure it is enabled first.');
    }
  };

  return (
    <div className="gamification-panel">
      {/* Activity Heatmap & Streak */}
      <ActivityHeatmap stats={stats} />

      {/* Spaced Repetition Reminders */}
      <div className="gamification-card reminder-card">
        <div className="reminder-content">
          <Calendar size={20} color="var(--accent-primary)" />
          <div className="reminder-text">
            <h4>Daily Reminders</h4>
            <p>Opt-in to get reminded when cards are due.</p>
          </div>
        </div>
        <div className="reminder-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className={`push-toggle-btn ${isPushEnabled ? 'enabled' : ''}`}
            onClick={togglePush}
            disabled={isSubscribing}
          >
            {isPushEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            {isPushEnabled ? 'Enabled' : 'Enable'}
          </button>
          
          {isPushEnabled && (
            <button 
              className="push-toggle-btn"
              onClick={testPush}
              style={{ background: 'var(--accent-primary)', color: 'white' }}
            >
              <Send size={16} />
              Test Push
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
