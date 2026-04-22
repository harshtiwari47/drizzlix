import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { User, Check } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const _MOTION = motion;

export default function UsernameOnboarding() {
  const { token, user: authUser, login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if user has a username
  useEffect(() => {
    let cancelled = false;

    const resolveUsernameState = async () => {
      if (!token) {
        if (!cancelled) {
          setNeedsUsername(false);
          setLoading(false);
        }
        return;
      }

      if (authUser?.username) {
        if (!cancelled) {
          setNeedsUsername(false);
          setLoading(false);
        }
        return;
      }

      if (isOffline) {
        if (!cancelled) {
          setNeedsUsername(false);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      try {
        const response = await fetch(`${BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) {
          if (!cancelled) {
            setNeedsUsername(false);
          }
          return;
        }

        const data = await response.json();
        const resolvedUsername = String(data?.username || '').trim();

        if (!resolvedUsername) {
          if (!cancelled) {
            setNeedsUsername(true);
          }
          return;
        }

        if (!cancelled) {
          setNeedsUsername(false);
        }

        if (authUser && authUser.username !== resolvedUsername) {
          login(token, { ...authUser, username: resolvedUsername });
        }
      } catch {
        if (!cancelled) {
          setNeedsUsername(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    resolveUsernameState();

    return () => {
      cancelled = true;
    };
  }, [token, authUser, login, isOffline]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const cleanUser = usernameInput.trim().toLowerCase();
    if (cleanUser.length < 3 || cleanUser.length > 20) {
      setError('Username must be 3-20 characters.');
      return;
    }
    if (cleanUser === 'me') {
      setError('"me" is a reserved word. Pick another handle.');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You are offline. Reconnect to claim your username.');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const res = await fetch(`${BASE_URL}/me/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: cleanUser })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.msg || 'Failed to claim username.');
        setSaving(false);
        return;
      }
      
      // Success!
      if (authUser) login(token, { ...authUser, username: data.username });
      setNeedsUsername(false);
    } catch {
      setError('Network error syncing with neural network.');
      setSaving(false);
    }
  };

  if (loading || !needsUsername) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <_MOTION.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{ background: 'var(--glass-surface)', border: '1px solid rgba(99,179,237,0.3)', borderRadius: '1.5rem', padding: '3rem', width: '100%', maxWidth: '440px', boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 40px rgba(99,179,237,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
      >
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(99,179,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: '2px solid rgba(99,179,237,0.3)' }}>
          <User size={32} color="#63b3ed" />
        </div>
        
        <h2 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'white', letterSpacing: '-0.02em' }}>Claim Your Handle</h2>
        <p style={{ margin: '0 0 2rem 0', fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--secondary)', lineHeight: 1.5 }}>
          Drizzlix is now a social community. Choose a unique handle to share your cognitive payloads.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '1.25rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)', fontSize: '1.1rem', fontWeight: 600 }}>@</span>
            <input
              autoFocus
              type="text"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={20}
              placeholder="username"
              disabled={saving}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)', padding: '1rem 1rem 1rem 2.8rem', color: 'white', fontFamily: 'var(--font-body)', fontSize: '1.1rem', outline: 'none', transition: 'all 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#63b3ed'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
            />
          </div>
          
          {error && (
            <_MOTION.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} style={{ margin: 0, color: '#f87171', fontSize: '0.85rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
              {error}
            </_MOTION.p>
          )}

          <button
            type="submit"
            disabled={saving || usernameInput.length < 3}
            style={{ marginTop: '0.5rem', width: '100%', padding: '1rem', background: usernameInput.length < 3 ? 'rgba(255,255,255,0.05)' : 'rgba(99,179,237,0.15)', border: `1px solid ${usernameInput.length < 3 ? 'rgba(255,255,255,0.1)' : 'rgba(99,179,237,0.4)'}`, color: usernameInput.length < 3 ? 'rgba(255,255,255,0.3)' : '#63b3ed', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem', cursor: usernameInput.length < 3 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
          >
            {saving ? 'Verifying...' : <><Check size={18} /> Confirm Handle</>}
          </button>
        </form>
      </_MOTION.div>
    </div>
  );
}

