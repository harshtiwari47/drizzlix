import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Plus, Search, Pin, PinOff, Trash2, FileText, Eye, Edit3, Check,
  Bold, Italic, List, Code, Link, Image, Hash, ChevronRight,
  Save, X, AlignLeft, Heading1, Heading2, Quote, ChevronLeft, Menu, ChevronDown, Box,
  ListChecks, Circle, CheckCircle2, GripVertical
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { measureTextBlock } from '../services/textMetrics';
import AuthoringToast from '../components/AuthoringToast';
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
const FOCUS_RING = '0 0 0 2px var(--badge-bg)';

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
  violet: 'var(--accent-primary)', blue: 'var(--accent-primary)', green: 'var(--success)',
  amber: 'var(--warning)', rose: 'var(--danger)', cyan: 'var(--accent-secondary)',
};

const _MOTION = motion;

/* ── Format helpers ──────────────────────────────────────────────────── */
const formatTime = (d) => {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const wordCount = (text = '') => text.trim().split(/\s+/).filter(Boolean).length;

/* ── Checklist helpers ──────────────────────────────────────────────── */
const CHECKLIST_RE = /^(\s*)-\s\[([ xX])\]\s(.*)$/;

const parseChecklistItems = (bodyText) => {
  const lines = (bodyText || '').split('\n');
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CHECKLIST_RE);
    if (match) {
      items.push({
        lineIndex: i,
        indent: match[1],
        checked: match[2] !== ' ',
        text: match[3],
      });
    }
  }
  return items;
};

const toggleChecklistLine = (bodyText, lineIndex) => {
  const lines = (bodyText || '').split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return bodyText;
  const line = lines[lineIndex];
  const match = line.match(CHECKLIST_RE);
  if (!match) return bodyText;
  const wasChecked = match[2] !== ' ';
  lines[lineIndex] = `${match[1]}- [${wasChecked ? ' ' : 'x'}] ${match[3]}`;
  return lines.join('\n');
};

const removeChecklistLine = (bodyText, lineIndex) => {
  const lines = (bodyText || '').split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return bodyText;
  lines.splice(lineIndex, 1);
  return lines.join('\n');
};

const appendChecklistItem = (bodyText, text) => {
  const trimmed = (text || '').trim();
  if (!trimmed) return bodyText;
  const newLine = `- [ ] ${trimmed}`;
  const current = bodyText || '';
  if (!current) return newLine;
  const endsWithNewline = current.endsWith('\n');
  return current + (endsWithNewline ? '' : '\n') + newLine;
};

/* ── Inline Checklist Panel ─────────────────────────────────────────── */
const ChecklistPanel = React.memo(function ChecklistPanel({ body, setBody, setDirty, isPhone }) {
  const shouldReduceMotion = useReducedMotion();
  const [newItemText, setNewItemText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef(null);

  const items = useMemo(() => parseChecklistItems(body), [body]);
  const totalCount = items.length;
  const checkedCount = items.filter(i => i.checked).length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const handleToggle = useCallback((lineIndex) => {
    setBody(prev => toggleChecklistLine(prev, lineIndex));
    setDirty(true);
  }, [setBody, setDirty]);

  const handleRemove = useCallback((lineIndex) => {
    setBody(prev => removeChecklistLine(prev, lineIndex));
    setDirty(true);
  }, [setBody, setDirty]);

  const handleAdd = useCallback(() => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    setBody(prev => appendChecklistItem(prev, trimmed));
    setDirty(true);
    setNewItemText('');
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [newItemText, setBody, setDirty]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }, [handleAdd]);

  const progressColor = progress === 100
    ? 'var(--success)'
    : progress > 50
      ? 'var(--warning)'
      : 'var(--accent-primary)';

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: MOTION_EASE_OUT }}
      style={{
        borderBottom: '1px solid var(--card-hover)',
        background: 'var(--card-bg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: isPhone ? '0.7rem 0.85rem' : '0.85rem 1.5rem' }}>
        {/* Header with progress */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '0.65rem', gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ListChecks size={15} color="var(--badge-bg)" />
            <span style={{
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)', letterSpacing: '-0.01em'
            }}>
              Checklist
            </span>
            {totalCount > 0 && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, color: progressColor,
                background: `${progressColor}18`, border: `1px solid ${progressColor}35`,
                borderRadius: '999px', padding: '0.12rem 0.42rem',
                transition: 'all 0.2s ease'
              }}>
                {checkedCount}/{totalCount}
              </span>
            )}
          </div>
          {totalCount > 0 && (
            <div style={{ flex: 1, maxWidth: '140px' }}>
              <div style={{
                height: '4px', borderRadius: '999px',
                background: 'var(--card-hover)', overflow: 'hidden'
              }}>
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35, ease: MOTION_EASE_OUT }}
                  style={{
                    height: '100%', borderRadius: '999px',
                    background: `linear-gradient(90deg, ${progressColor}88, ${progressColor})`,
                    boxShadow: `0 0 8px ${progressColor}44`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Checklist Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.55rem' }}>
          <AnimatePresence initial={false}>
            {items.map((item, idx) => (
              <motion.div
                key={`cl-${item.lineIndex}-${idx}`}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 8, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18, ease: MOTION_EASE_OUT }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  padding: '0.38rem 0.5rem',
                  borderRadius: '0.55rem',
                  background: item.checked ? 'var(--success)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${item.checked ? 'var(--success)' : 'var(--card-hover)'}`,
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                  cursor: 'default',
                }}
              >
                <motion.button
                  type="button"
                  onClick={() => handleToggle(item.lineIndex)}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.15 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                  transition={{ duration: 0.12, ease: MOTION_EASE_OUT }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0.1rem', display: 'flex', alignItems: 'center',
                    color: item.checked ? 'var(--success)' : 'var(--text-secondary)',
                    transition: 'color 0.16s ease', flexShrink: 0,
                  }}
                  aria-label={item.checked ? 'Uncheck item' : 'Check item'}
                >
                  {item.checked
                    ? <CheckCircle2 size={18} />
                    : <Circle size={18} />}
                </motion.button>
                <span style={{
                  flex: 1, fontSize: '0.84rem', fontWeight: 500,
                  color: item.checked ? 'var(--text-secondary)' : 'var(--text-primary)',
                  textDecoration: item.checked ? 'line-through' : 'none',
                  textDecorationColor: 'var(--text-secondary)',
                  transition: 'color 0.2s ease, text-decoration 0.2s ease',
                  lineHeight: 1.4, wordBreak: 'break-word',
                }}>
                  {item.text}
                </span>
                <motion.button
                  type="button"
                  onClick={() => handleRemove(item.lineIndex)}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.1 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                  transition={{ duration: 0.12, ease: MOTION_EASE_OUT }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0.15rem', display: 'flex', alignItems: 'center',
                    color: 'var(--text-secondary)',
                    transition: 'color 0.16s ease', flexShrink: 0,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                  aria-label="Remove item"
                >
                  <X size={14} />
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Add New Item Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.45rem',
        }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '0.45rem',
            padding: '0.4rem 0.55rem',
            borderRadius: '0.55rem',
            border: `1px solid ${isInputFocused ? 'var(--badge-bg)' : 'var(--text-secondary)'}`,
            background: 'var(--card-bg)',
            boxShadow: isInputFocused ? FOCUS_RING : 'none',
            transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
          }}>
            <Plus size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="Add a to-do item..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 500,
              }}
            />
          </div>
          <motion.button
            type="button"
            onClick={handleAdd}
            disabled={!newItemText.trim()}
            whileHover={shouldReduceMotion || !newItemText.trim() ? undefined : { scale: 1.04 }}
            whileTap={shouldReduceMotion || !newItemText.trim() ? undefined : { scale: 0.96 }}
            transition={{ duration: 0.12, ease: MOTION_EASE_OUT }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '0.5rem', flexShrink: 0,
              background: newItemText.trim() ? 'var(--badge-bg)' : 'var(--card-bg)',
              border: `1px solid ${newItemText.trim() ? 'var(--badge-bg)' : 'var(--card-hover)'}`,
              color: newItemText.trim() ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: newItemText.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.16s ease',
            }}
            aria-label="Add item"
          >
            <Plus size={15} />
          </motion.button>
        </div>

        {/* Completed celebration */}
        <AnimatePresence>
          {totalCount > 0 && checkedCount === totalCount && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              style={{
                marginTop: '0.55rem',
                textAlign: 'center',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--success)',
                letterSpacing: '0.03em',
              }}
            >
              ✨ All done! Great job.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

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
          color: 'var(--text-primary)',
          backgroundColor: 'var(--card-hover)',
        }
        : {
          y: -1,
          color: 'var(--text-primary)',
          backgroundColor: 'var(--card-hover)',
        }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
      style={{
        background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
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
    bg: 'var(--card-bg)',
    border: 'var(--card-hover)',
    color: 'var(--text-primary)',
    hoverBg: 'var(--card-hover)',
    hoverBorder: 'var(--text-secondary)',
    hoverColor: 'var(--text-primary)',
    ring: 'var(--text-secondary)',
  },
  accent: {
    bg: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
    border: 'color-mix(in srgb, var(--accent-primary) 25%, transparent)',
    color: 'var(--accent-primary)',
    hoverBg: 'color-mix(in srgb, var(--accent-primary) 18%, transparent)',
    hoverBorder: 'var(--accent-primary)',
    hoverColor: 'var(--accent-primary)',
    ring: 'var(--accent-primary)',
  },
  success: {
    bg: 'color-mix(in srgb, var(--success) 10%, transparent)',
    border: 'color-mix(in srgb, var(--success) 25%, transparent)',
    color: 'var(--success)',
    hoverBg: 'var(--success)',
    hoverBorder: 'var(--success)',
    hoverColor: 'white',
    ring: 'var(--success)',
  },
  warning: {
    bg: 'color-mix(in srgb, var(--warning) 10%, transparent)',
    border: 'color-mix(in srgb, var(--warning) 25%, transparent)',
    color: 'var(--warning)',
    hoverBg: 'var(--warning)',
    hoverBorder: 'var(--warning)',
    hoverColor: 'white',
    ring: 'var(--warning)',
  },
  danger: {
    bg: 'color-mix(in srgb, var(--danger) 10%, transparent)',
    border: 'color-mix(in srgb, var(--danger) 25%, transparent)',
    color: 'var(--danger)',
    hoverBg: 'var(--danger)',
    hoverBorder: 'var(--danger)',
    hoverColor: 'white',
    ring: 'var(--danger)',
  },
};

const IconActionButton = ({
  icon,
  label,
  title,
  onClick,
  tone = 'neutral',
  isActive = false,
  size = 36,
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
      whileHover={
        disabled
          ? undefined
          : shouldReduceMotion
          ? {
              backgroundColor: palette.hoverBg,
              borderColor: palette.hoverBorder,
              color: palette.hoverColor,
            }
          : {
              y: -1,
              scale: 1.03,
              backgroundColor: palette.hoverBg,
              borderColor: palette.hoverBorder,
              color: palette.hoverColor,
            }
      }
      whileTap={disabled || shouldReduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '0.75rem',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        opacity: disabled ? 0.5 : 1,
        boxShadow: isActive
          ? `0 0 0 2px ${palette.ring} inset, 0 6px 18px rgba(0,0,0,0.08)`
          : '0 1px 2px rgba(0,0,0,0.04)',
        transition:
          'background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease',
        outline: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${palette.ring} 35%, transparent), 0 1px 2px rgba(0,0,0,0.04)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = isActive
          ? `0 0 0 2px ${palette.ring} inset, 0 6px 18px rgba(0,0,0,0.08)`
          : '0 1px 2px rgba(0,0,0,0.04)';
      }}
      onMouseEnter={(e) => {
        if (!disabled && !shouldReduceMotion) {
          e.currentTarget.style.boxShadow = isActive
            ? `0 0 0 2px ${palette.ring} inset, 0 10px 24px rgba(0,0,0,0.10)`
            : '0 6px 16px rgba(0,0,0,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = isActive
          ? `0 0 0 2px ${palette.ring} inset, 0 6px 18px rgba(0,0,0,0.08)`
          : '0 1px 2px rgba(0,0,0,0.04)';
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
        background: isActive ? 'var(--card-hover)' : 'var(--card-bg)',
        backdropFilter: 'none',
        border: `1px solid ${isActive ? 'var(--text-secondary)' : 'var(--text-secondary)'}`,
        transition: 'background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease',
        position: 'relative', overflow: 'hidden', height: 'min-content',
        willChange: 'transform'
      }}
      whileHover={shouldReduceMotion
        ? {
          background: 'var(--card-hover)',
          borderColor: 'var(--text-secondary)',
        }
        : {
          background: 'var(--card-hover)',
          borderColor: 'var(--text-secondary)',
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
          border: `1px solid ${isActive ? 'var(--text-secondary)' : 'transparent'}`,
          boxShadow: '0 10px 30px var(--shadow-color)',
          opacity: isActive ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.16s ease, border-color 0.16s ease'
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          {note.pinned && <Pin size={12} color="var(--warning)" fill="var(--warning)" style={{ flexShrink: 0 }} />}
          <span style={{
            fontSize: '0.9rem', fontWeight: 700,
            color: isActive ? 'var(--primary)' : 'var(--text-primary)',
            flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'var(--font-display)', letterSpacing: '-0.01em'
            , minHeight: `${titleMetrics?.height || NOTES_CARD_TITLE_LINE_HEIGHT}px`
          }}>
            {note.title || 'Untitled'}
          </span>
        </div>
        <div style={{
          fontSize: '0.75rem', color: isActive ? 'var(--text-secondary)' : 'var(--text-secondary)',
          lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', textOverflow: 'ellipsis', minHeight: `${snippetMetrics?.height || (NOTES_CARD_SNIPPET_LINE_HEIGHT * 2)}px`
        }}>
          {snippet || 'Empty note'}
        </div>
        <div style={{ marginTop: '0.45rem' }}>
          <span style={{
            fontSize: '0.62rem', color: 'var(--text-primary)', background: 'var(--outline)',
            padding: '0.15rem 0.45rem', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            {note.category || 'General'}
          </span>
        </div>
        <div style={{
          fontSize: '0.65rem', color: 'var(--text-secondary)',
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
          border: '0',
          borderRadius: compact ? '0.62rem' : '0.78rem',
          background: 'var(--outline)',
          color: 'var(--text-primary)',
          padding: compact ? '0.36rem 0.48rem' : '0.65rem 0.65rem',
          cursor: 'pointer',
          fontSize: compact ? '0.72rem' : '0.78rem',
          fontWeight: 700,
          overflow: 'hidden'
        }}
      >
        <Box size={compact ? 11 : 13} color="var(--text-primary)" />
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {shownLabel || 'General'}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
          style={{ display: 'flex' }}
        >
          <ChevronDown size={compact ? 12 : 14} color="var(--text-secondary)" />
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
              border: '1px solid var(--outline)',
              background: 'var(--bg-gradient)',
              boxShadow: '0 18px 42px var(--shadow-color)',
              backdropFilter: 'none',
              overflow: 'hidden',
              transformOrigin: 'top left'
            }}
          >
            <div style={{ padding: compact ? '0.5rem 0.5rem 0.4rem' : '0.65rem 0.65rem 0.5rem', borderBottom: '1px solid var(--card-hover)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: '0.65rem',
                border: `1px solid ${isQueryFocused ? 'var(--badge-bg)' : '#333'}`,
                background: 'var(--glass-surface-solid)',
                padding: compact ? '0.4rem 0.48rem' : '0.48rem 0.58rem',
                boxShadow: isQueryFocused ? FOCUS_RING : 'none',
                transition: 'border-color 0.16s ease, box-shadow 0.16s ease'
              }}>
                <Search size={12} color="var(--text-secondary)" />
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
                    color: 'var(--text-primary)',
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
                    whileHover={shouldReduceMotion ? { backgroundColor: 'var(--glass-surface-solid)' } : { x: 1 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: '0.7rem',
                      border: `1px solid ${active ? '#666' : 'var(--outline)'}`,
                      background: active
                        ? 'var(--bg-gradient)'
                        : 'var(--glass-surface-solid)',
                      color: active ? 'var(--text-primary)' : 'var(--text-primary)',
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
                    border: '1px solid var(--outline)',
                    background: 'var(--bg-gradient)',
                    color: 'var(--text-primary)',
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
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', padding: '0.55rem 0.35rem' }}>
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
  const [showChecklist, setShowChecklist] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ msg, type });
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [showSidebar, setShowSidebar] = useState(() => cachedSnapshot?.showSidebar ?? true);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSidebar(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
        showToast('Note saved successfully');
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
    <div style={{ display: 'flex', marginTop: viewportOffset, minHeight: `calc(100svh - 64px - ${viewportOffset})`, height: `calc(100dvh - 64px - ${viewportOffset})`, overflow: 'hidden', color: 'var(--text-primary)', position: 'relative', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
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
              background: 'var(--card-hover)',
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
                background: 'linear-gradient(90deg, rgba(99,179,237,0), var(--badge-bg), rgba(99,179,237,0))',
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
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0, transform: 'translateX(-18px)' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, width: sidebarWidth, transform: 'translateX(0px)' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0, transform: 'translateX(-18px)' }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.25, ease: MOTION_EASE_OUT }}
            style={{
              flexShrink: 0, borderRight: '1px solid var(--card-border)',
              display: 'flex', flexDirection: 'column',
              background: 'linear-gradient(360deg, var(--glass-surface), transparent)',
              backdropFilter: 'blur(16px)', overflow: 'hidden',
              position: isCompact ? 'absolute' : 'relative',
              inset: isCompact ? 0 : 'auto',
              zIndex: isCompact ? 35 : 'auto'
            }}
          >
            <div style={{ width: sidebarWidth, height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Sidebar Header */}
              <div style={{ height: isPhone ? '64px' : '72px', padding: isPhone ? '0 0.9rem' : '0 1.5rem', display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
                      <h2 className="title-sparkle-effect">
                        <FileText size={20} color="var(--accent-primary)" style={{}} />
                        Notes
                      </h2>
                      {notesPendingSyncCount > 0 && (
                        <span style={{
                          alignSelf: 'flex-start',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--text-secondary)',
                          borderRadius: '999px',
                          padding: '0.14rem 0.44rem',
                          background: 'var(--card-hover)'
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
                      icon={ChevronLeft}
                      label="Hide sidebar"
                      title="Hide sidebar"
                      onClick={() => setShowSidebar(false)}
                      size={isPhone ? 34 : 32}
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar Search Area */}
              <div style={{ padding: isPhone ? '0.75rem 0.9rem' : '1rem 1.5rem', borderBottom: '1px solid var(--card-bg)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  background: 'var(--card-hover)', borderRadius: '0.8rem',
                  padding: isPhone ? '0.55rem 0.75rem' : '0.6rem 0.9rem',
                  border: `1px solid ${isSearchFocused ? 'var(--badge-bg)' : 'var(--text-secondary)'}`,
                  boxShadow: isSearchFocused ? FOCUS_RING : 'none',
                  transition: 'border-color 0.16s ease, box-shadow 0.16s ease'
                }}>
                  <Search size={14} color="var(--text-secondary)" />
                  <input
                    value={search} onChange={handleSearchChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Search notes..."
                    style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', flex: 1 }}
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
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading...</div>
                ) : notesLoadError ? (
                  <div style={{ padding: '1.15rem', textAlign: 'center', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                    <div style={{ marginBottom: '0.72rem', color: 'var(--danger)', fontWeight: 700 }}>
                      {notesLoadError}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        fetchNotes({ background: false, force: true }).catch(() => undefined);
                      }}
                      style={{
                        border: '1px solid var(--text-secondary)',
                        background: 'var(--card-hover)',
                        color: 'var(--text-primary)',
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
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
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
                          border: '1px solid var(--text-secondary)',
                          background: 'var(--card-hover)',
                          color: 'var(--text-primary)',
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
        <motion.div layout style={{ flexGrow: 4, flexShrink: 1, flexBasis: '0px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Editor Topbar */}
          <div style={{
            minHeight: isPhone ? 'auto' : '72px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: isPhone ? '0.5rem' : '0.65rem',
            padding: isPhone ? '0.68rem 0.85rem' : '0.65rem 1.55rem',
            backdropFilter: 'blur(8px)', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', minWidth: 0 }}>
              {!showSidebar && (
                <IconActionButton
                  icon={Menu}
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
                  color: 'var(--text-primary)', fontWeight: 800, fontSize: isPhone ? '1rem' : '1.7rem',
                  fontFamily: 'var(--font-sidebar)',
                  borderRadius: '0.5rem',
                  padding: '0.28rem 0.48rem 0.28rem 0',
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
                    color: 'var(--text-secondary)',
                    fontSize: isPhone ? '0.85rem' : '0.9rem',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    padding: '0.3rem 0',
                    fontFamily: 'var(--font-sidebar)'
                  }}>
                    <Box size={isCompact ? 11 : 13} color="var(--text-primary)" /> {category}
                  </span>
                )}
              </div>

              {/* View Toggle (Only in Edit Mode) */}
              {isEditing && (
                <div style={{
                  display: 'flex',
                  background: 'var(--card-bg)',
                  borderRadius: '0.6rem',
                  border: '1px solid var(--card-hover)',
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
                          color: isActive ? 'white' : 'var(--text-secondary)',
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
                              background: 'var(--text-secondary)',
                              border: '1px solid var(--text-secondary)',
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
              borderBottom: '1px solid var(--card-bg)',
              background: 'var(--card-bg)', flexShrink: 0, flexWrap: 'wrap'
            }}>
              <ToolbarBtn icon={Heading1} label="Heading 1" shortcut="Ctrl+Alt+1" onClick={() => ins('# ', '')} />
              <ToolbarBtn icon={Heading2} label="Heading 2" shortcut="Ctrl+Alt+2" onClick={() => ins('## ', '')} />
              <div style={{ width: 1, height: 16, background: 'var(--card-hover)', margin: '0 0.25rem' }} />
              <ToolbarBtn icon={Bold} label="Bold" shortcut="Ctrl+B" onClick={() => ins('**', '**')} />
              <ToolbarBtn icon={Italic} label="Italic" shortcut="Ctrl+I" onClick={() => ins('*', '*')} />
              <ToolbarBtn icon={Code} label="Code" shortcut="Ctrl+`" onClick={() => ins('`', '`')} />
              <div style={{ width: 1, height: 16, background: 'var(--card-hover)', margin: '0 0.25rem' }} />
              <ToolbarBtn icon={List} label="Bullet List" shortcut="Ctrl+Shift+7" onClick={() => ins('- ', '')} />
              <ToolbarBtn icon={Quote} label="Blockquote" onClick={() => ins('> ', '')} />
              <ToolbarBtn icon={Link} label="Link" shortcut="Ctrl+K" onClick={() => ins('[', '](https://example.com)')} />
              <ToolbarBtn icon={Image} label="Image" onClick={() => ins('![Image description](', 'https://example.com/image.jpg)')} />
              <ToolbarBtn icon={Hash} label="Checkbox" onClick={() => ins('- [ ] ', '')} />
              <div style={{ width: 1, height: 16, background: 'var(--card-hover)', margin: '0 0.25rem' }} />
              <motion.button
                type="button"
                aria-label="Toggle checklist panel"
                title="Toggle checklist panel"
                onClick={() => setShowChecklist(prev => !prev)}
                whileHover={shouldReduceMotion
                  ? {
                    color: showChecklist ? 'rgba(167,139,250,1)' : 'var(--text-primary)',
                    backgroundColor: showChecklist ? 'var(--badge-bg)' : 'var(--card-hover)',
                  }
                  : {
                    y: -1,
                    color: showChecklist ? 'rgba(167,139,250,1)' : 'var(--text-primary)',
                    backgroundColor: showChecklist ? 'var(--badge-bg)' : 'var(--card-hover)',
                  }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
                style={{
                  background: showChecklist ? 'var(--badge-bg)' : 'none',
                  border: showChecklist ? '1px solid var(--badge-bg)' : '1px solid transparent',
                  color: showChecklist ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.35rem', borderRadius: '0.4rem', display: 'flex', alignItems: 'center',
                  transition: 'color 0.16s ease, background-color 0.16s ease, border-color 0.16s ease'
                }}
              >
                <ListChecks size={16} />
              </motion.button>
              <div style={{ marginLeft: isPhone ? 0 : 'auto', width: isPhone ? '100%' : 'auto', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {wordCount(body)} words · {body.length} chars
              </div>
            </div>
          )}

          {/* Inline Checklist Panel */}
          <AnimatePresence>
            {isEditing && showChecklist && (
              <ChecklistPanel
                body={body}
                setBody={setBody}
                setDirty={setDirty}
                isPhone={isPhone}
              />
            )}
          </AnimatePresence>

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
                  background: 'transparent', border: 'none', borderRight: (isEditing && !isPhone && view === 'split') ? '1px solid var(--card-bg)' : 'none',
                  color: 'var(--text-primary)', fontSize: '1.05rem', lineHeight: 1.8,
                  fontFamily: 'var(--font-notes)',
                  scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) var(--scrollbar-track)',
                  boxShadow: isEditorFocused ? `inset ${FOCUS_RING}` : 'none',
                  transition: 'box-shadow 0.16s ease'
                }}
              />
            )}

            {/* Preview Pane (Always visible unless in Editor-only Edit mode) */}
            {(!isEditing || view === 'preview' || (!isPhone && view === 'split')) && (
              <div style={{
                flex: 1, overflowY: 'auto', padding: isCompact ? '0.9rem 0.95rem' : (showSidebar ? '1rem 2rem' : '2rem 10%'),
                scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) var(--scrollbar-track)'
              }}>
                <div className="markdown-preview" style={{
                  color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.1rem',
                  fontFamily: 'var(--font-notes)',
                  maxWidth: '960px', margin: '0'
                }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={(() => {
                      let cbIdx = 0;
                      let liIdx = 0;
                      const items = parseChecklistItems(body);
                      return {
                        a: (aProps) => (
                          <a
                            {...aProps}
                            className="note-markdown-link"
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open link in a new tab"
                          />
                        ),
                        input: (inputProps) => {
                          const { type, checked, node, ...rest } = inputProps;
                          if (type === 'checkbox') {
                            const idx = cbIdx++;
                            const item = items[idx];
                            const lineIdx = item ? item.lineIndex : -1;
                            return (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  if (lineIdx >= 0) {
                                    setBody(prev => toggleChecklistLine(prev, lineIdx));
                                    setDirty(true);
                                  }
                                }}
                                className="note-interactive-checkbox"
                                style={{ cursor: 'pointer' }}
                              />
                            );
                          }
                          return <input type={type} checked={checked} {...rest} />;
                        },
                        li: (liProps) => {
                          const { children, className, node, ...rest } = liProps;
                          const isTask = className === 'task-list-item';
                          let isChecked = false;
                          if (isTask) {
                            const idx = liIdx++;
                            const item = items[idx];
                            isChecked = item ? item.checked : false;
                          }
                          return (
                            <li
                              className={isTask ? 'task-list-item note-checklist-li' : undefined}
                              style={isTask ? {
                                listStyle: 'none',
                                marginLeft: '-1.3rem',
                                padding: '0.22rem 0.35rem',
                                borderRadius: '0.4rem',
                                background: isChecked ? 'var(--success)' : 'transparent',
                                transition: 'background 0.2s ease',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.1rem',
                              } : undefined}
                              {...rest}
                            >
                              {isTask ? (
                                <span style={{
                                  color: isChecked ? 'var(--text-secondary)' : 'inherit',
                                  textDecoration: isChecked ? 'line-through' : 'none',
                                  textDecorationColor: 'var(--text-secondary)',
                                  transition: 'color 0.2s ease',
                                }}>
                                  {children}
                                </span>
                              ) : children}
                            </li>
                          );
                        },
                      };
                    })()}
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
            gap: isPhone ? '0.25rem 0.6rem' : 0, padding: isPhone ? '0.35rem 0.75rem' : '0.35rem 1.5rem', borderTop: '1px solid var(--card-bg)',
            background: 'var(--scrollbar-track)', fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0
          }}>
            {!isTiny && <span>Markdown · GFM · Auto-save enabled</span>}
            <span>{activeNote.updatedAt ? `Last saved ${formatTime(activeNote.updatedAt)}` : 'Not saved'}</span>
          </div>
        </motion.div>
      ) : (
        <motion.div layout style={{ flexGrow: 4, flexShrink: 1, flexBasis: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)' }}>
          <FileText size={52} strokeWidth={1} />
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>Select a note or create a new one</p>
          <motion.button
            whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
            onClick={createNote}
            style={{
              marginTop: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '0.75rem',
              background: 'var(--badge-bg)', border: '1px solid var(--badge-bg)',
              color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
            <Plus size={18} /> New Note
          </motion.button>
        </motion.div>
      )}
      <AuthoringToast toast={toast} reduceMotion={shouldReduceMotion} />
    </div>
  );
}
