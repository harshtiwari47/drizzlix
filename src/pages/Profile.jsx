import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDeck } from '../context/DeckContext';
import { useAuth } from '../context/AuthContext';
import {
  Globe, Bookmark, BookmarkCheck, Layers, Eye, ArrowLeft, Calendar,
  ChevronLeft, ChevronRight, X, User, Pencil
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import DashboardOverlayEffects from '../components/DashboardOverlayEffects';
import {
  AVATAR_EFFECT_KEY,
  OVERLAY_EFFECT_KEY,
  OVERLAY_INTENSITY_KEY,
  OVERLAY_SPEED_KEY,
  getDashboardOverlayEffectFromStorage,
  parseDashboardOverlayEffect,
  parseDashboardOverlayIntensity,
  parseDashboardOverlaySpeed,
  parseProfileAvatarEffect,
} from '../services/globalSettings';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/* ─── Card preview overlay (same as Discover) ─── */
function DeckPreviewOverlay({ deck, onClose, onSave, isSaved, isSaving, isNarrow }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = deck.cards || [];
  const card = cards[idx];

  const prev = () => { setIdx(i => Math.max(0, i - 1)); setFlipped(false); };
  const next = () => { setIdx(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); };

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isNarrow ? '0.7rem' : '2rem' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(10,10,10,0.98)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: isNarrow ? '1rem' : '1.5rem', width: '100%', maxWidth: isNarrow ? '100%' : '680px', boxShadow: '0 40px 100px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: isNarrow ? 'calc(100dvh - 1.4rem)' : '90vh' }}
      >
        <div style={{ padding: isNarrow ? '1rem 1rem 0.9rem' : '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '0.7rem' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'white', fontSize: isNarrow ? '1rem' : '1.3rem', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deck.title}</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--secondary)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex', transition: 'all 0.15s' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <motion.div animate={{ width: `${((idx + 1) / cards.length) * 100}%` }} transition={{ ease: 'easeOut', duration: 0.3 }} style={{ height: '100%', background: 'linear-gradient(90deg, rgba(99,179,237,0.8), rgba(99,179,237,0.4))' }} />
        </div>
        <div style={{ padding: isNarrow ? '0.65rem 1rem' : '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', flexShrink: 0, gap: '0.6rem', flexWrap: isNarrow ? 'wrap' : 'nowrap' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--secondary)' }}>Card <strong style={{ color: 'white' }}>{idx + 1}</strong> / <strong style={{ color: 'white' }}>{cards.length}</strong></span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Space to flip · ← → navigate</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: isNarrow ? '0 1rem 1rem' : '0 2rem 1.5rem' }}>
          <AnimatePresence mode="wait">
            <motion.div key={idx} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(99,179,237,0.05)', border: '1px solid rgba(99,179,237,0.15)', borderRadius: '1rem', padding: '1.25rem 1.5rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#63b3ed' }}>Concept</p>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'white', lineHeight: 1.6 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{card?.front || ''}</ReactMarkdown>
                </div>
              </div>
              {flipped ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.25rem 1.5rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary)' }}>Synthesis</p>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{card?.back || ''}</ReactMarkdown>
                  </div>
                </motion.div>
              ) : (
                <button onClick={() => setFlipped(true)} style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '1rem', color: 'var(--secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Eye size={15} /> Reveal Synthesis
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div style={{ padding: isNarrow ? '0.8rem 1rem 1rem' : '1rem 2rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, flexWrap: isNarrow ? 'wrap' : 'nowrap' }}>
          <button onClick={prev} disabled={idx === 0} style={{ padding: '0.6rem 0.9rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: idx === 0 ? 'rgba(255,255,255,0.2)' : 'var(--secondary)', borderRadius: 'var(--radius-sm)', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', transition: 'all 0.15s' }}><ChevronLeft size={16} /></button>
          <button onClick={next} disabled={idx === cards.length - 1} style={{ padding: '0.6rem 0.9rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: idx === cards.length - 1 ? 'rgba(255,255,255,0.2)' : 'var(--secondary)', borderRadius: 'var(--radius-sm)', cursor: idx === cards.length - 1 ? 'default' : 'pointer', display: 'flex', transition: 'all 0.15s' }}><ChevronRight size={16} /></button>
          <div style={{ flex: 1, display: isNarrow ? 'none' : 'block' }} />
          <button onClick={onSave} disabled={isSaved || isSaving} style={{ padding: '0.65rem 1.5rem', background: isSaved ? 'rgba(34,197,94,0.12)' : 'rgba(99,179,237,0.15)', border: `1px solid ${isSaved ? 'rgba(34,197,94,0.4)' : 'rgba(99,179,237,0.4)'}`, color: isSaved ? '#4ade80' : '#63b3ed', borderRadius: 'var(--radius-md)', cursor: isSaved ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', opacity: isSaving ? 0.6 : 1, width: isNarrow ? '100%' : 'auto' }}>
            {isSaved ? <><BookmarkCheck size={15} /> Saved</> : isSaving ? <>Saving…</> : <><Bookmark size={15} /> Save to Library</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Deck Card ─── */
function PublicDeckCard({ deck, onPreview, onSave, isSaved, isSaving }) {
  const cardTotal = deck.cards?.length || 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      style={{ background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
    >
      {deck.thumbnail
        ? <div style={{ width: '100%', height: '120px', overflow: 'hidden' }}><img src={deck.thumbnail} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
        : <div style={{ width: '100%', height: '120px', background: 'linear-gradient(135deg, rgba(99,179,237,0.08) 0%, rgba(0,0,0,0) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={32} color="rgba(99,179,237,0.25)" /></div>
      }
      <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontFamily: 'var(--font-body)', fontWeight: 700, color: deck.saves > 0 ? '#63b3ed' : 'var(--secondary)', border: '1px solid rgba(99,179,237,0.2)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <Bookmark size={10} /> {deck.saves || 0}
      </div>
      <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.6rem' }}>
        <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.1rem', lineHeight: 1.25, letterSpacing: '-0.02em' }}>{deck.title}</h4>
        {deck.labels?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {deck.labels.map((lbl, i) => <span key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.65rem', color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</span>)}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary)', fontSize: '0.78rem', fontFamily: 'var(--font-body)' }}>
          <Layers size={12} /> {cardTotal} {cardTotal === 1 ? 'node' : 'nodes'}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button onClick={onPreview} style={{ flex: 1, padding: '0.6rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 600, fontFamily: 'var(--font-body)', fontSize: '0.8rem', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'white'; }} onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--secondary)'; }}>
            <Eye size={13} /> Preview
          </button>
          <button onClick={onSave} disabled={isSaved || isSaving} style={{ flex: 1, padding: '0.6rem', background: isSaved ? 'rgba(34,197,94,0.1)' : 'rgba(99,179,237,0.1)', border: `1px solid ${isSaved ? 'rgba(34,197,94,0.35)' : 'rgba(99,179,237,0.35)'}`, color: isSaved ? '#4ade80' : '#63b3ed', borderRadius: 'var(--radius-sm)', cursor: isSaved ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 700, fontFamily: 'var(--font-body)', fontSize: '0.8rem', transition: 'all 0.2s', opacity: isSaving ? 0.6 : 1 }}>
            {isSaved ? <><BookmarkCheck size={13} /> Saved</> : isSaving ? <>Saving…</> : <><Bookmark size={13} /> Save</>}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileSkeletonLayout({ isNarrow, isTablet, shouldReduceMotion }) {
  const skeletonCount = isNarrow ? 2 : (isTablet ? 4 : 6);
  const skeletonIds = Array.from({ length: skeletonCount }, (_, index) => `profile-skeleton-${index}`);
  const avatarSize = isNarrow ? 68 : 90;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isNarrow ? '1.2rem' : '2rem' }}>
      <motion.div
        initial={{ opacity: 0.56 }}
        animate={shouldReduceMotion ? { opacity: 0.62 } : { opacity: [0.52, 0.8, 0.52] }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-2xl)', padding: isNarrow ? '1rem' : (isTablet ? '1.4rem' : '2.5rem'), display: 'flex', alignItems: isNarrow ? 'flex-start' : 'center', gap: isNarrow ? '0.9rem' : '2rem', rowGap: isNarrow ? '1.2rem' : undefined, flexWrap: 'wrap' }}
        aria-hidden="true"
      >
        <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', background: 'linear-gradient(120deg, rgba(99,179,237,0.2), rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: isNarrow ? '100%' : 200, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ width: isNarrow ? '72%' : '38%', height: '20px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ width: isNarrow ? '58%' : '24%', height: '14px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ width: '86%', height: '12px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ width: '74%', height: '12px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)' }} />
        </div>
      </motion.div>

      <div role="status" aria-live="polite" style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
        Loading profile and public decks...
      </div>

      <div className="app-content-visibility-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isNarrow ? 220 : 280}px, 1fr))`, gap: isNarrow ? '1rem' : '1.4rem' }}>
        {skeletonIds.map((id) => (
          <motion.div
            key={id}
            initial={{ opacity: 0.56 }}
            animate={shouldReduceMotion ? { opacity: 0.62 } : { opacity: [0.5, 0.78, 0.5] }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            aria-hidden="true"
          >
            <div style={{ height: '120px', background: 'linear-gradient(110deg, rgba(99,179,237,0.08), rgba(255,255,255,0.11), rgba(99,179,237,0.08))' }} />
            <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ width: '70%', height: '16px', borderRadius: '999px', background: 'rgba(255,255,255,0.11)' }} />
              <div style={{ width: '50%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.09)' }} />
              <div style={{ width: '84%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ flex: 1, height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(99,179,237,0.2)' }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Profile Page ─── */
export default function Profile() {
  const { username, deckId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user: authUser } = useAuth();
  const { saveToCopy, decks: myDecks } = useDeck();

  const [profile, setProfile] = useState(null);
  const [sharedDecks, setSharedDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewDeck, setPreviewDeck] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedProfileEffect, setSelectedProfileEffect] = useState(() =>
    getDashboardOverlayEffectFromStorage()
  );
  const [profileOverlayIntensity, setProfileOverlayIntensity] = useState(() =>
    parseDashboardOverlayIntensity(localStorage.getItem(OVERLAY_INTENSITY_KEY))
  );
  const [profileOverlaySpeed, setProfileOverlaySpeed] = useState(() =>
    parseDashboardOverlaySpeed(localStorage.getItem(OVERLAY_SPEED_KEY))
  );
  const [selectedAvatarEffect, setSelectedAvatarEffect] = useState(() =>
    parseProfileAvatarEffect(localStorage.getItem(AVATAR_EFFECT_KEY))
  );

  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  const isDirectDeckRoute = Boolean(deckId);
  const isTablet = viewportWidth < 1024;
  const isNarrow = viewportWidth < 760;
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    let rafId = null;
    const onResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setViewportWidth(window.innerWidth);
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (!isOwnProfile) return;

    const syncProfileEffect = () => {
      setSelectedProfileEffect(getDashboardOverlayEffectFromStorage());
      setProfileOverlayIntensity(parseDashboardOverlayIntensity(localStorage.getItem(OVERLAY_INTENSITY_KEY)));
      setProfileOverlaySpeed(parseDashboardOverlaySpeed(localStorage.getItem(OVERLAY_SPEED_KEY)));
      setSelectedAvatarEffect(parseProfileAvatarEffect(localStorage.getItem(AVATAR_EFFECT_KEY)));
    };

    const handleStorage = (event) => {
      if (!event.key || event.key.startsWith('settings.dashboardOverlay')) {
        syncProfileEffect();
      }
    };

    const handleSettingsUpdated = (event) => {
      if (event?.detail?.key === OVERLAY_EFFECT_KEY) {
        setSelectedProfileEffect(parseDashboardOverlayEffect(event.detail.value));
      }
      if (event?.detail?.key === OVERLAY_INTENSITY_KEY) {
        setProfileOverlayIntensity(parseDashboardOverlayIntensity(event.detail.value));
      }
      if (event?.detail?.key === OVERLAY_SPEED_KEY) {
        setProfileOverlaySpeed(parseDashboardOverlaySpeed(event.detail.value));
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
  }, [isOwnProfile]);

  const targetDeckId = deckId || new URLSearchParams(String(location.hash || '').replace(/^#/, '')).get('deck') || null;

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const isDiscoverListedDeck = (deck) => {
    if (!deck?.isPublic) return false;
    if (typeof deck.isDiscoverable === 'boolean') return deck.isDiscoverable;
    return Boolean(deck?.publishedBy?.userId);
  };

  const updateProfile = async () => {
    const trimmedName = nameInput.trim();
    const trimmedUser = usernameInput.trim().toLowerCase();
    const trimmedBio = bioInput.trim();
    const payload = {};
    if (trimmedName && trimmedName !== profile?.name) payload.name = trimmedName;
    if (trimmedUser !== (profile?.username || '')) payload.username = trimmedUser;
    if (trimmedBio !== (profile?.bio || '')) payload.bio = trimmedBio;
    if (Object.keys(payload).length === 0) { setEditingProfile(false); return; }
    try {
      const res = await fetch(`${BASE_URL}/me/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.msg || 'Update failed.', 'error'); return; }
      setProfile(p => ({ ...p, name: data.name, username: data.username, bio: data.bio || '' }));
      showToast('Profile updated successfully!');
      setEditingProfile(false);
    } catch { showToast('Network error.', 'error'); }
  };

  useEffect(() => {
    setProfile(null);
    setSharedDecks([]);
    setError(null);
    setLoading(true);

    const isMe = !username || username === 'me';

    if (isMe) {
      if (!token) { navigate('/login'); return; }
      // Fetch own full profile using token
      fetch(`${BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (!data || data.msg) { setError('Failed to load your profile.'); return; }
          setIsOwnProfile(true);
          setProfile(data);
          const persistedOverlay = parseDashboardOverlayEffect(data.overlayEffect || 'none');
          const persistedAvatar = parseProfileAvatarEffect(data.avatarEffect || 'none');
          setSelectedProfileEffect(persistedOverlay);
          setSelectedAvatarEffect(persistedAvatar);
          localStorage.setItem(OVERLAY_EFFECT_KEY, persistedOverlay);
          localStorage.setItem(AVATAR_EFFECT_KEY, persistedAvatar);
          // Load own public decks directly; avoids dependency on username availability.
          return fetch(`${BASE_URL}/decks`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(r => r.json())
            .then(allDecks => {
              if (Array.isArray(allDecks)) {
                setSharedDecks(allDecks.filter(isDiscoverListedDeck));
              }
            });
        })
        .catch(() => setError('Network error loading your profile.'))
        .finally(() => setLoading(false));
    } else {
      // Check if this is the logged-in user's own profile
      if (authUser?.username && authUser.username === username) setIsOwnProfile(true);
      else setIsOwnProfile(false);

      fetch(`${BASE_URL}/u/${username}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(async (data) => {
          setProfile(data.user);
          setSelectedProfileEffect(parseDashboardOverlayEffect(data?.user?.overlayEffect || 'none'));
          setSelectedAvatarEffect(parseProfileAvatarEffect(data?.user?.avatarEffect || 'none'));
          setSharedDecks(data.decks);

          if (isDirectDeckRoute && targetDeckId) {
            const directRes = await fetch(`${BASE_URL}/u/${username}/decks/${targetDeckId}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (directRes.ok) {
              const directData = await directRes.json();
              if (directData?.deck) {
                setPreviewDeck(directData.deck);
              }
            } else if (directRes.status === 403) {
              showToast('This deck is private. Only the owner can view this URL.', 'error');
            } else {
              showToast('Shared deck was not found or is not public.', 'error');
            }
          }
        })
        .catch(status => setError(status === 404 ? 'not_found' : 'error'))
        .finally(() => setLoading(false));
    }
  }, [username, token, authUser?.username, isDirectDeckRoute, targetDeckId]);

  useEffect(() => {
    if (!targetDeckId || loading || !sharedDecks.length) return;
    const matchedDeck = sharedDecks.find(d => String(d.id) === String(targetDeckId));
    if (matchedDeck) {
      setPreviewDeck(matchedDeck);
    } else if (!isDirectDeckRoute) {
      showToast('Shared deck was not found or is not public.', 'error');
    }
  }, [targetDeckId, loading, sharedDecks, isDirectDeckRoute]);

  const handleSave = async (deckId) => {
    if (!token) { showToast('Sign in to save decks.', 'error'); return; }
    if (savingId) return;
    setSavingId(deckId);
    try {
      await saveToCopy(deckId);
      setSavedIds(prev => new Set([...prev, deckId]));
      setSharedDecks(prev => prev.map(d => d.id === deckId ? { ...d, saves: (d.saves || 0) + 1 } : d));
      showToast('Deck saved to your library!');
    } catch (err) {
      showToast(err.message || 'Could not save.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const isSavedFn = (id) => savedIds.has(id) || myDecks.some(d => {
    const src = sharedDecks.find(s => s.id === id);
    return src && d.title === `${src.title} (copy)`;
  });

  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const totalSaves = sharedDecks.reduce((a, d) => a + (d.saves || 0), 0);
  const avatarSize = isNarrow ? 68 : 90;

  const avatarEffectStyles = {
    none: {
      enabled: false,
      frameGradient: 'transparent',
      auraGradient: 'transparent',
      badgeGradient: 'transparent',
      sparkleColor: 'rgba(255,255,255,0)',
      frameDuration: 0,
      pulseDuration: 0,
      sparkleDuration: 0,
    },
    angel: {
      enabled: true,
      frameGradient: 'conic-gradient(from 0deg, rgba(253,224,71,0.15), rgba(255,255,255,0.95), rgba(253,224,71,0.15))',
      auraGradient: 'radial-gradient(circle, rgba(254,240,138,0.44) 0%, rgba(253,224,71,0.18) 52%, rgba(253,224,71,0) 82%)',
      badgeGradient: 'linear-gradient(145deg, rgba(254,240,138,0.98), rgba(253,224,71,0.98))',
      sparkleColor: 'rgba(255,255,255,0.95)',
      frameDuration: 4,
      pulseDuration: 2.4,
      sparkleDuration: 3.2,
    },
    flame: {
      enabled: true,
      frameGradient: 'conic-gradient(from 0deg, rgba(251,146,60,0.14), rgba(251,146,60,0.86), rgba(185,28,28,0.72), rgba(251,146,60,0.14))',
      auraGradient: 'radial-gradient(circle, rgba(251,146,60,0.34) 0%, rgba(239,68,68,0.14) 52%, rgba(239,68,68,0) 84%)',
      badgeGradient: 'linear-gradient(145deg, rgba(251,146,60,0.98), rgba(220,38,38,0.98))',
      sparkleColor: 'rgba(251,191,36,0.95)',
      frameDuration: 3.8,
      pulseDuration: 1.7,
      sparkleDuration: 2.1,
    },
    lightning: {
      enabled: true,
      frameGradient: 'conic-gradient(from 0deg, rgba(125,211,252,0.2), rgba(219,234,254,1), rgba(129,140,248,0.92), rgba(125,211,252,0.2))',
      auraGradient: 'radial-gradient(circle, rgba(125,211,252,0.48) 0%, rgba(129,140,248,0.24) 52%, rgba(129,140,248,0) 84%)',
      badgeGradient: 'linear-gradient(145deg, rgba(125,211,252,0.98), rgba(129,140,248,0.98))',
      sparkleColor: 'rgba(219,234,254,0.98)',
      frameDuration: 1.25,
      pulseDuration: 0.65,
      sparkleDuration: 0.78,
    },
    vortex: {
      enabled: true,
      frameGradient: 'conic-gradient(from 40deg, rgba(59,130,246,0.2), rgba(167,139,250,0.98), rgba(236,72,153,0.86), rgba(59,130,246,0.2))',
      auraGradient: 'radial-gradient(circle, rgba(196,181,253,0.4) 0%, rgba(56,189,248,0.17) 52%, rgba(56,189,248,0) 84%)',
      badgeGradient: 'linear-gradient(145deg, rgba(167,139,250,0.98), rgba(236,72,153,0.98))',
      sparkleColor: 'rgba(244,114,182,0.95)',
      frameDuration: 2.1,
      pulseDuration: 1.15,
      sparkleDuration: 1.3,
    },
    glitch: {
      enabled: true,
      frameGradient: 'conic-gradient(from 0deg, rgba(34,211,238,0.2), rgba(16,185,129,0.98), rgba(129,140,248,0.9), rgba(34,211,238,0.2))',
      auraGradient: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, rgba(129,140,248,0.2) 52%, rgba(129,140,248,0) 84%)',
      badgeGradient: 'linear-gradient(145deg, rgba(34,211,238,0.98), rgba(129,140,248,0.98))',
      sparkleColor: 'rgba(110,231,255,0.96)',
      frameDuration: 1.15,
      pulseDuration: 0.8,
      sparkleDuration: 0.95,
    },
    solarstorm: {
      enabled: true,
      frameGradient: 'conic-gradient(from 0deg, rgba(245,158,11,0.2), rgba(249,115,22,0.95), rgba(220,38,38,0.85), rgba(245,158,11,0.2))',
      auraGradient: 'radial-gradient(circle, rgba(251,146,60,0.42) 0%, rgba(251,113,133,0.16) 56%, rgba(251,113,133,0) 85%)',
      badgeGradient: 'linear-gradient(145deg, rgba(251,146,60,0.98), rgba(220,38,38,0.98))',
      sparkleColor: 'rgba(254,215,170,0.98)',
      frameDuration: 1.55,
      pulseDuration: 0.9,
      sparkleDuration: 1,
    },
  };

  const avatarEffect = avatarEffectStyles[selectedAvatarEffect] || avatarEffectStyles.none;

  return (
    <div style={{ padding: isNarrow ? '0 0.85rem 2.4rem' : (isTablet ? '0 1.5rem 3rem' : '0 3rem 4rem'), width: '100%', maxWidth: '1100px', margin: '0 auto', color: 'white', boxSizing: 'border-box' }}>
      <DashboardOverlayEffects
        effect={selectedProfileEffect}
        intensity={profileOverlayIntensity}
        speed={profileOverlaySpeed}
      />

      {/* Back nav */}
      <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 600, padding: '0.5rem 0', marginBottom: isNarrow ? '1.1rem' : '2rem', transition: 'color 0.15s' }} onMouseOver={e => e.currentTarget.style.color = 'white'} onMouseOut={e => e.currentTarget.style.color = 'var(--secondary)'}>
        <ArrowLeft size={16} /> Back
      </button>

      {loading ? (
        <ProfileSkeletonLayout isNarrow={isNarrow} isTablet={isTablet} shouldReduceMotion={shouldReduceMotion} />
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', padding: '5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
        >
          <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>{error === 'not_found' ? '👤' : '⚠️'}</div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'white', letterSpacing: '-0.02em' }}>
            {error === 'not_found' ? `@${username} doesn't exist` : 'Something went wrong'}
          </h2>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.95rem' }}>
            {error === 'not_found'
              ? 'That username hasn\'t been claimed yet. Double-check the link.'
              : 'We couldn\'t load this profile. Please try again later.'}
          </p>
          <button onClick={() => navigate('/discover')} style={{ marginTop: '1.5rem', padding: '0.75rem 1.75rem', background: 'rgba(99,179,237,0.12)', border: '1px solid rgba(99,179,237,0.35)', color: '#63b3ed', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            Browse Discover
          </button>
        </motion.div>
      ) : (
        <>
          {/* Profile hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-2xl)', padding: isNarrow ? '1rem' : (isTablet ? '1.4rem' : '2.5rem'), marginBottom: isNarrow ? '1.2rem' : '2.5rem', display: 'flex', alignItems: isNarrow ? 'flex-start' : 'center', gap: isNarrow ? '0.9rem' : '2rem', rowGap: isNarrow ? '1.25rem' : undefined, flexWrap: 'wrap' }}
          >
            {/* Avatar */}
            <div style={{ minWidth: isNarrow ? '100%' : undefined, display: 'flex', justifyContent: isNarrow ? 'center' : 'flex-start' }}>
            <div style={{ position: 'relative', width: avatarSize, height: avatarSize, flexShrink: 0, margin: isNarrow ? '0.25rem auto 0.5rem' : 0 }}>
              {avatarEffect.enabled ? (
                <motion.span
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
                <motion.span
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
                    <motion.span
                      key={`angel-spark-${i}`}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: '-14px',
                        borderRadius: '50%',
                        pointerEvents: 'none',
                      }}
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
                    </motion.span>
                  ))
                : null}

              {selectedAvatarEffect === 'flame'
                ? [
                    { left: '26%', delay: 0, width: 10, height: 19 },
                    { left: '50%', delay: 0.22, width: 12, height: 23 },
                    { left: '74%', delay: 0.44, width: 10, height: 18 },
                  ].map((flame, idx) => (
                    <motion.span
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
                      animate={{
                        y: [0, -5, -2, -6, 0],
                        scaleX: [0.96, 1.04, 0.98, 1.03, 0.96],
                        scaleY: [0.9, 1.08, 0.96, 1.12, 0.9],
                        opacity: [0.48, 0.78, 0.6, 0.82, 0.48],
                      }}
                      transition={{ duration: 1.45, repeat: Infinity, ease: 'easeInOut', delay: flame.delay }}
                    />
                  ))
                : null}

              {selectedAvatarEffect === 'flame'
                ? [
                    { left: '33%', delay: 0.1 },
                    { left: '58%', delay: 0.5 },
                    { left: '70%', delay: 0.9 },
                  ].map((ember, idx) => (
                    <motion.span
                      key={`flame-ember-${idx}`}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: ember.left,
                        bottom: '-2px',
                        width: 3,
                        height: 3,
                        marginLeft: -1.5,
                        borderRadius: '50%',
                        background: 'rgba(254,215,170,0.9)',
                        boxShadow: '0 0 8px rgba(251,146,60,0.8)',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                      animate={{ y: [0, -10, -16], x: [0, 1, -1], opacity: [0.65, 0.45, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: ember.delay }}
                    />
                  ))
                : null}

              {selectedAvatarEffect === 'lightning'
                ? [
                    { left: '29%', delay: 0, rotate: -8, height: 26 },
                    { left: '50%', delay: 0.2, rotate: 4, height: 30 },
                    { left: '71%', delay: 0.42, rotate: -5, height: 24 },
                  ].map((bolt, i) => (
                    <motion.span
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

              {selectedAvatarEffect === 'lightning'
                ? [0, 1].map((i) => (
                    <motion.span
                      key={`lightning-ring-${i}`}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: i === 0 ? '-11px' : '-15px',
                        borderRadius: '50%',
                        border: '2px solid transparent',
                        borderTopColor: 'rgba(219,234,254,0.95)',
                        borderRightColor: i ? 'rgba(129,140,248,0.86)' : 'rgba(125,211,252,0.82)',
                        pointerEvents: 'none',
                        filter: 'drop-shadow(0 0 10px rgba(125,211,252,0.88))',
                      }}
                      animate={{ rotate: i === 0 ? 360 : -360, opacity: [0.12, 0.9, 0.12] }}
                      transition={{ duration: i === 0 ? 0.95 : 1.2, repeat: Infinity, ease: 'linear' }}
                    />
                  ))
                : null}

              {selectedAvatarEffect === 'lightning'
                ? [0, 1, 2].map((i) => (
                    <motion.span
                      key={`lightning-flash-${i}`}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: '-4px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(219,234,254,0.58) 0%, rgba(125,211,252,0.2) 44%, rgba(125,211,252,0) 76%)',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                      animate={{ opacity: [0.02, 0.42, 0.03] }}
                      transition={{ duration: 0.5 + i * 0.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.16 }}
                    />
                  ))
                : null}

              {selectedAvatarEffect === 'vortex'
                ? [
                    { inset: '-16px', duration: 2.8, opacity: [0.16, 0.88, 0.16], reverse: false },
                    { inset: '-10px', duration: 1.9, opacity: [0.12, 0.68, 0.12], reverse: true },
                  ].map((ring, i) => (
                    <motion.span
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

              {selectedAvatarEffect === 'vortex'
                ? [
                    { left: '20%', top: '16%', delay: 0 },
                    { left: '78%', top: '28%', delay: 0.35 },
                    { left: '62%', top: '80%', delay: 0.72 },
                  ].map((spark, i) => (
                    <motion.span
                      key={`vortex-spark-${i}`}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: spark.left,
                        top: spark.top,
                        width: 3,
                        height: 3,
                        marginLeft: -1.5,
                        marginTop: -1.5,
                        borderRadius: '50%',
                        background: i === 1 ? 'rgba(251,207,232,0.95)' : 'rgba(196,181,253,0.95)',
                        boxShadow: '0 0 8px rgba(196,181,253,0.8)',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                      animate={{ y: [0, -6, 0], x: [0, i === 1 ? 3 : -3, 0], opacity: [0.3, 0.95, 0.3] }}
                      transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut', delay: spark.delay }}
                    />
                  ))
                : null}

              {selectedAvatarEffect === 'glitch'
                ? [0, 1, 2].map((i) => (
                    <motion.span
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

              {selectedAvatarEffect === 'glitch'
                ? [0, 1].map((i) => (
                    <motion.span
                      key={`glitch-ring-${i}`}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: i === 0 ? '-11px' : '-15px',
                        borderRadius: '50%',
                        border: '2px solid transparent',
                        borderTopColor: i === 0 ? 'rgba(34,211,238,0.9)' : 'rgba(129,140,248,0.9)',
                        borderLeftColor: i === 0 ? 'rgba(34,211,238,0.45)' : 'rgba(129,140,248,0.45)',
                        pointerEvents: 'none',
                        filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.8))',
                      }}
                      animate={{ rotate: i === 0 ? 360 : -360, opacity: [0.1, 0.85, 0.1] }}
                      transition={{ duration: i === 0 ? 1.2 : 0.9, repeat: Infinity, ease: 'linear' }}
                    />
                  ))
                : null}

              {selectedAvatarEffect === 'solarstorm'
                ? [0, 1, 2, 3].map((i) => (
                    <motion.span
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

              {selectedAvatarEffect === 'solarstorm'
                ? [
                    { left: '24%', top: '18%', delay: 0 },
                    { left: '76%', top: '24%', delay: 0.3 },
                    { left: '30%', top: '78%', delay: 0.58 },
                    { left: '70%', top: '70%', delay: 0.88 },
                  ].map((ember, i) => (
                    <motion.span
                      key={`solar-ember-${i}`}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: ember.left,
                        top: ember.top,
                        width: 3.2,
                        height: 3.2,
                        marginLeft: -1.6,
                        marginTop: -1.6,
                        borderRadius: '50%',
                        background: 'rgba(254,215,170,0.95)',
                        boxShadow: '0 0 10px rgba(251,146,60,0.85)',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                      animate={{ scale: [0.85, 1.35, 0.85], opacity: [0.24, 0.95, 0.24] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: ember.delay }}
                    />
                  ))
                : null}

              {avatarEffect.enabled ? (
                <motion.span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 2,
                    borderRadius: '50%',
                    background: avatarEffect.frameGradient,
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                  animate={{ rotate: 360, opacity: [0.2, 0.45, 0.2] }}
                  transition={{ duration: avatarEffect.frameDuration + 1.5, repeat: Infinity, ease: 'linear' }}
                />
              ) : null}

              {profile?.picture
                ? <img src={profile.picture} alt={profile.name} style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1 }} />
                : <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', background: 'rgba(99,179,237,0.15)', border: '3px solid rgba(99,179,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}><User size={isNarrow ? 28 : 36} color="#63b3ed" /></div>
              }

              {selectedAvatarEffect !== 'none' ? (
                <motion.span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 2,
                    borderRadius: '50%',
                    zIndex: 2,
                    pointerEvents: 'none',
                    mixBlendMode: 'soft-light',
                    background: avatarEffect.auraGradient,
                  }}
                  animate={{ opacity: [0.14, 0.4, 0.14], scale: [0.99, 1.03, 0.99] }}
                  transition={{ duration: avatarEffect.pulseDuration, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : null}

            </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0, marginTop: isNarrow ? '0.15rem' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexDirection: isNarrow ? 'column' : 'row', gap: isNarrow ? '0.8rem' : '1rem', marginBottom: '1rem', width: '100%' }}>
                <div>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: isNarrow ? '1.35rem' : (isTablet ? '1.75rem' : '2.2rem'), letterSpacing: '-0.03em', lineHeight: 1.15 }}>{profile?.name || 'Unknown User'}</h2>
                  {profile?.username && (
                    <p style={{ margin: '0.2rem 0 0 0', fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#63b3ed', fontWeight: 600 }}>@{profile.username}</p>
                  )}
                  {profile?.bio && (
                    <p style={{ margin: '0.5rem 0 0 0', fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--secondary)', maxWidth: '560px', lineHeight: 1.6 }}>
                      {profile.bio}
                    </p>
                  )}
                </div>
                {isOwnProfile && (
                  <button
                    type="button"
                           onClick={() => navigate('/profile/edit')}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-full)', padding: isNarrow ? '0.62rem 0.9rem' : '0.5rem 1rem', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s', width: isNarrow ? '100%' : 'fit-content', minHeight: '38px', flexShrink: 0 }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  >
                    <Pencil size={14} /> Edit Profile
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {joinedDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary)', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}>
                    <Calendar size={13} /> Joined {joinedDate}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary)', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}>
                  <Globe size={13} /> <strong style={{ color: 'white' }}>{sharedDecks.length}</strong> shared decks
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary)', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}>
                  <Bookmark size={13} /> <strong style={{ color: 'white' }}>{totalSaves}</strong> total saves
                </div>
              </div>
            </div>
          </motion.div>

          {/* Shared Decks */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: '0 0 1.25rem 0', color: 'white', letterSpacing: '-0.02em' }}>Shared Decks</h3>
          </div>

          {sharedDecks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-xl)', background: 'var(--glass-surface)' }}>
              <Globe size={40} color="var(--secondary)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontWeight: 500, margin: 0 }}>No shared decks yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: isNarrow ? '0.9rem' : '1.5rem' }}>
              {sharedDecks.map(deck => (
                <PublicDeckCard
                  key={deck.id}
                  deck={deck}
                  onPreview={() => setPreviewDeck(deck)}
                  onSave={() => handleSave(deck.id)}
                  isSaved={isSavedFn(deck.id)}
                  isSaving={savingId === deck.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Preview Overlay */}
      <AnimatePresence>
        {previewDeck && (
          <DeckPreviewOverlay
            deck={previewDeck}
            onClose={() => setPreviewDeck(null)}
            onSave={() => handleSave(previewDeck.id)}
            isSaved={isSavedFn(previewDeck.id)}
            isSaving={savingId === previewDeck.id}
            isNarrow={isNarrow}
          />
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editingProfile && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
            onClick={() => setEditingProfile(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'rgba(15,15,15,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.5rem', padding: '2.5rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'white' }}>Edit Profile</h3>
                <button onClick={() => setEditingProfile(false)} style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: 0 }}><X size={20} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Display Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  maxLength={40}
                  placeholder="John Doe"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0.9rem', color: 'white', fontFamily: 'var(--font-body)', fontSize: '1rem', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,179,237,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username Handle</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '1rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-body)', fontSize: '1rem' }}>@</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    maxLength={20}
                    placeholder="johndoe"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0.9rem 0.9rem 0.9rem 2.2rem', color: 'white', fontFamily: 'var(--font-body)', fontSize: '1rem', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(99,179,237,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    onKeyDown={e => { if (e.key === 'Enter') updateProfile(); }}
                  />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)' }}>3-20 characters, letters, numbers, and underscores only.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bio</label>
                <textarea
                  value={bioInput}
                  onChange={e => setBioInput(e.target.value.slice(0, 240))}
                  maxLength={240}
                  placeholder="Tell others what you study..."
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', minHeight: '88px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0.9rem', color: 'white', fontFamily: 'var(--font-body)', fontSize: '0.92rem', outline: 'none', lineHeight: 1.5 }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,179,237,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)' }}>{bioInput.length}/240</span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setEditingProfile(false)}
                  style={{ flex: 1, padding: '0.85rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={updateProfile}
                  style={{ flex: 1, padding: '0.85rem', background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.4)', color: '#63b3ed', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: toast.type === 'error' ? 'rgba(239,68,68,0.9)' : 'rgba(20,20,20,0.95)', border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`, color: 'white', padding: '0.9rem 1.5rem', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontWeight: 600, backdropFilter: 'blur(8px)', zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

