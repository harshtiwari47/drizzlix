import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Plus, Search, Pin, PinOff, Trash2, FileText, Eye, Edit3, Check,
  Bold, Italic, List, Code, Link, Image, Hash, ChevronRight,
  Save, X, AlignLeft, Heading1, Heading2, Quote, PanelLeftClose, PanelLeftOpen, ChevronDown, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { measureTextBlock } from '../services/textMetrics';
import {
  enqueueOfflineSyncRequest,
  getOfflineSyncPendingCountByDedupePrefix,
  hasOfflineSyncRequestWithDedupeKey,
  removeOfflineSyncRequestByDedupeKey,
  subscribeToOfflineSyncQueue,
} from '../services/offlineSyncQueue';

const BASE = import.meta.env.VITE_API_URL || '/api';
const NOTES_CARD_TITLE_FONT = '700 14px Syne';
const NOTES_CARD_SNIPPET_FONT = '500 12px Geist';
const NOTES_CARD_TITLE_LINE_HEIGHT = 18;
const NOTES_CARD_SNIPPET_LINE_HEIGHT = 18;
const NOTES_KEEP_ALIVE_TTL_MS = 3 * 60 * 1000;
const OFFLINE_NOTE_ID_PREFIX = 'offline-note-';
const MOTION_EASE_OUT = [0.23, 1, 0.32, 1];
const MOTION_EASE_IN_OUT = [0.77, 0, 0.175, 1];
const FOCUS_RING = '0 0 0 2px rgba(167, 139, 250, 0.45)';

const isClientOffline = () => (typeof navigator !== 'undefined' ? !navigator.onLine : false);
const createOfflineNoteId = () => `${OFFLINE_NOTE_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const isOfflineNoteId = (id) => String(id || '').startsWith(OFFLINE_NOTE_ID_PREFIX);
const getNoteCreateDedupeKey = (id) => `notes:create:${id}`;
const getNoteUpdateDedupeKey = (id) => `notes:update:${id}`;
const getNoteDeleteDedupeKey = (id) => `notes:delete:${id}`;

let notesKeepAliveSnapshot = null;

const getNotesKeepAliveSnapshot = (token) => {
  if (!token || !notesKeepAliveSnapshot) return null;
  if (notesKeepAliveSnapshot.token !== token) return null;
  if (Date.now() - notesKeepAliveSnapshot.savedAt > NOTES_KEEP_ALIVE_TTL_MS) return null;
  return notesKeepAliveSnapshot.state;
};

const ACCENT_COLORS = {
  violet: '#a78bfa', blue: '#63b3ed', green: '#4ade80',
  amber: '#facc15', rose: '#f87171', cyan: '#22d3ee',
};

const _MOTION = motion;

/* ── Format helpers ──────────────────────────────────────────────────── */
const formatTime = (d) => {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const wordCount = (text = '') => text.trim().split(/\s+/).filter(Boolean).length;

/* ── Toolbar ─────────────────────────────────────────────────────────── */
const ToolbarBtn = ({ icon, label, shortcut, onClick }) => {
  const shouldReduceMotion = useReducedMotion();
  const title = shortcut ? `${label} (${shortcut})` : label;

  return (
    <motion.button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      whileHover={shouldReduceMotion
        ? {
          color: 'rgba(255,255,255,0.95)',
          backgroundColor: 'rgba(255,255,255,0.06)',
        }
        : {
          y: -1,
          color: 'rgba(255,255,255,0.95)',
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
      style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
        padding: '0.35rem', borderRadius: '0.4rem', display: 'flex', alignItems: 'center',
        transition: 'color 0.16s ease, background-color 0.16s ease'
      }}
    >
      {React.createElement(icon, { size: 16 })}
    </motion.button>
  );
};

const ACTION_TONES = {
  neutral: {
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.14)',
    color: 'rgba(255,255,255,0.75)',
    hoverBg: 'rgba(255,255,255,0.1)',
    hoverBorder: 'rgba(255,255,255,0.2)',
    hoverColor: 'rgba(255,255,255,0.95)',
  },
  accent: {
    bg: 'rgba(167,139,250,0.1)',
    border: 'rgba(255,255,255,0.2)',
    color: '#a78bfa',
    hoverBg: 'rgba(167,139,250,0.18)',
    hoverBorder: 'rgba(167,139,250,0.42)',
    hoverColor: '#c4b5fd',
  },
  success: {
    bg: 'rgba(74,222,128,0.1)',
    border: 'rgba(255,255,255,0.2)',
    color: '#4ade80',
    hoverBg: 'rgba(74,222,128,0.18)',
    hoverBorder: 'rgba(74,222,128,0.45)',
    hoverColor: '#86efac',
  },
  warning: {
    bg: 'rgba(250,204,21,0.12)',
    border: 'rgba(250,204,21,0.36)',
    color: '#facc15',
    hoverBg: 'rgba(250,204,21,0.2)',
    hoverBorder: 'rgba(250,204,21,0.5)',
    hoverColor: '#fde047',
  },
  danger: {
    bg: 'rgba(248,113,113,0.1)',
    border: 'rgba(248,113,113,0.28)',
    color: '#fda4af',
    hoverBg: 'rgba(248,113,113,0.18)',
    hoverBorder: 'rgba(248,113,113,0.46)',
    hoverColor: '#fecdd3',
  },
};

const IconActionButton = ({
  icon,
  label,
  title,
  onClick,
  tone = 'neutral',
  isActive = false,
  size = 34,
  disabled = false,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const palette = ACTION_TONES[tone] || ACTION_TONES.neutral;

  return (
    <motion.button
      type="button"
      aria-label={label}
      title={title || label}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled
        ? undefined
        : (shouldReduceMotion
          ? {
            backgroundColor: palette.hoverBg,
            borderColor: palette.hoverBorder,
            color: palette.hoverColor,
          }
          : {
            scale: 1.04,
            backgroundColor: palette.hoverBg,
            borderColor: palette.hoverBorder,
            color: palette.hoverColor,
          })}
      whileTap={disabled || shouldReduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: size,
        height: size,
        borderRadius: '0.6rem',
        flexShrink: 0,
        opacity: disabled ? 0.62 : 1,
        boxShadow: isActive ? '0 0 0 1px rgba(255,255,255,0.1) inset' : 'none',
        transition: 'background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease'
      }}
    >
      {React.createElement(icon, { size: 16 })}
    </motion.button>
  );
};

const insertMarkdown = (textareaRef, setBody, before, after = '') => {
  const el = textareaRef.current;
  if (!el) return;
  const start = el.selectionStart, end = el.selectionEnd;
  const selected = el.value.slice(start, end);
  const newText = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
  setBody(newText);
  setTimeout(() => {
    if (!el.isConnected) return;
    el.focus();
    el.setSelectionRange(start + before.length, end + before.length);
  }, 0);
};

const NoteListCard = React.memo(function NoteListCard({ note, isActive, onOpen, snippet, titleMetrics, snippetMetrics }) {
  const shouldReduceMotion = useReducedMotion();

  const handleOpen = useCallback(() => {
    onOpen(note);
  }, [note, onOpen]);

  return (
    <motion.button
      type="button"
      aria-pressed={isActive}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateX(-8px)' }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, transform: 'translateX(0px)' }}
      transition={{ duration: 0.18, ease: MOTION_EASE_OUT }}
      onClick={handleOpen}
      style={{
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        padding: '1rem', borderRadius: '0.9rem', cursor: 'pointer', marginBottom: '0.8rem',
        background: isActive ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)',
        backdropFilter: 'none',
        border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
        transition: 'background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease',
        position: 'relative', overflow: 'hidden', height: 'fit-content',
        willChange: 'transform'
      }}
      whileHover={shouldReduceMotion
        ? {
          background: 'rgba(255,255,255,0.08)',
          borderColor: 'rgba(255,255,255,0.24)',
        }
        : {
          background: 'rgba(255,255,255,0.08)',
          borderColor: 'rgba(255,255,255,0.24)',
          scale: 1.005,
          y: -1
        }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          border: `1px solid ${isActive ? 'rgba(255,255,255,0.18)' : 'transparent'}`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          opacity: isActive ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.16s ease, border-color 0.16s ease'
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          {note.pinned && <Pin size={12} color="#facc15" fill="#facc15" style={{ flexShrink: 0 }} />}
          <span style={{
            fontSize: '0.9rem', fontWeight: 700,
            color: isActive ? 'white' : 'rgba(255,255,255,0.85)',
            flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'var(--font-display)', letterSpacing: '-0.01em'
            , minHeight: `${titleMetrics?.height || NOTES_CARD_TITLE_LINE_HEIGHT}px`
          }}>
            {note.title || 'Untitled'}
          </span>
        </div>
        <div style={{
          fontSize: '0.75rem', color: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
          lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', textOverflow: 'ellipsis', minHeight: `${snippetMetrics?.height || (NOTES_CARD_SNIPPET_LINE_HEIGHT * 2)}px`
        }}>
          {snippet || 'Empty note'}
        </div>
        <div style={{ marginTop: '0.45rem' }}>
          <span style={{
            fontSize: '0.62rem', color: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.18)',
            padding: '0.15rem 0.45rem', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            {note.category || 'General'}
          </span>
        </div>
        <div style={{
          fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)',
          marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
        }}>
          {note.updatedAt ? formatTime(note.updatedAt) : ''}
        </div>
      </div>
    </motion.button>
  );
});

const FloatingCategorySelector = ({
  value,
  options,
  onChange,
  includeAll = false,
  allowCreate = false,
  minWidth = 190,
  fullWidth = false,
  maxWidth,
  compact = false
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isQueryFocused, setIsQueryFocused] = useState(false);
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const normalizedOptions = useMemo(() => {
    return Array.from(new Set(options
      .map(opt => String(opt || '').trim())
      .filter(Boolean)));
  }, [options]);

  const caseNormalizedOptions = useMemo(() => {
    return Array.from(new Set(options
      .map(opt => String(opt || '').trim().toLowerCase())
      .filter(Boolean)));
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(opt => opt.toLowerCase().includes(q));
  }, [normalizedOptions, query]);

  const trimmedQuery = query.trim();
  const canCreate = allowCreate
    && trimmedQuery.length > 1
    && !caseNormalizedOptions.some(opt => opt === trimmedQuery.toLowerCase());

  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const input = searchRef.current;
      if (input?.isConnected) input.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [open]);

  const shownLabel = includeAll && value === 'All' ? 'All categories' : value;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        minWidth: fullWidth ? 0 : minWidth,
        width: fullWidth ? '100%' : 'auto',
        maxWidth: maxWidth || 'none'
      }}
    >
      <motion.button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        whileHover={shouldReduceMotion ? undefined : { y: -1 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '0.3rem' : '0.45rem',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: compact ? '0.62rem' : '0.78rem',
          background: 'radial-gradient(circle at 15% 20%, #303030, #101010 40%, #000000)',
          color: 'rgba(255, 255, 255, 0.95)',
          padding: compact ? '0.36rem 0.48rem' : '0.5rem 0.65rem',
          cursor: 'pointer',
          fontSize: compact ? '0.72rem' : '0.78rem',
          fontWeight: 700,
          overflow: 'hidden'
        }}
      >
        <Sparkles size={compact ? 11 : 13} color="rgba(255, 255, 255, 0.8)" />
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {shownLabel || 'General'}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
          style={{ display: 'flex' }}
        >
          <ChevronDown size={compact ? 12 : 14} color="rgba(255, 255, 255, 0.6)" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-6px) scale(0.985)' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-6px) scale(0.985)' }}
            transition={{ duration: 0.18, ease: MOTION_EASE_OUT }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              left: 0,
              right: 0,
              zIndex: 80,
              borderRadius: compact ? '0.8rem' : '1rem',
              border: '1px solid #444',
              background: 'radial-gradient(circle at 15% 0%, #2a2a2a, #080808 42%, #000000)',
              boxShadow: '0 18px 42px rgba(0, 0, 0, 0.95)',
              backdropFilter: 'none',
              overflow: 'hidden',
              transformOrigin: 'top left'
            }}
          >
            <div style={{ padding: compact ? '0.5rem 0.5rem 0.4rem' : '0.65rem 0.65rem 0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: '0.65rem',
                border: `1px solid ${isQueryFocused ? 'rgba(167, 139, 250, 0.72)' : '#333'}`,
                background: '#141414',
                padding: compact ? '0.4rem 0.48rem' : '0.48rem 0.58rem',
                boxShadow: isQueryFocused ? FOCUS_RING : 'none',
                transition: 'border-color 0.16s ease, box-shadow 0.16s ease'
              }}>
                <Search size={12} color="rgba(255, 255, 255, 0.5)" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsQueryFocused(true)}
                  onBlur={() => setIsQueryFocused(false)}
                  placeholder="Search categories"
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'rgba(231, 246, 255, 0.96)',
                    fontSize: '0.76rem',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '0.5rem 0.55rem 0.6rem' }}>
              {filteredOptions.map((option, idx) => {
                const active = option === value;
                return (
                  <motion.button
                    key={option}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                      setQuery('');
                    }}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={{ delay: shouldReduceMotion ? 0 : Math.min(idx * 0.015, 0.14), duration: 0.16, ease: MOTION_EASE_OUT }}
                    whileHover={shouldReduceMotion ? { backgroundColor: '#1a1a1a' } : { x: 1 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: '0.7rem',
                      border: `1px solid ${active ? '#666' : '#2a2a2a'}`,
                      background: active
                        ? 'linear-gradient(130deg, #4d4d4d, #262626)'
                        : '#141414',
                      color: active ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.8)',
                      padding: compact ? '0.4rem 0.5rem' : '0.48rem 0.62rem',
                      fontSize: compact ? '0.71rem' : '0.75rem',
                      fontWeight: 700,
                      marginBottom: '0.34rem',
                      cursor: 'pointer'
                    }}
                  >
                    {includeAll && option === 'All' ? 'All categories' : option}
                  </motion.button>
                );
              })}

              {canCreate && (
                <motion.button
                  type="button"
                  onClick={() => {
                    onChange(trimmedQuery);
                    setOpen(false);
                    setQuery('');
                  }}
                  whileHover={shouldReduceMotion ? undefined : { x: 1 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
                  transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: '0.7rem',
                    border: '1px solid #555',
                    background: 'linear-gradient(130deg, #3d3d3d, #1f1f1f)',
                    color: 'rgba(255, 255, 255, 1)',
                    padding: compact ? '0.42rem 0.5rem' : '0.5rem 0.62rem',
                    fontSize: compact ? '0.71rem' : '0.75rem',
                    fontWeight: 800,
                    marginBottom: '0.2rem',
                    cursor: 'pointer'
                  }}
                >
                  Create "{trimmedQuery}"
                </motion.button>
              )}

              {filteredOptions.length === 0 && !canCreate && (
                <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.74rem', padding: '0.55rem 0.35rem' }}>
                  No category found.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function NotesPage() {
  const { token, logout } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const cachedSnapshot = useMemo(() => getNotesKeepAliveSnapshot(token), [token]);
  const hasWarmCache = Boolean(cachedSnapshot);
  const [notes, setNotes] = useState(() => cachedSnapshot?.notes || []);
  const [loading, setLoading] = useState(() => !hasWarmCache);
  const [activeNote, setActiveNote] = useState(() => cachedSnapshot?.activeNote || null);
  const [body, setBody] = useState(() => cachedSnapshot?.body || '');
  const [title, setTitle] = useState(() => cachedSnapshot?.title || '');
  const [category, setCategory] = useState(() => cachedSnapshot?.category || 'General');
  const [categoryFilter, setCategoryFilter] = useState(() => cachedSnapshot?.categoryFilter || 'All');
  const [view, setView] = useState(() => cachedSnapshot?.view || 'split'); // 'editor' | 'preview' | 'split'
  const [isEditing, setIsEditing] = useState(() => Boolean(cachedSnapshot?.isEditing));
  const [search, setSearch] = useState(() => cachedSnapshot?.search || '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(() => Boolean(cachedSnapshot?.dirty));
  const [notesLoadError, setNotesLoadError] = useState('');
  const [notesFetchStage, setNotesFetchStage] = useState(() => (!hasWarmCache ? 'loading' : 'idle'));
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [showSidebar, setShowSidebar] = useState(() => cachedSnapshot?.showSidebar ?? true);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  const [visibleNotesCount, setVisibleNotesCount] = useState(24);
  const [notesPendingSyncCount, setNotesPendingSyncCount] = useState(0);
  useEffect(() => {
    getOfflineSyncPendingCountByDedupePrefix('notes:').then(setNotesPendingSyncCount);
  }, []);
  const textareaRef = useRef(null);
  const saveTimerRef = useRef(null);
  const saveIndicatorTimerRef = useRef(null);
  const fetchIndicatorTimerRef = useRef(null);
  const fetchAbortRef = useRef(null);
  const fetchInFlightRef = useRef(false);
  const fetchRequestSeqRef = useRef(0);
  const fetchActiveRequestRef = useRef(0);
  const fetchLastRunRef = useRef(0);
  const draftByNoteIdRef = useRef(new Map());
  const notesRef = useRef(notes);
  const activeNoteRef = useRef(activeNote);
  const previousNotesPendingSyncCountRef = useRef(0);
  useEffect(() => {
    getOfflineSyncPendingCountByDedupePrefix('notes:').then(c => previousNotesPendingSyncCountRef.current = c);
  }, []);
  const notesListRef = useRef(null);
  const loadMoreRef = useRef(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const isCompact = viewportWidth < 980;
  const isPhone = viewportWidth < 760;
  const isTiny = viewportWidth < 430;
  const notesBatchSize = isPhone ? 10 : isCompact ? 14 : 20;
  const sidebarWidth = isCompact ? '100%' : 'min(450px, 42vw)';
  const iconButtonSize = isPhone ? 38 : 34;
  const showNotesProgressBar = notesFetchStage !== 'idle';

  const readNotesPendingSyncCount = useCallback(async () => await getOfflineSyncPendingCountByDedupePrefix('notes:'), []);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  const sortNotesForList = useCallback((inputNotes) => {
    return [...inputNotes].sort((a, b) => Number(Boolean(b?.pinned)) - Number(Boolean(a?.pinned)));
  }, []);

  const toNotePayload = useCallback((noteLike) => {
    return {
      title: String(noteLike?.title || 'Untitled Note'),
      body: String(noteLike?.body || ''),
      category: String(noteLike?.category || 'General'),
      pinned: Boolean(noteLike?.pinned),
      color: String(noteLike?.color || 'violet'),
    };
  }, []);

  const queueOfflineNoteCreate = useCallback((noteLike) => {
    if (!token) return;
    const noteId = String(noteLike?._id || createOfflineNoteId());
    const dedupeKey = getNoteCreateDedupeKey(noteId);

    enqueueOfflineSyncRequest({
      url: `${BASE}/notes`,
      method: 'POST',
      authMode: 'bearer',
      dedupeKey,
      headers: { 'Content-Type': 'application/json' },
      body: toNotePayload(noteLike),
    });
  }, [token, toNotePayload]);

  const queueOfflineNoteUpdate = useCallback((id, payload, baseUpdatedAt = null) => {
    if (!token) return;
    const noteId = String(id || '');
    if (!noteId) return;

    enqueueOfflineSyncRequest({
      url: `${BASE}/notes/${noteId}`,
      method: 'PATCH',
      authMode: 'bearer',
      dedupeKey: getNoteUpdateDedupeKey(noteId),
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      conflictGuard: baseUpdatedAt
        ? {
          strategy: 'skip-if-remote-newer',
          resourceUrl: `${BASE}/notes/${noteId}`,
          baseUpdatedAt,
        }
        : null,
    });
  }, [token]);

  const queueOfflineNoteDelete = useCallback((id, baseUpdatedAt = null) => {
    if (!token) return;
    const noteId = String(id || '');
    if (!noteId) return;

    removeOfflineSyncRequestByDedupeKey(getNoteUpdateDedupeKey(noteId));

    enqueueOfflineSyncRequest({
      url: `${BASE}/notes/${noteId}`,
      method: 'DELETE',
      authMode: 'bearer',
      dedupeKey: getNoteDeleteDedupeKey(noteId),
      headers: { 'Content-Type': 'application/json' },
      body: null,
      conflictGuard: baseUpdatedAt
        ? {
          strategy: 'skip-if-remote-newer',
          resourceUrl: `${BASE}/notes/${noteId}`,
          baseUpdatedAt,
        }
        : null,
    });
  }, [token]);

  const fetchNotes = useCallback(async ({ background = false, minIntervalMs = 0, force = false } = {}) => {
    if (!token) return;

    const requestId = ++fetchRequestSeqRef.current;

    const now = Date.now();
    if (!force && minIntervalMs > 0 && now - fetchLastRunRef.current < minIntervalMs) {
      return;
    }

    if (fetchInFlightRef.current) {
      if (fetchAbortRef.current) {
        try {
          fetchAbortRef.current.abort();
        } catch {
          // Ignore abort failure and continue with a fresh request.
        }
      }
    }

    fetchActiveRequestRef.current = requestId;
    fetchInFlightRef.current = true;
    fetchLastRunRef.current = now;

    if (typeof fetchIndicatorTimerRef.current === 'number') {
      window.clearTimeout(fetchIndicatorTimerRef.current);
      fetchIndicatorTimerRef.current = null;
    }

    if (!background) {
      setNotesFetchStage('loading');
    } else {
      setNotesFetchStage((current) => (current === 'loading' ? current : 'refreshing'));
    }

    if (!background) {
      setLoading(true);
      setNotesLoadError('');
    } else if (notesRef.current.length === 0) {
      setNotesLoadError('');
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      const res = await fetch(`${BASE}/notes`, { headers, signal: controller.signal });
      if (!res.ok) {
        let apiMessage = '';
        try {
          const payload = await res.json();
          apiMessage = String(payload?.msg || '').trim();
        } catch {
          apiMessage = '';
        }

        const error = new Error(apiMessage || `Notes fetch failed with status ${res.status}`);
        error.status = res.status;
        throw error;
      }

      const data = await res.json();
      if (fetchActiveRequestRef.current !== requestId) return;
      const remoteNotes = Array.isArray(data) ? data : [];
      setNotesLoadError('');

      setNotes((currentNotes) => {
        const pendingLocalNotes = currentNotes.filter((note) => {
          if (!isOfflineNoteId(note?._id)) return false;
          return hasOfflineSyncRequestWithDedupeKey(getNoteCreateDedupeKey(note._id));
        });

        return sortNotesForList([...pendingLocalNotes, ...remoteNotes]);
      });

      setActiveNote((current) => {
        if (current?._id && isOfflineNoteId(current._id)) {
          if (hasOfflineSyncRequestWithDedupeKey(getNoteCreateDedupeKey(current._id))) {
            return current;
          }
        }

        if (current?._id) {
          const refreshedCurrent = remoteNotes.find((note) => note._id === current._id);
          if (refreshedCurrent) return refreshedCurrent;
        }

        if (remoteNotes.length === 0) {
          setTitle('');
          setBody('');
          setCategory('General');
          return null;
        }

        const first = sortNotesForList(remoteNotes)[0];
        setTitle(first.title);
        setBody(first.body || '');
        setCategory(first.category || 'General');
        setDirty(false);
        setIsEditing(false);
        return first;
      });
    } catch (error) {
      if (fetchActiveRequestRef.current !== requestId) return;
      if (error?.name !== 'AbortError') {
        const status = Number(error?.status || 0);

        if (status === 401 || status === 400) {
          setNotesLoadError('Session expired. Please sign in again.');
          logout();
        } else {
          const fallbackMessage = isClientOffline()
            ? 'You are offline. Showing local notes only.'
            : 'Unable to load notes right now. Please retry.';
          const nextMessage = String(error?.message || '').trim() || fallbackMessage;

          if (!background || notesRef.current.length === 0) {
            setNotesLoadError(nextMessage);
          }
        }
      }
    } finally {
      const isLatestRequest = fetchActiveRequestRef.current === requestId;
      if (isLatestRequest) {
        if (fetchAbortRef.current === controller) {
          fetchAbortRef.current = null;
        }

        fetchInFlightRef.current = false;
        fetchActiveRequestRef.current = 0;

        if (!background) {
          setLoading(false);
        }

        if (typeof window !== 'undefined') {
          fetchIndicatorTimerRef.current = window.setTimeout(() => {
            setNotesFetchStage('idle');
            fetchIndicatorTimerRef.current = null;
          }, 160);
        } else {
          setNotesFetchStage('idle');
        }
      }
    }
  }, [token, headers, sortNotesForList, logout]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setNotesFetchStage('idle');
      setNotesLoadError('Please sign in to load your notes.');
      return;
    }

    if (hasWarmCache) {
      setLoading(false);
      const refreshTimer = window.setTimeout(() => {
        fetchNotes({ background: true, minIntervalMs: 700 }).catch(() => undefined);
      }, 900);
      return () => window.clearTimeout(refreshTimer);
    }

    fetchNotes({ background: false }).catch(() => undefined);
  }, [fetchNotes, hasWarmCache, token]);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return undefined;

    const handleOnline = () => {
      window.setTimeout(() => {
        fetchNotes({ background: true, minIntervalMs: 1200 }).catch(() => undefined);
      }, 2200);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchNotes, token]);

  useEffect(() => {
    if (!token) {
      setNotesPendingSyncCount(0);
      previousNotesPendingSyncCountRef.current = 0;
      return undefined;
    }

    const initialPendingCount = readNotesPendingSyncCount();
    setNotesPendingSyncCount(initialPendingCount);
    previousNotesPendingSyncCountRef.current = initialPendingCount;

    return subscribeToOfflineSyncQueue(() => {
      const nextPendingCount = readNotesPendingSyncCount();
      const previousPendingCount = previousNotesPendingSyncCountRef.current;

      previousNotesPendingSyncCountRef.current = nextPendingCount;
      setNotesPendingSyncCount(nextPendingCount);

      if (previousPendingCount > 0 && nextPendingCount === 0 && !isClientOffline()) {
        fetchNotes({ background: true, minIntervalMs: 900 }).catch(() => undefined);
      }
    });
  }, [token, fetchNotes, readNotesPendingSyncCount]);

  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);

      if (typeof saveIndicatorTimerRef.current === 'number') {
        window.clearTimeout(saveIndicatorTimerRef.current);
        saveIndicatorTimerRef.current = null;
      }

      if (typeof fetchIndicatorTimerRef.current === 'number') {
        window.clearTimeout(fetchIndicatorTimerRef.current);
        fetchIndicatorTimerRef.current = null;
      }

      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
        fetchAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    notesKeepAliveSnapshot = {
      token,
      savedAt: Date.now(),
      state: {
        notes,
        activeNote,
        body,
        title,
        category,
        categoryFilter,
        view,
        isEditing,
        search,
        dirty,
        showSidebar,
      },
    };
  }, [token, notes, activeNote, body, title, category, categoryFilter, view, isEditing, search, dirty, showSidebar]);

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
    if (isCompact) {
      setShowSidebar(false);
    }
  }, [isCompact]);

  useEffect(() => {
    if (isPhone && view === 'split') {
      setView('editor');
    }
  }, [isPhone, view]);

  useEffect(() => {
    const activeNoteId = activeNote?._id;
    if (!activeNoteId) return;

    if (dirty) {
      draftByNoteIdRef.current.set(String(activeNoteId), {
        title,
        body,
        category,
        isEditing,
      });
      return;
    }

    draftByNoteIdRef.current.delete(String(activeNoteId));
  }, [activeNote?._id, title, body, category, isEditing, dirty]);

  const openNote = useCallback((note) => {
    const nextNoteId = String(note?._id || '');
    if (!nextNoteId) return;

    const currentActiveNoteId = String(activeNoteRef.current?._id || '');
    if (dirty && currentActiveNoteId && currentActiveNoteId !== nextNoteId) {
      draftByNoteIdRef.current.set(currentActiveNoteId, {
        title,
        body,
        category,
        isEditing,
      });
    }

    const draft = draftByNoteIdRef.current.get(nextNoteId);

    setActiveNote(note);
    setTitle(draft?.title ?? note.title ?? '');
    setBody(draft?.body ?? note.body ?? '');
    setCategory(draft?.category ?? note.category ?? 'General');
    setDirty(Boolean(draft));
    setIsEditing(Boolean(draft?.isEditing));
    if (isCompact) setShowSidebar(false);
  }, [isCompact, title, body, category, isEditing, dirty]);

  const applyLocalNoteUpdate = useCallback((nextNote) => {
    setNotes((previousNotes) => {
      const existingIndex = previousNotes.findIndex((item) => item._id === nextNote._id);
      const merged = existingIndex >= 0
        ? previousNotes.map((item) => (item._id === nextNote._id ? nextNote : item))
        : [nextNote, ...previousNotes];

      return sortNotesForList(merged);
    });
    setActiveNote((current) => (current?._id === nextNote._id ? nextNote : current));
  }, [sortNotesForList]);

  const saveNote = useCallback(async (showIndicator = true) => {
    if (!activeNote?._id) return;
    if (showIndicator) setSaving(true);

    const noteId = String(activeNote._id);
    const baseUpdatedAt = activeNote?.updatedAt || null;
    const payload = { title, body, category };
    const optimisticNote = {
      ...activeNote,
      ...payload,
      updatedAt: new Date().toISOString(),
      __pendingSync: true,
    };

    try {
      if (isOfflineNoteId(noteId)) {
        applyLocalNoteUpdate(optimisticNote);
        queueOfflineNoteCreate(optimisticNote);
      } else if (isClientOffline()) {
        applyLocalNoteUpdate(optimisticNote);
        queueOfflineNoteUpdate(noteId, payload, baseUpdatedAt);
      } else {
        const response = await fetch(`${BASE}/notes/${noteId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Note save failed with status ${response.status}`);
        }

        const updatedNote = await response.json();
        applyLocalNoteUpdate({ ...updatedNote, __pendingSync: false });
        removeOfflineSyncRequestByDedupeKey(getNoteUpdateDedupeKey(noteId));
      }

      draftByNoteIdRef.current.delete(noteId);
      setDirty(false);
    } catch {
      applyLocalNoteUpdate(optimisticNote);
      if (isOfflineNoteId(noteId)) {
        queueOfflineNoteCreate(optimisticNote);
      } else {
        queueOfflineNoteUpdate(noteId, payload, baseUpdatedAt);
      }
      draftByNoteIdRef.current.delete(noteId);
      setDirty(false);
    } finally {
      if (showIndicator) {
        if (typeof saveIndicatorTimerRef.current === 'number') {
          window.clearTimeout(saveIndicatorTimerRef.current);
        }
        saveIndicatorTimerRef.current = window.setTimeout(() => {
          setSaving(false);
          saveIndicatorTimerRef.current = null;
        }, 800);
      }
    }
  }, [activeNote, headers, title, body, category, applyLocalNoteUpdate, queueOfflineNoteCreate, queueOfflineNoteUpdate]);

  /* Auto-save debounce */
  useEffect(() => {
    if (!dirty || !activeNote?._id) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNote(false), 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [dirty, activeNote?._id, body, title, category, saveNote]);

  const createNote = async () => {
    const nextCategory = categoryFilter !== 'All' ? String(categoryFilter || 'General') : 'General';

    if (search.trim().length > 0) {
      setSearch('');
    }

    const payload = {
      title: 'Untitled Note',
      body: '',
      category: nextCategory,
      pinned: false,
      color: 'violet',
    };

    const fallbackToOfflineCreate = () => {
      const timestamp = new Date().toISOString();
      const offlineNote = {
        _id: createOfflineNoteId(),
        ...payload,
        createdAt: timestamp,
        updatedAt: timestamp,
        __pendingSync: true,
      };

      applyLocalNoteUpdate(offlineNote);
      queueOfflineNoteCreate(offlineNote);
      openNote(offlineNote);
      setDirty(false);
      setIsEditing(true);
    };

    if (isClientOffline()) {
      fallbackToOfflineCreate();
      return;
    }

    try {
      const response = await fetch(`${BASE}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Note create failed with status ${response.status}`);
      }

      const createdNote = await response.json();
      applyLocalNoteUpdate({ ...createdNote, __pendingSync: false });
      openNote(createdNote);
      setDirty(false);
      setIsEditing(true);
    } catch {
      fallbackToOfflineCreate();
    }
  };

  const deleteNote = async (id) => {
    const noteId = String(id || '');
    const targetNote = notesRef.current.find((note) => note._id === noteId);
    const baseUpdatedAt = targetNote?.updatedAt || null;

    const removeFromLocalState = () => {
      const remaining = notesRef.current.filter((note) => note._id !== noteId);
      setNotes(remaining);

      draftByNoteIdRef.current.delete(noteId);

      if (activeNoteRef.current?._id === noteId) {
        if (remaining.length > 0) {
          const nextActiveNote = remaining[0];
          const nextDraft = draftByNoteIdRef.current.get(String(nextActiveNote._id));

          setActiveNote(nextActiveNote);
          setTitle(nextDraft?.title ?? nextActiveNote.title ?? '');
          setBody(nextDraft?.body ?? nextActiveNote.body ?? '');
          setCategory(nextDraft?.category ?? nextActiveNote.category ?? 'General');
          setDirty(Boolean(nextDraft));
          setIsEditing(Boolean(nextDraft?.isEditing));
          if (isCompact) setShowSidebar(false);
        } else {
          setActiveNote(null);
          setTitle('');
          setBody('');
          setCategory('General');
          setDirty(false);
          setIsEditing(false);
        }
      }
    };

    removeOfflineSyncRequestByDedupeKey(getNoteUpdateDedupeKey(noteId));

    if (isOfflineNoteId(noteId)) {
      removeOfflineSyncRequestByDedupeKey(getNoteCreateDedupeKey(noteId));
      removeOfflineSyncRequestByDedupeKey(getNoteDeleteDedupeKey(noteId));
      removeFromLocalState();
      return;
    }

    if (isClientOffline()) {
      queueOfflineNoteDelete(noteId, baseUpdatedAt);
      removeFromLocalState();
      return;
    }

    try {
      const response = await fetch(`${BASE}/notes/${noteId}`, { method: 'DELETE', headers });
      if (!response.ok) {
        throw new Error(`Note delete failed with status ${response.status}`);
      }
      removeOfflineSyncRequestByDedupeKey(getNoteDeleteDedupeKey(noteId));
    } catch {
      queueOfflineNoteDelete(noteId, baseUpdatedAt);
    }

    removeFromLocalState();
  };

  const togglePin = async (note) => {
    const noteId = String(note?._id || '');
    if (!noteId) return;

    const nextPinned = !note.pinned;
    const optimisticNote = {
      ...note,
      pinned: nextPinned,
      updatedAt: new Date().toISOString(),
      __pendingSync: true,
    };

    if (isOfflineNoteId(noteId)) {
      applyLocalNoteUpdate(optimisticNote);
      queueOfflineNoteCreate(optimisticNote);
      return;
    }

    if (isClientOffline()) {
      applyLocalNoteUpdate(optimisticNote);
      queueOfflineNoteUpdate(noteId, { pinned: nextPinned }, note?.updatedAt || null);
      return;
    }

    try {
      const response = await fetch(`${BASE}/notes/${noteId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ pinned: nextPinned }),
      });

      if (!response.ok) {
        throw new Error(`Pin toggle failed with status ${response.status}`);
      }

      const updatedNote = await response.json();
      applyLocalNoteUpdate({ ...updatedNote, __pendingSync: false });
      removeOfflineSyncRequestByDedupeKey(getNoteUpdateDedupeKey(noteId));
    } catch {
      applyLocalNoteUpdate(optimisticNote);
      queueOfflineNoteUpdate(noteId, { pinned: nextPinned }, note?.updatedAt || null);
    }
  };

  const filteredNotes = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter(n => {
      const textMatch = n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q);
      const activeCategory = String(n.category || 'General');
      const categoryMatch = categoryFilter === 'All' || activeCategory === categoryFilter;
      return textMatch && categoryMatch;
    }
    );
  }, [notes, search, categoryFilter]);

  const visibleNotes = useMemo(() => {
    return filteredNotes.slice(0, visibleNotesCount);
  }, [filteredNotes, visibleNotesCount]);

  const visibleNoteCards = useMemo(() => {
    const noteCards = [];

    const sidebarContainerWidth = isCompact
      ? Math.max(280, viewportWidth - 20)
      : Math.min(450, Math.max(320, viewportWidth * 0.42));

    const gridColumns = isCompact ? 1 : 2;
    const approximateCardWidth = (sidebarContainerWidth / gridColumns) - 28;
    const textWidth = Math.max(132, approximateCardWidth - 36);

    for (const note of visibleNotes) {
      const normalizedTitle = String(note.title || 'Untitled').trim() || 'Untitled';
      const rawBody = String(note.body || '');
      const cleanedSnippet = rawBody
        .slice(0, 320)
        .replace(/[-#*_`>!()]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const previewSnippet = cleanedSnippet
        ? `${cleanedSnippet}${rawBody.length > 320 ? '...' : ''}`
        : 'Empty note';

      const titleMetrics = measureTextBlock(normalizedTitle, {
        font: NOTES_CARD_TITLE_FONT,
        maxWidth: textWidth,
        lineHeight: NOTES_CARD_TITLE_LINE_HEIGHT,
        maxLines: 1,
      });

      const snippetMetrics = measureTextBlock(previewSnippet, {
        font: NOTES_CARD_SNIPPET_FONT,
        maxWidth: textWidth,
        lineHeight: NOTES_CARD_SNIPPET_LINE_HEIGHT,
        maxLines: 2,
      });

      noteCards.push({
        note,
        snippet: previewSnippet,
        titleMetrics,
        snippetMetrics,
      });
    }

    return noteCards;
  }, [visibleNotes, isCompact, viewportWidth]);

  const hasMoreNotes = visibleNotesCount < filteredNotes.length;

  const noteCategories = useMemo(() => {
    const set = new Set(['General']);
    notes.forEach(n => set.add(String(n.category || 'General')));
    return ['All', ...Array.from(set).filter(c => c !== 'All')];
  }, [notes]);

  useEffect(() => {
    if (loading) return;
    if (categoryFilter === 'All') return;
    if (notes.length === 0) return;

    const filterStillExists = notes.some((note) => String(note.category || 'General') === categoryFilter);
    if (!filterStillExists) {
      setCategoryFilter('All');
    }
  }, [loading, notes, notes.length, categoryFilter]);

  useEffect(() => {
    setVisibleNotesCount(notesBatchSize);
  }, [search, categoryFilter, notesBatchSize, filteredNotes.length]);

  useEffect(() => {
    if (!showSidebar || !hasMoreNotes) return;
    const root = notesListRef.current;
    const sentinel = loadMoreRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleNotesCount((count) => Math.min(count + notesBatchSize, filteredNotes.length));
      },
      { root, rootMargin: '220px 0px', threshold: 0.01 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [showSidebar, hasMoreNotes, notesBatchSize, filteredNotes.length]);

  const editorViewModes = isPhone
    ? [
      { id: 'editor', icon: Edit3, label: 'Editor' },
      { id: 'preview', icon: Eye, label: 'Preview' },
    ]
    : [
      { id: 'editor', icon: Edit3, label: 'Editor' },
      { id: 'split', icon: AlignLeft, label: 'Split' },
      { id: 'preview', icon: Eye, label: 'Preview' },
    ];

  const viewportOffset = isPhone ? '0.45rem' : '0.9rem';

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  const handleTitleChange = useCallback((e) => {
    setTitle(e.target.value);
    setDirty(true);
  }, []);

  const handleBodyChange = useCallback((e) => {
    setBody(e.target.value);
    setDirty(true);
  }, []);

  const handleCategoryChange = useCallback((next) => {
    setCategory(next);
    setDirty(true);
  }, []);

  const ins = useCallback((before, after) => {
    insertMarkdown(textareaRef, (v) => {
      setBody(v);
      setDirty(true);
    }, before, after);
  }, []);

  const hasActiveFilters = categoryFilter !== 'All' || search.trim().length > 0;

  useEffect(() => {
    if (!isEditing || !activeNote?._id) return undefined;

    const onKeyDown = (event) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (!isModifierPressed || event.altKey) return;
      if (event.target !== textareaRef.current) return;

      const key = event.key.toLowerCase();

      if (key === 'b') {
        event.preventDefault();
        ins('**', '**');
        return;
      }

      if (key === 'i') {
        event.preventDefault();
        ins('*', '*');
        return;
      }

      if (key === 'k') {
        event.preventDefault();
        ins('[', '](https://example.com)');
        return;
      }

      if (key === '`') {
        event.preventDefault();
        ins('`', '`');
        return;
      }

      if (event.shiftKey && key === '7') {
        event.preventDefault();
        ins('- ', '');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditing, activeNote?._id, ins]);

  return (
    <div style={{ display: 'flex', marginTop: viewportOffset, minHeight: `calc(100svh - 64px - ${viewportOffset})`, height: `calc(100dvh - 64px - ${viewportOffset})`, overflow: 'hidden', color: 'white', position: 'relative', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <AnimatePresence initial={false}>
        {showNotesProgressBar && (
          <motion.div
            key="notes-top-progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: MOTION_EASE_OUT }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
              zIndex: 60,
              pointerEvents: 'none'
            }}
            aria-hidden
          >
            <motion.div
              animate={shouldReduceMotion
                ? { opacity: [0.42, 0.95, 0.42] }
                : { transform: ['translateX(-42%)', 'translateX(120%)'] }}
              transition={shouldReduceMotion
                ? { duration: 1.25, repeat: Infinity, ease: 'linear' }
                : { duration: 0.95, repeat: Infinity, ease: 'linear' }}
              style={{
                width: shouldReduceMotion ? '100%' : '42%',
                height: '100%',
                background: 'linear-gradient(90deg, rgba(99,179,237,0), rgba(167,139,250,0.9), rgba(99,179,237,0))',
                willChange: 'transform, opacity'
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateX(-18px)' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, transform: 'translateX(0px)' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateX(-18px)' }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: MOTION_EASE_OUT }}
            style={{
              width: sidebarWidth,
              flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', flexDirection: 'column',
              background: 'radial-gradient(at 0% 0%, rgba(160, 160, 160, 0.12) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(130, 130, 130, 0.08) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(200, 200, 200, 0.05) 0px, transparent 50%), rgba(5, 5, 7, 0.65)',
              backdropFilter: 'blur(16px)', overflow: 'hidden',
              position: isCompact ? 'absolute' : 'relative',
              inset: isCompact ? 0 : 'auto',
              zIndex: isCompact ? 35 : 'auto'
            }}
          >
            <div style={{ width: sidebarWidth, height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Sidebar Header */}
              <div style={{ height: isPhone ? '64px' : '72px', padding: isPhone ? '0 0.9rem' : '0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
                      <h2 className="title-sparkle-effect" style={{ margin: 0, fontSize: isPhone ? '1.3rem' : 'clamp(1.35rem, 2.8vw, 1.7rem)', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.55rem', background: 'linear-gradient(180deg, #fff 0%, #9ca3af 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        <FileText size={20} color="rgba(147,197,253,0.95)" style={{ filter: 'drop-shadow(0 0 10px rgba(147,197,253,0.5))' }} />
                        Notes
                      </h2>
                      {notesPendingSyncCount > 0 && (
                        <span style={{
                          alignSelf: 'flex-start',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.9)',
                          border: '1px solid rgba(255,255,255,0.22)',
                          borderRadius: '999px',
                          padding: '0.14rem 0.44rem',
                          background: 'rgba(255,255,255,0.08)'
                        }}>
                          {notesPendingSyncCount} pending sync
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <IconActionButton
                      icon={Plus}
                      label="Create note"
                      title="Create note"
                      onClick={createNote}
                      tone="accent"
                      size={isPhone ? 34 : 32}
                    />
                    <IconActionButton
                      icon={PanelLeftClose}
                      label="Hide sidebar"
                      title="Hide sidebar"
                      onClick={() => setShowSidebar(false)}
                      size={isPhone ? 34 : 32}
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar Search Area */}
              <div style={{ padding: isPhone ? '0.75rem 0.9rem' : '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  background: 'rgba(255,255,255,0.06)', borderRadius: '0.8rem',
                  padding: isPhone ? '0.55rem 0.75rem' : '0.6rem 0.9rem',
                  border: `1px solid ${isSearchFocused ? 'rgba(167, 139, 250, 0.7)' : 'rgba(255,255,255,0.15)'}`,
                  boxShadow: isSearchFocused ? FOCUS_RING : 'none',
                  transition: 'border-color 0.16s ease, box-shadow 0.16s ease'
                }}>
                  <Search size={14} color="rgba(255,255,255,0.3)" />
                  <input
                    value={search} onChange={handleSearchChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Search notes..."
                    style={{ background: 'none', border: 'none', outline: 'none', color: 'white', fontSize: '0.85rem', flex: 1 }}
                  />
                </div>
                <div style={{ marginTop: '0.65rem' }}>
                  <FloatingCategorySelector
                    value={categoryFilter}
                    options={noteCategories}
                    onChange={setCategoryFilter}
                    includeAll
                    minWidth={isPhone ? 0 : 220}
                    fullWidth
                  />
                </div>
              </div>

              {/* Notes List */}
              <div
                className="app-content-visibility-list"
                ref={notesListRef}
                style={{
                  flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: isPhone ? '0.72rem' : '1rem',
                  display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, 1fr)', gap: '0.8rem',
                  alignContent: 'start'
                }}
              >
                {loading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>Loading...</div>
                ) : notesLoadError ? (
                  <div style={{ padding: '1.15rem', textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
                    <div style={{ marginBottom: '0.72rem', color: 'rgba(248,113,113,0.94)', fontWeight: 700 }}>
                      {notesLoadError}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        fetchNotes({ background: false, force: true }).catch(() => undefined);
                      }}
                      style={{
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.95)',
                        borderRadius: '0.56rem',
                        padding: '0.4rem 0.72rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.85rem' }}>
                    <div style={{ marginBottom: hasActiveFilters ? '0.75rem' : 0 }}>
                      {hasActiveFilters ? 'No notes match your current filters.' : 'No notes yet. Create one!'}
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setCategoryFilter('All');
                        }}
                        style={{
                          border: '1px solid rgba(255,255,255,0.18)',
                          background: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.92)',
                          borderRadius: '0.55rem',
                          padding: '0.36rem 0.62rem',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {visibleNoteCards.map(({ note, snippet, titleMetrics, snippetMetrics }) => (
                      <NoteListCard
                        key={note._id}
                        note={note}
                        isActive={activeNote?._id === note._id}
                        onOpen={openNote}
                        snippet={snippet}
                        titleMetrics={titleMetrics}
                        snippetMetrics={snippetMetrics}
                      />
                    ))}
                    {hasMoreNotes && <div ref={loadMoreRef} style={{ gridColumn: '1 / -1', height: 1 }} />}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Editor Area ───────────────────────────────────────────────── */}
      {activeNote ? (
        <div style={{ flexGrow: 4, flexShrink: 1, flexBasis: '0px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Editor Topbar */}
          <div style={{
            minHeight: isPhone ? 'auto' : '72px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: isPhone ? '0.5rem' : '0.65rem',
            padding: isPhone ? '0.68rem 0.85rem' : '0.65rem 1.55rem',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(10,10,20,0.3)', backdropFilter: 'blur(8px)', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', minWidth: 0 }}>
              {!showSidebar && (
                <IconActionButton
                  icon={PanelLeftOpen}
                  label="Show sidebar"
                  title="Show sidebar"
                  onClick={() => setShowSidebar(true)}
                  size={isPhone ? 34 : 32}
                />
              )}
              <input
                value={title}
                onChange={handleTitleChange}
                onFocus={() => setIsTitleFocused(true)}
                onBlur={() => setIsTitleFocused(false)}
                style={{
                  flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
                  color: 'white', fontWeight: 800, fontSize: isPhone ? '1rem' : '1.2rem',
                  fontFamily: 'var(--font-sidebar)',
                  borderRadius: '0.5rem',
                  padding: '0.28rem 0.48rem',
                  boxShadow: isTitleFocused ? FOCUS_RING : 'none',
                  transition: 'box-shadow 0.16s ease'
                }}
                placeholder="Note title..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: isPhone ? '0.45rem' : '0.6rem', flexWrap: 'wrap', width: '100%' }}>
              <div style={{
                flex: 1,
                minWidth: 60,
                maxWidth: isCompact ? 210 : 185,
                display: 'flex',
                alignItems: 'center'
              }}>
                {isEditing ? (
                  <FloatingCategorySelector
                    value={category}
                    options={noteCategories.filter(c => c !== 'All')}
                    onChange={handleCategoryChange}
                    allowCreate
                    minWidth={isPhone ? 0 : (isCompact ? 148 : 150)}
                    fullWidth={isPhone}
                    maxWidth={isPhone ? '100%' : (isCompact ? 210 : 185)}
                    compact={isCompact}
                  />
                ) : (
                  <span style={{
                    color: 'rgba(255, 255, 255, 0.65)',
                    fontSize: isPhone ? '0.85rem' : '0.9rem',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    padding: '0.3rem 0',
                    fontFamily: 'var(--font-sidebar)'
                  }}>
                    #{category}
                  </span>
                )}
              </div>

              {/* View Toggle (Only in Edit Mode) */}
              {isEditing && (
                <div style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '0.6rem',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '0.2rem',
                  flexShrink: 0,
                  position: 'relative'
                }}>
                  {editorViewModes.map(({ id, icon, label }) => {
                    const isActive = view === id;
                    return (
                      <motion.button
                        type="button"
                        key={id}
                        aria-label={label}
                        title={label}
                        onClick={() => setView(id)}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isActive ? 'white' : 'rgba(255,255,255,0.35)',
                          cursor: 'pointer',
                          padding: isPhone ? '0.34rem 0.58rem' : '0.3rem 0.6rem',
                          borderRadius: '0.4rem',
                          transition: 'color 0.16s ease',
                          display: 'flex',
                          alignItems: 'center',
                          position: 'relative',
                          zIndex: 1
                        }}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="notes-view-active-pill"
                            transition={{ duration: shouldReduceMotion ? 0.1 : 0.2, ease: MOTION_EASE_OUT }}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: '0.4rem',
                              background: 'rgba(255,255,255,0.12)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              zIndex: -1
                            }}
                          />
                        )}
                        {React.createElement(icon, { size: 15 })}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: '0.4rem',
                alignItems: 'center',
                flexWrap: 'nowrap'
              }}>
                {isEditing ? (
                  <IconActionButton
                    icon={Check}
                    label="Done editing"
                    title="Done editing"
                    onClick={() => setIsEditing(false)}
                    tone="success"
                    size={iconButtonSize}
                  />
                ) : (
                  <IconActionButton
                    icon={Edit3}
                    label="Edit note"
                    title="Edit note"
                    onClick={() => setIsEditing(true)}
                    tone="accent"
                    size={iconButtonSize}
                  />
                )}

                <IconActionButton
                  icon={Pin}
                  label={activeNote.pinned ? 'Unpin note' : 'Pin note'}
                  title={activeNote.pinned ? 'Unpin note' : 'Pin note'}
                  onClick={() => togglePin(activeNote)}
                  tone={activeNote.pinned ? 'warning' : 'neutral'}
                  isActive={activeNote.pinned}
                  size={iconButtonSize}
                />

                {isEditing && (
                  <IconActionButton
                    icon={Save}
                    label={saving ? 'Saved' : 'Save note'}
                    title={saving ? 'Saved' : 'Save note'}
                    onClick={() => saveNote(true)}
                    tone={saving ? 'success' : 'neutral'}
                    size={iconButtonSize}
                  />
                )}

                <IconActionButton
                  icon={Trash2}
                  label="Delete note"
                  title="Delete note"
                  onClick={() => deleteNote(activeNote._id)}
                  tone="danger"
                  size={iconButtonSize}
                />
              </div>
            </div>
          </div>

          {/* Markdown Toolbar (Only in Edit Mode) */}
          {isEditing && view !== 'preview' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.15rem', padding: isPhone ? '0.35rem 0.72rem' : '0.4rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(5,5,15,0.3)', flexShrink: 0, flexWrap: 'wrap'
            }}>
              <ToolbarBtn icon={Heading1} label="Heading 1" shortcut="Ctrl+Alt+1" onClick={() => ins('# ', '')} />
              <ToolbarBtn icon={Heading2} label="Heading 2" shortcut="Ctrl+Alt+2" onClick={() => ins('## ', '')} />
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 0.25rem' }} />
              <ToolbarBtn icon={Bold} label="Bold" shortcut="Ctrl+B" onClick={() => ins('**', '**')} />
              <ToolbarBtn icon={Italic} label="Italic" shortcut="Ctrl+I" onClick={() => ins('*', '*')} />
              <ToolbarBtn icon={Code} label="Code" shortcut="Ctrl+`" onClick={() => ins('`', '`')} />
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 0.25rem' }} />
              <ToolbarBtn icon={List} label="Bullet List" shortcut="Ctrl+Shift+7" onClick={() => ins('- ', '')} />
              <ToolbarBtn icon={Quote} label="Blockquote" onClick={() => ins('> ', '')} />
              <ToolbarBtn icon={Link} label="Link" shortcut="Ctrl+K" onClick={() => ins('[', '](https://example.com)')} />
              <ToolbarBtn icon={Image} label="Image" onClick={() => ins('![Image description](', 'https://example.com/image.jpg)')} />
              <ToolbarBtn icon={Hash} label="Checkbox" onClick={() => ins('- [ ] ', '')} />
              <div style={{ marginLeft: isPhone ? 0 : 'auto', width: isPhone ? '100%' : 'auto', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>
                {wordCount(body)} words · {body.length} chars
              </div>
            </div>
          )}

          {/* Editor + Preview Panes */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Editor Pane (Only in Edit Mode) */}
            {isEditing && (view === 'editor' || (!isPhone && view === 'split')) && (
              <textarea
                ref={textareaRef}
                value={body}
                onChange={handleBodyChange}
                onFocus={() => setIsEditorFocused(true)}
                onBlur={() => setIsEditorFocused(false)}
                placeholder={`# Start writing\n\nSupports **Markdown**, _italics_, [links](https://example.com), ![images](https://example.com/image.jpg), \`code\`, lists, tables, and more...`}
                style={{
                  flex: 1, padding: isCompact ? '0.9rem 0.95rem' : (showSidebar ? '1rem 2rem' : '2rem 10%'), resize: 'none', outline: 'none',
                  background: 'transparent', border: 'none', borderRight: (isEditing && !isPhone && view === 'split') ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  color: 'rgba(255,255,255,0.85)', fontSize: '1rem', lineHeight: 1.8,
                  fontFamily: 'var(--font-notes)',
                  scrollbarWidth: 'thin', scrollbarColor: 'rgba(120,120,120,0.62) rgba(10,10,10,0.92)',
                  boxShadow: isEditorFocused ? `inset ${FOCUS_RING}` : 'none',
                  transition: 'box-shadow 0.16s ease'
                }}
              />
            )}

            {/* Preview Pane (Always visible unless in Editor-only Edit mode) */}
            {(!isEditing || view === 'preview' || (!isPhone && view === 'split')) && (
              <div style={{
                flex: 1, overflowY: 'auto', padding: isCompact ? '0.9rem 0.95rem' : (showSidebar ? '1rem 2rem' : '2rem 10%'),
                scrollbarWidth: 'thin', scrollbarColor: 'rgba(120,120,120,0.62) rgba(10,10,10,0.92)'
              }}>
                <div className="markdown-preview" style={{
                  color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, fontSize: '1.1rem',
                  fontFamily: 'var(--font-notes)',
                  maxWidth: '960px', margin: '0'
                }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ ...props }) => (
                        <a
                          {...props}
                          className="note-markdown-link"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open link in a new tab"
                        />
                      ),
                    }}
                  >
                    {body || (isEditing ? '*Start writing to see a preview...*' : '_No content_')}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: isPhone ? 'wrap' : 'nowrap',
            gap: isPhone ? '0.25rem 0.6rem' : 0, padding: isPhone ? '0.35rem 0.75rem' : '0.35rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(5,5,15,0.5)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', flexShrink: 0
          }}>
            {!isTiny && <span>Markdown · GFM · Auto-save enabled</span>}
            <span>{activeNote.updatedAt ? `Last saved ${formatTime(activeNote.updatedAt)}` : 'Not saved'}</span>
          </div>
        </div>
      ) : (
        <div style={{ flexGrow: 4, flexShrink: 1, flexBasis: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'rgba(255,255,255,0.15)' }}>
          <FileText size={52} strokeWidth={1} />
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>Select a note or create a new one</p>
          <motion.button
            whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
            onClick={createNote}
            style={{
              marginTop: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '0.75rem',
              background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
              color: '#a78bfa', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
            <Plus size={18} /> New Note
          </motion.button>
        </div>
      )}
    </div>
  );
}

