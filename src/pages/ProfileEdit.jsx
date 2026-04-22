import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { ArrowLeft, Flame, Lock, Save, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDeck } from '../context/DeckContext';
import {
  AVATAR_EFFECT_KEY,
  AVATAR_EFFECT_OPTIONS,
  OVERLAY_EFFECT_KEY,
  OVERLAY_EFFECT_OPTIONS,
  getDashboardOverlayEffectFromStorage,
  parseDashboardOverlayEffect,
  parseProfileAvatarEffect,
} from '../services/globalSettings';
import './ProfileEdit.css';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const EFFECT_PREVIEW_IMAGES = {
  none: '/effects/none.svg',
  meteors: '/effects/meteors.svg',
  rain: '/effects/rain.svg',
  wind: '/effects/wind.svg',
  snow: '/effects/snow.svg',
  aurora: '/effects/aurora.svg',
  lightning: '/effects/lightning.svg',
  embers: '/effects/embers.svg',
  fireflies: '/effects/fireflies.svg',
  nebula: '/effects/nebula.svg',
  matrixrain: '/effects/matrixrain.svg',
};

const EFFECT_STREAK_UNLOCKS = {
  none: 0,
  rain: 0,
  wind: 2,
  snow: 4,
  meteors: 6,
  embers: 8,
  fireflies: 10,
  lightning: 12,
  aurora: 16,
  nebula: 20,
  matrixrain: 24,
};

const AVATAR_EFFECT_STREAK_UNLOCKS = {
  none: 0,
  angel: 5,
  flame: 10,
  lightning: 20,
  vortex: 22,
  glitch: 28,
  solarstorm: 34,
};

const AVATAR_EFFECT_STYLES = {
  none: {
    enabled: false,
    frameGradient: 'transparent',
    auraGradient: 'transparent',
    frameDuration: 0,
    pulseDuration: 0,
  },
  angel: {
    enabled: true,
    frameGradient: 'conic-gradient(from 0deg, rgba(253,224,71,0.15), rgba(255,255,255,0.95), rgba(253,224,71,0.15))',
    auraGradient: 'radial-gradient(circle, rgba(254,240,138,0.44) 0%, rgba(253,224,71,0.18) 52%, rgba(253,224,71,0) 82%)',
    frameDuration: 4,
    pulseDuration: 2.4,
  },
  flame: {
    enabled: true,
    frameGradient: 'conic-gradient(from 0deg, rgba(251,146,60,0.14), rgba(251,146,60,0.86), rgba(185,28,28,0.72), rgba(251,146,60,0.14))',
    auraGradient: 'radial-gradient(circle, rgba(251,146,60,0.34) 0%, rgba(239,68,68,0.14) 52%, rgba(239,68,68,0) 84%)',
    frameDuration: 3.8,
    pulseDuration: 1.7,
  },
  lightning: {
    enabled: true,
    frameGradient: 'conic-gradient(from 0deg, rgba(125,211,252,0.2), rgba(219,234,254,1), rgba(129,140,248,0.92), rgba(125,211,252,0.2))',
    auraGradient: 'radial-gradient(circle, rgba(125,211,252,0.48) 0%, rgba(129,140,248,0.24) 52%, rgba(129,140,248,0) 84%)',
    frameDuration: 1.25,
    pulseDuration: 0.65,
  },
  vortex: {
    enabled: true,
    frameGradient: 'conic-gradient(from 40deg, rgba(59,130,246,0.2), rgba(167,139,250,0.98), rgba(236,72,153,0.86), rgba(59,130,246,0.2))',
    auraGradient: 'radial-gradient(circle, rgba(196,181,253,0.4) 0%, rgba(56,189,248,0.17) 52%, rgba(56,189,248,0) 84%)',
    frameDuration: 2.1,
    pulseDuration: 1.15,
  },
  glitch: {
    enabled: true,
    frameGradient: 'conic-gradient(from 0deg, rgba(34,211,238,0.2), rgba(16,185,129,0.98), rgba(129,140,248,0.9), rgba(34,211,238,0.2))',
    auraGradient: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, rgba(129,140,248,0.2) 52%, rgba(129,140,248,0) 84%)',
    frameDuration: 1.15,
    pulseDuration: 0.8,
  },
  solarstorm: {
    enabled: true,
    frameGradient: 'conic-gradient(from 0deg, rgba(245,158,11,0.2), rgba(249,115,22,0.95), rgba(220,38,38,0.85), rgba(245,158,11,0.2))',
    auraGradient: 'radial-gradient(circle, rgba(251,146,60,0.42) 0%, rgba(251,113,133,0.16) 56%, rgba(251,113,133,0) 85%)',
    frameDuration: 1.55,
    pulseDuration: 0.9,
  },
};

function LiveAvatarPreview({ picture, selectedAvatarEffect }) {
  const avatarSize = 68;
  const avatarEffect = AVATAR_EFFECT_STYLES[selectedAvatarEffect] || AVATAR_EFFECT_STYLES.none;

  return (
    <div className="profile-live-avatar-frame">
      {avatarEffect.enabled ? (
        <Motion.span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-11px',
            borderRadius: '50%',
            background: avatarEffect.frameGradient,
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
            filter: 'drop-shadow(0 0 10px rgba(148,163,184,0.5))',
            pointerEvents: 'none',
          }}
          animate={{ rotate: 360, opacity: [0.7, 1, 0.7] }}
          transition={{ duration: avatarEffect.frameDuration, repeat: Infinity, ease: 'linear' }}
        />
      ) : null}

      {avatarEffect.enabled ? (
        <Motion.span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-17px',
            borderRadius: '50%',
            background: avatarEffect.auraGradient,
            filter: 'blur(1px)',
            pointerEvents: 'none',
          }}
          animate={{ scale: [0.96, 1.16, 0.96], opacity: [0.35, 0.95, 0.35] }}
          transition={{ duration: avatarEffect.pulseDuration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}

      {selectedAvatarEffect === 'angel'
        ? [0, 1].map((i) => (
            <Motion.span
              key={`angel-spark-${i}`}
              aria-hidden="true"
              style={{ position: 'absolute', inset: '-14px', borderRadius: '50%', pointerEvents: 'none' }}
              animate={{ rotate: i === 0 ? 360 : -360 }}
              transition={{ duration: 5.5 + i, repeat: Infinity, ease: 'linear' }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  left: '50%',
                  width: 5,
                  height: 5,
                  marginLeft: -2.5,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.98)',
                  boxShadow: '0 0 10px rgba(255,255,255,0.9)',
                }}
              />
            </Motion.span>
          ))
        : null}

      {selectedAvatarEffect === 'flame'
        ? [
            { left: '26%', delay: 0, width: 10, height: 19 },
            { left: '50%', delay: 0.22, width: 12, height: 23 },
            { left: '74%', delay: 0.44, width: 10, height: 18 },
          ].map((flame, idx) => (
            <Motion.span
              key={`flame-tongue-${idx}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '-6px',
                left: flame.left,
                width: flame.width,
                height: flame.height,
                marginLeft: -(flame.width / 2),
                borderRadius: '58% 58% 42% 42%',
                background: 'linear-gradient(180deg, rgba(254,240,138,0.78) 0%, rgba(251,146,60,0.82) 44%, rgba(185,28,28,0.7) 100%)',
                filter: 'blur(0.35px)',
                transformOrigin: '50% 100%',
                pointerEvents: 'none',
                zIndex: 2,
                mixBlendMode: 'screen',
              }}
              animate={{ y: [0, -5, -2, -6, 0], opacity: [0.48, 0.78, 0.6, 0.82, 0.48] }}
              transition={{ duration: 1.45, repeat: Infinity, ease: 'easeInOut', delay: flame.delay }}
            />
          ))
        : null}

      {selectedAvatarEffect === 'lightning'
        ? [
            { left: '29%', delay: 0, rotate: -8, height: 26 },
            { left: '50%', delay: 0.2, rotate: 4, height: 30 },
            { left: '71%', delay: 0.42, rotate: -5, height: 24 },
          ].map((bolt, i) => (
            <Motion.span
              key={`lightning-rift-${i}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '-9px',
                left: bolt.left,
                width: 2,
                height: bolt.height,
                marginLeft: -1,
                borderRadius: 999,
                background: 'linear-gradient(180deg, rgba(219,234,254,0), rgba(219,234,254,0.98), rgba(129,140,248,0.08))',
                transform: `rotate(${bolt.rotate}deg)`,
                transformOrigin: '50% 100%',
                boxShadow: '0 0 12px rgba(125,211,252,0.95)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
              animate={{ opacity: [0.08, 1, 0.15, 0.92, 0.08], scaleY: [0.88, 1.22, 0.92, 1.18, 0.88] }}
              transition={{ duration: 0.56, repeat: Infinity, ease: 'easeInOut', delay: bolt.delay }}
            />
          ))
        : null}

      {selectedAvatarEffect === 'vortex'
        ? [
            { inset: '-16px', duration: 2.8, opacity: [0.16, 0.88, 0.16], reverse: false },
            { inset: '-10px', duration: 1.9, opacity: [0.12, 0.68, 0.12], reverse: true },
          ].map((ring, i) => (
            <Motion.span
              key={`vortex-ring-${i}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: ring.inset,
                borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: i === 0 ? 'rgba(196,181,253,0.95)' : 'rgba(56,189,248,0.95)',
                borderRightColor: i === 0 ? 'rgba(236,72,153,0.9)' : 'rgba(167,139,250,0.9)',
                pointerEvents: 'none',
                filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.9))',
              }}
              animate={{ rotate: ring.reverse ? -360 : 360, opacity: ring.opacity }}
              transition={{ duration: ring.duration, repeat: Infinity, ease: 'linear' }}
            />
          ))
        : null}

      {selectedAvatarEffect === 'glitch'
        ? [0, 1, 2].map((i) => (
            <Motion.span
              key={`glitch-band-${i}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '-6px',
                right: '-6px',
                top: `${18 + i * 22}%`,
                height: i === 1 ? 8 : 6,
                borderRadius: 999,
                background: i === 1
                  ? 'linear-gradient(90deg, rgba(34,211,238,0.12), rgba(34,211,238,0.65), rgba(129,140,248,0.12))'
                  : 'linear-gradient(90deg, rgba(34,211,238,0), rgba(34,211,238,0.35), rgba(34,211,238,0))',
                pointerEvents: 'none',
                zIndex: 3,
                mixBlendMode: 'screen',
              }}
              animate={{ x: [0, i % 2 ? 6 : -6, 0], opacity: [0.15, 0.75, 0.15] }}
              transition={{ duration: 0.42 + i * 0.09, repeat: Infinity, ease: 'easeInOut', delay: i * 0.05 }}
            />
          ))
        : null}

      {selectedAvatarEffect === 'solarstorm'
        ? [0, 1, 2, 3].map((i) => (
            <Motion.span
              key={`solar-ray-${i}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 2,
                height: avatarSize * 0.64,
                marginLeft: -1,
                marginTop: -(avatarSize * 0.32),
                transformOrigin: '50% 50%',
                borderRadius: 999,
                background: 'linear-gradient(180deg, rgba(254,215,170,0), rgba(254,215,170,0.9), rgba(254,215,170,0))',
                pointerEvents: 'none',
                zIndex: 2,
                filter: 'drop-shadow(0 0 8px rgba(251,146,60,0.8))',
              }}
              animate={{ rotate: [i * 45, i * 45 + 180], opacity: [0.1, 0.82, 0.1] }}
              transition={{ duration: 1.55 + i * 0.12, repeat: Infinity, ease: 'linear' }}
            />
          ))
        : null}

      {picture ? (
        <img src={picture} alt="Current profile" className="profile-live-avatar-image" />
      ) : (
        <div className="profile-live-avatar-fallback">
          <UserRound size={24} />
        </div>
      )}
    </div>
  );
}

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { token, user, login } = useAuth();
  const { stats, addStreakForTesting, setStreakForTesting } = useDeck();

  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [picture, setPicture] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [selectedEffect, setSelectedEffect] = React.useState(() =>
    getDashboardOverlayEffectFromStorage()
  );
  const [selectedAvatarEffect, setSelectedAvatarEffect] = React.useState(() =>
    parseProfileAvatarEffect(localStorage.getItem(AVATAR_EFFECT_KEY))
  );
  const currentStreak = Number(stats?.streak?.current || 0);

  React.useEffect(() => {
    const handleStorage = (event) => {
      if (!event.key || event.key === OVERLAY_EFFECT_KEY) {
        setSelectedEffect(getDashboardOverlayEffectFromStorage());
      }
      if (!event.key || event.key === AVATAR_EFFECT_KEY) {
        setSelectedAvatarEffect(parseProfileAvatarEffect(localStorage.getItem(AVATAR_EFFECT_KEY)));
      }
    };

    const handleSettingsUpdated = (event) => {
      if (event?.detail?.key === OVERLAY_EFFECT_KEY) {
        setSelectedEffect(parseDashboardOverlayEffect(event.detail.value));
      }
      if (event?.detail?.key === AVATAR_EFFECT_KEY) {
        setSelectedAvatarEffect(parseProfileAvatarEffect(event.detail.value));
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('app-settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('app-settings-updated', handleSettingsUpdated);
    };
  }, []);

  React.useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const controller = new AbortController();

    const loadProfile = async () => {
      try {
        const response = await fetch(`${BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || !data) {
          setError(data?.msg || 'Could not load your profile.');
          return;
        }

        setName(data.name || '');
        setUsername(data.username || '');
        setBio(data.bio || '');
        setPicture(data.picture || '');
        if (data.overlayEffect) {
          const parsedOverlay = parseDashboardOverlayEffect(data.overlayEffect);
          setSelectedEffect(parsedOverlay);
          localStorage.setItem(OVERLAY_EFFECT_KEY, parsedOverlay);
        }
        if (data.avatarEffect) {
          const parsedAvatar = parseProfileAvatarEffect(data.avatarEffect);
          setSelectedAvatarEffect(parsedAvatar);
          localStorage.setItem(AVATAR_EFFECT_KEY, parsedAvatar);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Network error while loading your profile.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();

    return () => {
      controller.abort();
    };
  }, [navigate, token]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!token || saving) return;

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedBio = bio.trim();
    const trimmedPicture = String(picture || '').trim();

    if (!trimmedName || !trimmedUsername) {
      setError('Name and username are required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${BASE_URL}/me/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          username: trimmedUsername,
          bio: trimmedBio,
          picture: trimmedPicture,
          overlayEffect: selectedEffect,
          avatarEffect: selectedAvatarEffect,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.msg || 'Failed to update your profile.');
        return;
      }

      const mergedUser = {
        ...(user || {}),
        name: data.name || trimmedName,
        username: data.username || trimmedUsername,
        bio: data.bio ?? trimmedBio,
        picture: data.picture ?? trimmedPicture,
        overlayEffect: data.overlayEffect || selectedEffect,
        avatarEffect: data.avatarEffect || selectedAvatarEffect,
      };

      login(token, mergedUser);
      localStorage.setItem(OVERLAY_EFFECT_KEY, parseDashboardOverlayEffect(mergedUser.overlayEffect));
      localStorage.setItem(AVATAR_EFFECT_KEY, parseProfileAvatarEffect(mergedUser.avatarEffect));
      window.dispatchEvent(
        new CustomEvent('app-settings-updated', {
          detail: { key: OVERLAY_EFFECT_KEY, value: parseDashboardOverlayEffect(mergedUser.overlayEffect) },
        })
      );
      window.dispatchEvent(
        new CustomEvent('app-settings-updated', {
          detail: { key: AVATAR_EFFECT_KEY, value: parseProfileAvatarEffect(mergedUser.avatarEffect) },
        })
      );
      setSuccess('Profile updated successfully.');
    } catch {
      setError('Network error while updating profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectEffect = (effectValue) => {
    const required = EFFECT_STREAK_UNLOCKS[effectValue] ?? 0;
    if (currentStreak < required) {
      setError(`Need ${required}-day streak to unlock ${effectValue}.`);
      return;
    }
    setError('');
    const parsed = parseDashboardOverlayEffect(effectValue);
    localStorage.setItem(OVERLAY_EFFECT_KEY, parsed);
    setSelectedEffect(parsed);
    window.dispatchEvent(
      new CustomEvent('app-settings-updated', {
        detail: { key: OVERLAY_EFFECT_KEY, value: parsed },
      })
    );
    setSuccess('Profile overlay effect updated.');
  };

  const handleSelectAvatarEffect = (effectValue) => {
    const required = AVATAR_EFFECT_STREAK_UNLOCKS[effectValue] ?? 0;
    if (currentStreak < required) {
      setError(`Need ${required}-day streak to unlock ${effectValue}.`);
      return;
    }
    setError('');
    const parsed = parseProfileAvatarEffect(effectValue);
    localStorage.setItem(AVATAR_EFFECT_KEY, parsed);
    setSelectedAvatarEffect(parsed);
    window.dispatchEvent(
      new CustomEvent('app-settings-updated', {
        detail: { key: AVATAR_EFFECT_KEY, value: parsed },
      })
    );
    setSuccess('Profile picture effect updated.');
  };

  const unlockedCount = OVERLAY_EFFECT_OPTIONS.filter((effect) => {
    const required = EFFECT_STREAK_UNLOCKS[effect.value] ?? 0;
    return currentStreak >= required;
  }).length;

  const unlockedAvatarCount = AVATAR_EFFECT_OPTIONS.filter((effect) => {
    const required = AVATAR_EFFECT_STREAK_UNLOCKS[effect.value] ?? 0;
    return currentStreak >= required;
  }).length;

  return (
    <div className="profile-edit-page">
      <header className="profile-edit-topbar">
        <button type="button" className="profile-edit-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="profile-edit-title-wrap">
          <div className="profile-edit-icon-wrap">
            <UserRound size={18} />
          </div>
          <div>
            <h2>Profile Settings</h2>
            <p>Manage your basic info and choose your profile effect.</p>
          </div>
        </div>
      </header>

      <section className="profile-edit-shell">
        <div className="profile-edit-main-card">
          {loading ? (
            <p className="profile-edit-note">Loading profile details...</p>
          ) : (
            <form className="profile-edit-form" onSubmit={handleSave}>
              <section className="profile-edit-section">
                <div className="profile-edit-section-head">
                  <h4>Basic Info</h4>
                  <p>These details are shown on your profile page.</p>
                </div>

                <div className="profile-edit-grid-two">
                  <label>
                    Display Name
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your display name"
                      maxLength={70}
                      required
                    />
                    <small>{name.trim().length}/70</small>
                  </label>

                  <label>
                    Username
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value.replace(/\s+/g, '').toLowerCase())}
                      placeholder="your_handle"
                      maxLength={40}
                      required
                    />
                    <small>Lowercase only. Spaces are removed automatically.</small>
                  </label>
                </div>

                <label>
                  Bio
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Tell others what you are learning."
                    maxLength={240}
                    rows={6}
                  />
                  <small>{bio.length}/240</small>
                </label>
              </section>

              {error ? <p className="profile-edit-error">{error}</p> : null}
              {success ? <p className="profile-edit-success">{success}</p> : null}

              <div className="profile-edit-actions">
                <button type="button" className="btn-secondary" onClick={() => navigate('/u/me')}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="profile-effect-card">
          <div className="profile-effect-head">
            <h4>Streak Effects</h4>
            <p>Pick any unlocked overlay and profile picture effect.</p>
          </div>

          <div className="profile-streak-stats">
            <div>
              <span>Current streak</span>
              <strong>{currentStreak} days</strong>
            </div>
            <div>
              <span>Unlocked effects</span>
              <strong>{unlockedCount}/{OVERLAY_EFFECT_OPTIONS.length}</strong>
            </div>
          </div>

          <div className="profile-effect-grid effect-horizontal-list">
            {OVERLAY_EFFECT_OPTIONS.map((effect) => {
              const required = EFFECT_STREAK_UNLOCKS[effect.value] ?? 0;
              const unlocked = currentStreak >= required;
              const active = selectedEffect === effect.value;
              return (
                <button
                  key={effect.value}
                  type="button"
                  className={`effect-tile ${active ? 'is-active' : ''} ${unlocked ? 'is-unlocked' : 'is-locked'}`}
                  disabled={!unlocked}
                  onClick={() => handleSelectEffect(effect.value)}
                >
                  <span
                    className="effect-tile-preview"
                    style={{ backgroundImage: `url(${EFFECT_PREVIEW_IMAGES[effect.value] || '/effects/none.svg'})` }}
                  />
                  <span className="effect-tile-name">{effect.label}</span>
                  <span className="effect-tile-lock">
                    {unlocked ? <Flame size={12} /> : <Lock size={12} />}
                    {unlocked ? 'Unlocked' : `${required}d streak`}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="profile-avatar-effects-section">
            <div className="profile-live-avatar-preview">
              <p>Live PFP Preview</p>
              <LiveAvatarPreview picture={picture} selectedAvatarEffect={selectedAvatarEffect} />
              {!picture ? <small>No Google profile picture found. Showing fallback avatar.</small> : null}
            </div>

            <div className="profile-effect-subhead">
              <h5>PFP Effects</h5>
              <p>{unlockedAvatarCount}/{AVATAR_EFFECT_OPTIONS.length} unlocked</p>
            </div>
            <div className="profile-effect-grid profile-avatar-effect-grid effect-horizontal-list">
              {AVATAR_EFFECT_OPTIONS.map((effect) => {
                const required = AVATAR_EFFECT_STREAK_UNLOCKS[effect.value] ?? 0;
                const unlocked = currentStreak >= required;
                const active = selectedAvatarEffect === effect.value;
                return (
                  <button
                    key={effect.value}
                    type="button"
                    className={`effect-tile avatar-effect-tile ${active ? 'is-active' : ''} ${unlocked ? 'is-unlocked' : 'is-locked'}`}
                    disabled={!unlocked}
                    onClick={() => handleSelectAvatarEffect(effect.value)}
                  >
                    <span className={`effect-tile-preview effect-tile-preview-avatar avatar-preview-${effect.value}`} />
                    <span className="effect-tile-name">{effect.label}</span>
                    <span className="effect-tile-lock">
                      {unlocked ? <Flame size={12} /> : <Lock size={12} />}
                      {unlocked ? 'Unlocked' : `${required}d streak`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="profile-streak-dev-tools">
            <span>Quick test streaks:</span>
            <button type="button" onClick={() => addStreakForTesting(5)}>+5</button>
            <button type="button" onClick={() => addStreakForTesting(15)}>+15</button>
            <button type="button" onClick={() => setStreakForTesting(30)}>Set 30</button>
            <button type="button" onClick={() => setStreakForTesting(0)}>Reset</button>
          </div>
        </aside>
      </section>
    </div>
  );
}


