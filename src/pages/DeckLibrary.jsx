import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useDeck } from '../context/DeckContext';
import { FolderGit2, Play, Edit2, Download, Upload, Wand2, Copy, Check, X, Search, Clock, Trash2, Globe, Shield, AlertTriangle, Link2, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PasteModal from '../components/PasteModal';
import { useAuth } from '../context/AuthContext';
import { measureTextBlock } from '../services/textMetrics';
import { isDateKeyOnOrBefore } from '../services/dateKey';

import chromeBrain from '../assets/chrome_brain.png';
import silverFluid from '../assets/silver_fluid.png';
import silverSphere from '../assets/silver_sphere.png';
import silverCircuit from '../assets/silver_circuit.png';
import obsidianCore from '../assets/obsidian_core.png';
import mercuryWave from '../assets/mercury_wave.png';
import silverHelix from '../assets/silver_helix.png';
import neuralNebula from '../assets/neural_nebula.png';
import silverNucleus from '../assets/silver_nucleus.png';
import obsidianTablet from '../assets/obsidian_tablet.png';
import mercurySplash from '../assets/mercury_splash.png';
import silverGrid from '../assets/silver_grid.png';
import neuralCrystal from '../assets/neural_crystal.png';
import stellarSupernova from '../assets/stellar_supernova.png';
import pulsarMagnetar from '../assets/pulsar_magnetar.png';
import nonEuclidean from '../assets/non_euclidean.png';
import topographicGlobe from '../assets/topographic_globe.png';
import tectonicMantle from '../assets/tectonic_mantle.png';
import molecularLattice from '../assets/molecular_lattice.png';

const LIBRARY_TITLE_FONT = '700 20px Syne';
const LIBRARY_TITLE_LINE_HEIGHT = 24;
const LIBRARY_TITLE_MAX_LINES = 2;
const HOVER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const STRONG_EASE_OUT = [0.23, 1, 0.32, 1];
const INTERACTIVE_TRANSITION = 'background-color 180ms cubic-bezier(0.23, 1, 0.32, 1), border-color 180ms cubic-bezier(0.23, 1, 0.32, 1), color 180ms cubic-bezier(0.23, 1, 0.32, 1), opacity 180ms cubic-bezier(0.23, 1, 0.32, 1)';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const PROMPT_TEMPLATE = `You are a world-class cognitive science AI specializing in generating hyper-optimized flashcards.

Generate a highly comprehensive set of flashcards (between 10 and 20 nodes) for the following topic:

[ENTER YOUR TOPIC HERE]

Requirements:
- Each flashcard must have a concise "front" (the concept, question, or term)
- Each flashcard must have an accurate "back" (the explanation or answer)
- "back" may include simple Markdown when useful (bullets, emphasis, inline code, code blocks, links)
- For formulas, use KaTeX-compatible LaTeX delimiters: inline $...$ and block $$...$$
- IMPORTANT: output valid JSON strings, so every backslash must be escaped as \\\\ (double backslash)
- Example JSON-safe formula string: "$\\\\sum_{i=1}^{n} i = \\\\frac{n(n+1)}{2}$"
- Return ONLY raw JSON — no markdown wrapping, no explanation text
- Format MUST be exactly:
[
  { "front": "Question or term", "back": "Answer or explanation" },
  { "front": "Question or term", "back": "Answer or explanation" }
]`;

function PromptModal({ onClose, shouldReduceMotion }) {
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef(null);
  const copyResetTimeoutRef = useRef(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    document.addEventListener('keydown', handleEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(PROMPT_TEMPLATE).then(() => {
      setCopied(true);
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => setCopied(false), 2500);
    });
  };

  const promptTitleId = 'deck-library-prompt-modal-title';
  const promptDescriptionId = 'deck-library-prompt-modal-description';

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: STRONG_EASE_OUT }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
      onClick={onClose}
    >
      <Motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.24, ease: STRONG_EASE_OUT }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={promptTitleId}
        aria-describedby={promptDescriptionId}
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-2xl)', padding: '2rem', maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 id={promptTitleId} style={{ fontFamily: 'var(--font-display)', color: 'white', margin: 0, fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wand2 size={22} color="var(--primary)" /> AI Prompt Template
            </h2>
            <p id={promptDescriptionId} style={{ color: 'var(--secondary)', margin: '0.4rem 0 0 0', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
              Copy this and paste it into ChatGPT, Claude, Gemini, or any AI. Replace the topic, get the JSON, then import it!
            </p>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="Close AI prompt template" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Prompt Box */}
        <div style={{ position: 'relative' }}>
          <pre style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#d4d4d8', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: '320px', overflowY: 'auto' }}>
            {PROMPT_TEMPLATE}
          </pre>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.65rem 1.2rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--secondary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, transition: INTERACTIVE_TRANSITION }}>
            Close
          </button>
          <button type="button" onClick={handleCopy} style={{ padding: '0.65rem 1.5rem', background: copied ? '#22c55e' : 'var(--primary)', color: 'black', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background-color 200ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
            {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Prompt</>}
          </button>
        </div>

        {/* Workflow hint */}
        <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 'var(--radius-md)', padding: '1rem 1.2rem' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--primary)' }}>How to use:</strong> Copy prompt → paste into any AI → replace [ENTER YOUR TOPIC] → get the JSON back → save it as a <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>.json</code> file → use the Import button in the Library.
          </p>
        </div>
      </Motion.div>
    </Motion.div>
  );
}

// Basic toxic content detection — checks all card fronts + backs + title
const TOXIC_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|nigger|nigga|faggot|cunt|whore|slut|rape|murder|kill yourself|kys|suicide|terrorist|nazi|genocide)\b/i
];
function hasToxicContent(deck) {
  const texts = [
    deck?.title || '',
    ...((deck?.cards || []).flatMap(c => [c.front, c.back]))
  ].join(' ');
  return TOXIC_PATTERNS.some(p => p.test(texts));
}

function isDeckDiscoverListed(deck) {
  if (typeof deck?.isDiscoverable === 'boolean') return deck.isDiscoverable;
  // Legacy compatibility: previously discover listing was keyed by isPublic.
  return Boolean(deck?.isPublic && deck?.publishedBy?.userId);
}

function PublishConfirmModal({ deck, onConfirm, onClose, shouldReduceMotion }) {
  const [agreed, setAgreed] = useState(false);
  const closeButtonRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const toxic = hasToxicContent(deck);
  const listedOnDiscover = isDeckDiscoverListed(deck);

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    document.addEventListener('keydown', handleEscape);
    if (toxic) {
      closeButtonRef.current?.focus();
    } else {
      confirmButtonRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [onClose, toxic]);

  const publishTitleId = 'deck-library-publish-modal-title';
  const publishDescriptionId = 'deck-library-publish-modal-description';

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: STRONG_EASE_OUT }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
    >
      <Motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 14 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
        transition={shouldReduceMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 280, damping: 30 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={publishTitleId}
        aria-describedby={publishDescriptionId}
        style={{ background: '#111', border: `1px solid ${toxic ? 'rgba(239,68,68,0.35)' : 'rgba(99,179,237,0.25)'}`, borderRadius: 'var(--radius-xl)', padding: '2.5rem', maxWidth: '460px', width: '100%', boxShadow: '0 40px 80px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: toxic ? 'rgba(239,68,68,0.15)' : 'rgba(99,179,237,0.12)', border: `1px solid ${toxic ? 'rgba(239,68,68,0.35)' : 'rgba(99,179,237,0.35)'}`, borderRadius: '50%', padding: '0.65rem', display: 'flex' }}>
            {toxic ? <AlertTriangle size={18} color="#f87171" /> : <Globe size={18} color="#63b3ed" />}
          </div>
          <h3 id={publishTitleId} style={{ fontFamily: 'var(--font-display)', color: 'white', margin: 0, fontSize: '1.4rem' }}>
            {toxic ? 'Content Policy Violation' : listedOnDiscover ? 'Remove from Discover?' : 'Publish to Discover?'}
          </h3>
        </div>

        {/* Toxic warning */}
        {toxic ? (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', padding: '1rem 1.2rem' }}>
            <p id={publishDescriptionId} style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#fca5a5', lineHeight: 1.6 }}>
              ⚠️ This deck contains <strong>potentially harmful or toxic content</strong> and cannot be published to the community Discover feed. Please review and remove any offensive material before sharing.
            </p>
          </div>
        ) : listedOnDiscover ? (
          <p id={publishDescriptionId} style={{ margin: 0, fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            <strong style={{ color: 'white' }}>{deck.title}</strong> will be removed from the Discover feed. It will no longer be visible to other users.
          </p>
        ) : (
          <>
            <p id={publishDescriptionId} style={{ margin: 0, fontFamily: 'var(--font-body)', color: 'var(--secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              <strong style={{ color: 'white' }}>{deck.title}</strong> ({deck.cards?.length || 0} nodes) will be visible to all users in the Discover feed. Other users will be able to save a copy to their library.
            </p>
            {/* Policy agreement */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', padding: '1rem 1.2rem' }}>
              <p style={{ margin: '0 0 0.85rem 0', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--secondary)', lineHeight: 1.5 }}>
                <Shield size={12} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                By publishing you confirm this deck does <strong style={{ color: 'white' }}>not contain</strong> harmful, toxic, adult, or copyrighted content.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: agreed ? 'white' : 'var(--secondary)', transition: 'color 0.2s' }}>
                  I agree to the community content guidelines
                </span>
              </label>
            </div>
          </>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            style={{ padding: '0.7rem 1.4rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--secondary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, transition: INTERACTIVE_TRANSITION }}
          >
            {toxic ? 'Got it' : 'Cancel'}
          </button>
          {!toxic && (
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={onConfirm}
              disabled={!listedOnDiscover && !agreed}
              style={{ padding: '0.7rem 1.6rem', background: listedOnDiscover ? 'rgba(239,68,68,0.85)' : 'rgba(99,179,237,0.85)', border: '1px solid transparent', color: 'white', borderRadius: 'var(--radius-md)', cursor: (!listedOnDiscover && !agreed) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: (!listedOnDiscover && !agreed) ? 0.4 : 1, transition: INTERACTIVE_TRANSITION }}
            >
              <Globe size={14} /> {listedOnDiscover ? 'Remove' : 'Publish Now'}
            </button>
          )}
        </div>
      </Motion.div>
    </Motion.div>
  );
}

function DeckLibrarySkeletonGrid({ isCompact, shouldReduceMotion }) {
  const skeletonCount = isCompact ? 6 : 8;
  const skeletonIds = Array.from({ length: skeletonCount }, (_, index) => `deck-skeleton-${index}`);

  return (
    <div>
      <div role="status" aria-live="polite" style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '0.88rem', marginBottom: '1rem' }}>
        Loading your decks...
      </div>
      <div className="app-content-visibility-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isCompact ? 220 : 300}px, 1fr))`, gap: isCompact ? '1rem' : '2rem' }}>
        {skeletonIds.map((id) => (
          <Motion.div
            key={id}
            initial={{ opacity: 0.56 }}
            animate={shouldReduceMotion ? { opacity: 0.62 } : { opacity: [0.52, 0.78, 0.52] }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'var(--glass-surface)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            aria-hidden="true"
          >
            <div style={{ height: '140px', background: 'linear-gradient(110deg, rgba(255,255,255,0.03), rgba(255,255,255,0.09), rgba(255,255,255,0.03))' }} />
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ width: '72%', height: '16px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)' }} />
              <div style={{ width: '54%', height: '16px', borderRadius: '999px', background: 'rgba(255,255,255,0.09)' }} />
              <div style={{ width: '88%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ marginTop: '1.05rem', width: '100%', height: '38px', borderRadius: 'var(--radius-sm)', background: 'rgba(217,119,6,0.18)' }} />
            </div>
          </Motion.div>
        ))}
      </div>
    </div>
  );
}

export default function DeckLibrary() {
  const { decks, isDecksLoading, addDeck, removeDeck, publishDeck } = useDeck();
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const importRef = useRef(null);
  const importMenuRef = useRef(null);
  const openDeckMenuRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const copiedDeckTimeoutRef = useRef(null);
  const deleteCancelButtonRef = useRef(null);
  const [canHover, setCanHover] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(HOVER_MEDIA_QUERY).matches : false));
  const [showPrompt, setShowPrompt] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [importError, setImportError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLabel, setActiveLabel] = useState(null);
  const [dueOnly, setDueOnly] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(null); // deck object awaiting publish confirm
  const [copiedDeckId, setCopiedDeckId] = useState(null);
  const [openMenuDeckId, setOpenMenuDeckId] = useState(null);
  const [toast, setToast] = useState(null);
  const [isCompact, setIsCompact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 900 : false));
  const [visibleDeckCount, setVisibleDeckCount] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 900 ? 12 : 18));
  const loadMoreRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ msg, type });
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      if (copiedDeckTimeoutRef.current) {
        window.clearTimeout(copiedDeckTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(HOVER_MEDIA_QUERY);
    const handleChange = (event) => setCanHover(event.matches);

    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    let rafId = null;
    const onResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const compact = window.innerWidth < 900;
        setIsCompact(compact);
        setVisibleDeckCount(compact ? 12 : 18);
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!showImportMenu) return;
      if (importMenuRef.current && !importMenuRef.current.contains(event.target)) {
        setShowImportMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowImportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showImportMenu]);

  useEffect(() => {
    if (!openMenuDeckId) return undefined;

    const handleClickOutside = (event) => {
      if (openDeckMenuRef.current && !openDeckMenuRef.current.contains(event.target)) {
        setOpenMenuDeckId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenMenuDeckId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuDeckId]);

  useEffect(() => {
    if (!confirmDelete) return undefined;
    const previousActiveElement = document.activeElement;

    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setConfirmDelete(null);
    };

    document.addEventListener('keydown', handleEscape);
    deleteCancelButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [confirmDelete]);

  const getDeckShareLink = (deck) => {
    const username = deck?.publishedBy?.username || user?.username;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!username || !origin || !deck?.id) return '';
    return `${origin}/deck/${username}/${deck.id}`;
  };

  const handleCopyDeckLink = async (deck) => {
    const link = getDeckShareLink(deck);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedDeckId(deck.id);
      showToast('Share URL copied');
      if (copiedDeckTimeoutRef.current) {
        window.clearTimeout(copiedDeckTimeoutRef.current);
      }
      copiedDeckTimeoutRef.current = window.setTimeout(() => setCopiedDeckId(null), 1200);
    } catch {
      setCopiedDeckId(null);
      showToast('Could not copy URL', 'error');
    }
  };

  // Derive unique labels across all decks
  const allLabels = useMemo(() => {
    return [...new Set(decks.flatMap((d) => d.labels || []))];
  }, [decks]);

  // Apply search + label + due filter
  const filteredDecks = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return decks.filter((deck) => {
      const matchesSearch = deck.title.toLowerCase().includes(query);
      const matchesLabel = activeLabel ? (deck.labels || []).includes(activeLabel) : true;
      const matchesDue = dueOnly
        ? deck.cards.some((c) => !c.nextReview || isDateKeyOnOrBefore(c.nextReview))
        : true;
      return matchesSearch && matchesLabel && matchesDue;
    });
  }, [decks, searchQuery, activeLabel, dueOnly]);

  const libraryBatchSize = isCompact ? 8 : 12;

  const visibleFilteredDecks = useMemo(() => {
    return filteredDecks.slice(0, visibleDeckCount);
  }, [filteredDecks, visibleDeckCount]);

  const libraryTitleMetrics = useMemo(() => {
    const metricsByDeck = new Map();
    const titleWidth = isCompact ? 172 : 252;

    for (const deck of visibleFilteredDecks) {
      const metricKey = deck.id || deck.title;
      if (!metricKey) continue;

      metricsByDeck.set(
        metricKey,
        measureTextBlock(deck.title, {
          font: LIBRARY_TITLE_FONT,
          maxWidth: titleWidth,
          lineHeight: LIBRARY_TITLE_LINE_HEIGHT,
          maxLines: LIBRARY_TITLE_MAX_LINES,
        })
      );
    }

    return metricsByDeck;
  }, [visibleFilteredDecks, isCompact]);

  const hasMoreDecks = visibleDeckCount < filteredDecks.length;

  const resetVisibleDeckCount = () => {
    setVisibleDeckCount(isCompact ? 12 : 18);
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    resetVisibleDeckCount();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    resetVisibleDeckCount();
  };

  const handleToggleDueOnly = () => {
    setDueOnly((prev) => !prev);
    resetVisibleDeckCount();
  };

  const handleShowAllLabels = () => {
    setActiveLabel(null);
    resetVisibleDeckCount();
  };

  const handleToggleLabel = (label) => {
    setActiveLabel((prev) => (prev === label ? null : label));
    resetVisibleDeckCount();
  };

  useEffect(() => {
    if (!hasMoreDecks) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleDeckCount((count) => Math.min(count + libraryBatchSize, filteredDecks.length));
      },
      { root: null, rootMargin: '320px 0px', threshold: 0.01 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreDecks, libraryBatchSize, filteredDecks.length]);

  // Shared parser for both file and paste imports
  const parseDeckJSON = (raw, fallbackTitle = 'Imported Deck') => {
    let cleaned = raw.trim();
    // Strip markdown code fences (```json … ```)
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/i, '').trim();

    const parsed = JSON.parse(cleaned);
    let cards = [], title = fallbackTitle, labels = ['Imported'], thumbnail = '';

    if (Array.isArray(parsed)) {
      cards = parsed;
    } else if (parsed.cards && Array.isArray(parsed.cards)) {
      cards = parsed.cards;
      title = parsed.title || title;
      labels = parsed.labels || labels;
      thumbnail = parsed.thumbnail || '';
    } else {
      throw new Error('Unrecognized JSON format. Expected an array of cards or a Drizzlix export.');
    }

    if (
      cards.length === 0
      || cards.some((card) => (
        typeof card?.front !== 'string'
        || typeof card?.back !== 'string'
        || !card.front.trim()
        || !card.back.trim()
      ))
    ) {
      throw new Error('Cards must have "front" and "back" fields.');
    }

    return {
      id: generateId(), title, labels, thumbnail,
      cards: cards.map((c) => ({
        id: generateId(), front: c.front.trim(), back: c.back.trim(),
        lastOpened: null, nextReview: null, interval: 0, repetition: 0, easeFactor: 2.5
      }))
    };
  };

  const getFallbackImage = (idStr) => {
    const images = [
      chromeBrain, silverFluid, silverSphere, silverCircuit, obsidianCore, 
      mercuryWave, silverHelix, neuralNebula, silverNucleus, obsidianTablet, 
      mercurySplash, silverGrid, neuralCrystal, stellarSupernova, pulsarMagnetar,
      nonEuclidean, topographicGlobe, tectonicMantle, molecularLattice
    ];
    const charCode = [...String(idStr)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return images[charCode % images.length];
  };

  const getCardsDueCount = (cards) => {
    return cards.filter(c => !c.nextReview || isDateKeyOnOrBefore(c.nextReview)).length;
  };

  // EXPORT: Download deck as JSON file
  const handleExport = (deck) => {
    const exportData = {
      title: deck.title,
      labels: deck.labels || [],
      thumbnail: deck.thumbnail || '',
      cards: deck.cards.map(c => ({ front: c.front, back: c.back }))
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // IMPORT: Parse JSON file and add as new deck
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const newDeck = parseDeckJSON(event.target.result, file.name.replace('.json', '').replace(/_/g, ' '));
        addDeck(newDeck);
      } catch (err) { setImportError(err.message); }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  return (
    <div style={{ padding: isCompact ? '0.9rem 1rem 0' : '0.9rem 3rem 0', width: '100%', maxWidth: '1200px', margin: '0 auto', color: 'white' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="title-sparkle-effect" style={{ fontFamily: 'var(--font-display)', fontSize: isCompact ? '2rem' : '2.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', letterSpacing: '-0.03em', background: 'linear-gradient(180deg, #fff 0%, #9ca3af 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <FolderGit2 size={isCompact ? 24 : 28} color="rgba(147,197,253,0.95)" style={{ filter: 'drop-shadow(0 0 10px rgba(147,197,253,0.5))' }} />
          Archived Syntheses
        </h2>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div ref={importMenuRef} style={{ position: 'relative' }}>
            <Motion.button
              type="button"
              onClick={() => setShowImportMenu(prev => !prev)}
              aria-haspopup="menu"
              aria-expanded={showImportMenu}
              aria-controls="deck-library-import-menu"
              whileHover={canHover ? { backgroundColor: 'rgba(255,255,255,0.08)' } : undefined}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18, ease: STRONG_EASE_OUT }}
              style={{ padding: '0.6rem 1.1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: INTERACTIVE_TRANSITION }}
            >
              <MoreHorizontal size={15} /> Import Options
            </Motion.button>

            <AnimatePresence>
              {showImportMenu && (
                <Motion.div
                  id="deck-library-import-menu"
                  role="menu"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: STRONG_EASE_OUT }}
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 0.45rem)', minWidth: '210px', background: 'rgba(10,10,10,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0.4rem', zIndex: 100, boxShadow: '0 12px 35px rgba(0,0,0,0.5)' }}
                >
                  <Motion.button
                    type="button"
                    role="menuitem"
                    onClick={() => { setShowPrompt(true); setShowImportMenu(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.58rem 0.65rem', background: 'transparent', border: 'none', color: 'white', borderRadius: '0.55rem', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                    whileHover={canHover ? { backgroundColor: 'rgba(255,255,255,0.07)' } : undefined}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Wand2 size={15} color="var(--primary)" /> AI Prompt
                  </Motion.button>
                  <Motion.button
                    type="button"
                    role="menuitem"
                    onClick={() => { setShowPaste(true); setImportError(null); setShowImportMenu(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.58rem 0.65rem', background: 'transparent', border: 'none', color: 'white', borderRadius: '0.55rem', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                    whileHover={canHover ? { backgroundColor: 'rgba(255,255,255,0.07)' } : undefined}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Copy size={15} /> Paste JSON
                  </Motion.button>
                  <Motion.button
                    type="button"
                    role="menuitem"
                    onClick={() => { importRef.current.click(); setShowImportMenu(false); }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.58rem 0.65rem', background: 'transparent', border: 'none', color: 'white', borderRadius: '0.55rem', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                    whileHover={canHover ? { backgroundColor: 'rgba(255,255,255,0.07)' } : undefined}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Upload size={15} /> Import JSON
                  </Motion.button>
                </Motion.div>
              )}
            </AnimatePresence>
          </div>

          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
        </div>
      </div>

      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search decks..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.6rem 1rem 0.6rem 2.4rem', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = 'rgba(217,119,6,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          {searchQuery && (
            <button type="button" aria-label="Clear deck search" onClick={handleClearSearch} style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
          )}
        </div>

        {/* Filter chips container */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleToggleDueOnly}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              padding: '0.35rem 0.85rem', 
              borderRadius: 'var(--radius-full)', 
              border: `1px solid ${dueOnly ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`, 
              background: dueOnly ? 'rgba(217,119,6,0.12)' : 'transparent', 
              color: dueOnly ? 'var(--primary)' : 'var(--secondary)', 
              fontFamily: 'var(--font-body)', 
              fontSize: '0.78rem', 
              fontWeight: 600, 
              cursor: 'pointer', 
              transition: INTERACTIVE_TRANSITION, 
              textTransform: 'uppercase', 
              letterSpacing: '0.04em' 
            }}
          >
            <Clock size={14} />
            Due Today
          </button>

          <div style={{ width: '1px', height: '1.2rem', background: 'rgba(255,255,255,0.1)', margin: '0 0.2rem' }} />

          <button
            type="button"
            onClick={handleShowAllLabels}
            style={{ padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-full)', border: `1px solid ${!activeLabel ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`, background: !activeLabel ? 'rgba(217,119,6,0.12)' : 'transparent', color: !activeLabel ? 'var(--primary)' : 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: INTERACTIVE_TRANSITION, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >All</button>
          
          {allLabels.map(label => (
            <button
              type="button"
              key={label}
              onClick={() => handleToggleLabel(label)}
              style={{ padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-full)', border: `1px solid ${activeLabel === label ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`, background: activeLabel === label ? 'rgba(217,119,6,0.12)' : 'transparent', color: activeLabel === label ? 'var(--primary)' : 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: INTERACTIVE_TRANSITION, textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >{label}</button>
          ))}
        </div>

      </div>
      <AnimatePresence>
        {importError && (
          <Motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '1rem 1.5rem', marginBottom: '1.5rem', color: '#fca5a5', fontFamily: 'var(--font-body)', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>⚠️ {importError}</span>
            <button type="button" aria-label="Dismiss import error" onClick={() => setImportError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><X size={16} /></button>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Deck Grid */}
      {isDecksLoading ? (
        <DeckLibrarySkeletonGrid isCompact={isCompact} shouldReduceMotion={shouldReduceMotion} />
      ) : filteredDecks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-xl)', background: 'var(--glass-surface)' }}>
          <FolderGit2 size={48} color="var(--secondary)" style={{ marginBottom: '1rem' }} />
          <p style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>No active topologies found. Generate one or import a JSON deck.</p>
        </div>
      ) : (
        <div className="app-content-visibility-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isCompact ? 220 : 300}px, 1fr))`, gap: isCompact ? '1rem' : '2rem' }}>
          {visibleFilteredDecks.map((deck) => {
            const listedOnDiscover = isDeckDiscoverListed(deck);
            const titleMetricKey = deck.id || deck.title;
            const titleMetrics = titleMetricKey
              ? libraryTitleMetrics.get(titleMetricKey)
              : null;
            return (
            <Motion.div
              key={deck.id}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: STRONG_EASE_OUT }}
              style={{ background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
              whileHover={canHover && !shouldReduceMotion ? { backgroundColor: 'rgba(50, 50, 50, 0.4)' } : undefined}
            >
              <div style={{ width: '100%', height: '140px', overflow: 'hidden', position: 'relative' }}>
                <img loading="lazy" decoding="async" sizes="(max-width: 900px) 45vw, 300px" src={deck.thumbnail || getFallbackImage(deck.id)} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.7rem', color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                  {deck.cards.length} Total Nodes
                </div>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.25rem', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: LIBRARY_TITLE_MAX_LINES, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: `${titleMetrics?.height || LIBRARY_TITLE_LINE_HEIGHT}px` }}>{deck.title}</h4>

                {deck.labels && deck.labels.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {deck.labels.map((lbl, idx) => (
                      <span key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--primary)', fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</span>
                    ))}
                  </div>
                )}

                <div ref={openMenuDeckId === deck.id ? openDeckMenuRef : null} style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', paddingTop: '1rem', position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/study/${deck.id}`)}
                    style={{ flex: 1, padding: '0.6rem', background: 'var(--primary)', color: 'black', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 600, fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}
                  >
                    <Play size={14} /> {getCardsDueCount(deck.cards)} Due
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenMenuDeckId(prev => prev === deck.id ? null : deck.id)}
                    aria-label={`More actions for ${deck.title}`}
                    aria-haspopup="menu"
                    aria-expanded={openMenuDeckId === deck.id}
                    aria-controls={openMenuDeckId === deck.id ? `deck-library-menu-${deck.id}` : undefined}
                    title="More actions"
                    style={{ padding: '0.6rem 0.9rem', background: openMenuDeckId === deck.id ? 'rgba(255,255,255,0.08)' : 'transparent', border: '1px solid var(--glass-border)', color: 'var(--secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: INTERACTIVE_TRANSITION }}
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {openMenuDeckId === deck.id && (
                    <div id={`deck-library-menu-${deck.id}`} role="menu" style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 0.45rem)', background: 'rgba(12,12,12,0.98)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-md)', minWidth: '190px', boxShadow: '0 20px 40px rgba(0,0,0,0.65)', overflow: 'hidden', zIndex: 30 }}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOpenMenuDeckId(null); navigate(`/edit/${deck.id}`); }}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '0.65rem 0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        <Edit2 size={14} /> Edit deck
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOpenMenuDeckId(null); handleExport(deck); }}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '0.65rem 0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        <Download size={14} /> Export JSON
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { handleCopyDeckLink(deck); setOpenMenuDeckId(null); }}
                        disabled={!getDeckShareLink(deck)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: getDeckShareLink(deck) ? 'white' : 'rgba(255,255,255,0.35)', padding: '0.65rem 0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: getDeckShareLink(deck) ? 'pointer' : 'not-allowed', fontSize: '0.82rem' }}
                      >
                        {copiedDeckId === deck.id ? <Check size={14} /> : <Link2 size={14} />} {copiedDeckId === deck.id ? 'Copied' : 'Copy URL'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOpenMenuDeckId(null); setConfirmPublish(deck); }}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: listedOnDiscover ? '#93c5fd' : 'white', padding: '0.65rem 0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        <Globe size={14} /> {listedOnDiscover ? 'Remove from Discover' : 'Publish to Discover'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOpenMenuDeckId(null); setConfirmDelete(deck.id); }}
                        style={{ width: '100%', background: 'rgba(239,68,68,0.08)', border: 'none', color: '#fca5a5', padding: '0.65rem 0.8rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        <Trash2 size={14} /> Delete deck
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Motion.div>
            );
          })}
        </div>
      )}

      {hasMoreDecks && <div ref={loadMoreRef} style={{ height: 1 }} />}

      {/* Prompt Modal */}
      <AnimatePresence>
        {showPrompt && <PromptModal shouldReduceMotion={shouldReduceMotion} onClose={() => setShowPrompt(false)} />}
      </AnimatePresence>

      {/* Paste JSON Modal */}
      <AnimatePresence>
        {showPaste && <PasteModal onClose={() => setShowPaste(false)} onImport={(raw) => {
          try {
            const newDeck = parseDeckJSON(raw);
            addDeck(newDeck);
            setShowPaste(false);
          } catch (err) { setImportError(err.message); setShowPaste(false); }
        }} />}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '2rem'
            }}
          >
            <Motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
              transition={shouldReduceMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 280, damping: 30 }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="deck-library-delete-title"
              aria-describedby="deck-library-delete-description"
              style={{
                background: '#111',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-xl)',
                padding: '2.5rem',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(239,68,68,0.1) inset',
                display: 'flex', flexDirection: 'column', gap: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '50%', padding: '0.6rem', display: 'flex' }}>
                    <Trash2 size={18} color="#f87171" />
                  </div>
                  <h3 id="deck-library-delete-title" style={{ fontFamily: 'var(--font-display)', color: 'white', margin: 0, fontSize: '1.4rem' }}>Delete Deck?</h3>
                </div>
                <p id="deck-library-delete-description" style={{ fontFamily: 'var(--font-body)', color: 'var(--secondary)', margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>
                  This will permanently erase <strong style={{ color: 'white' }}>{decks.find(d => d.id === confirmDelete)?.title}</strong> and all its cognitive nodes. This action cannot be undone.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <Motion.button
                  ref={deleteCancelButtonRef}
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  whileHover={canHover ? { borderColor: 'rgba(255,255,255,0.3)' } : undefined}
                  whileTap={{ scale: 0.97 }}
                  style={{ padding: '0.7rem 1.4rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--secondary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, transition: INTERACTIVE_TRANSITION }}
                >
                  Cancel
                </Motion.button>
                <Motion.button
                  type="button"
                  onClick={() => { removeDeck(confirmDelete); showToast('Deck deleted successfully'); setConfirmDelete(null); }}
                  whileHover={canHover ? { backgroundColor: '#ef4444' } : undefined}
                  whileTap={{ scale: 0.97 }}
                  style={{ padding: '0.7rem 1.4rem', background: 'rgba(239,68,68,0.9)', border: '1px solid transparent', color: 'white', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', transition: INTERACTIVE_TRANSITION }}
                >
                  <Trash2 size={14} /> Delete Forever
                </Motion.button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Publish Confirmation Modal */}
      <AnimatePresence>
        {confirmPublish && (
          <PublishConfirmModal
            deck={confirmPublish}
            shouldReduceMotion={shouldReduceMotion}
            onClose={() => setConfirmPublish(null)}
            onConfirm={async () => {
              const target = confirmPublish;
              const result = await publishDeck(target.id);
              if (result && typeof result.isDiscoverable === 'boolean') {
                showToast(result.isDiscoverable ? 'Published to Discover' : 'Removed from Discover');
              } else {
                showToast('Could not update Discover listing', 'error');
              }
              setConfirmPublish(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <Motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: STRONG_EASE_OUT }}
            style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '1.25rem', zIndex: 1200, background: toast.type === 'error' ? 'rgba(127,29,29,0.92)' : 'rgba(22,101,52,0.92)', border: `1px solid ${toast.type === 'error' ? 'rgba(248,113,113,0.5)' : 'rgba(74,222,128,0.45)'}`, color: '#fff', borderRadius: '999px', padding: '0.55rem 0.95rem', fontFamily: 'var(--font-body)', fontSize: '0.84rem', fontWeight: 600, boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }}
          >
            {toast.msg}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

