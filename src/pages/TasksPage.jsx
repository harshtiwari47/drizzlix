import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Check, Pin, Trash2, Clock, Edit3,
  CheckSquare, Calendar as CalendarIcon,
  AlertTriangle, CalendarDays, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  enqueueOfflineSyncRequest,
  getOfflineSyncPendingCountByDedupePrefix,
  hasOfflineSyncRequestWithDedupeKey,
  removeOfflineSyncRequestByDedupeKey,
  subscribeToOfflineSyncQueue,
} from '../services/offlineSyncQueue';
import './TasksPage.css';

const BASE = import.meta.env.VITE_API_URL || '/api';
const OFFLINE_TASK_ID_PREFIX = 'offline-task-';

const isClientOffline = () => (typeof navigator !== 'undefined' ? !navigator.onLine : false);
const createOfflineTaskId = () => `${OFFLINE_TASK_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const isOfflineTaskId = (id) => String(id || '').startsWith(OFFLINE_TASK_ID_PREFIX);
const getTaskCreateDedupeKey = (id) => `tasks:create:${id}`;
const getTaskUpdateDedupeKey = (id) => `tasks:update:${id}`;
const getTaskDeleteDedupeKey = (id) => `tasks:delete:${id}`;

/* ── Design Tokens ─────────────────────────────────────────────────── */
const PRIORITY = {
  urgent: { label: 'Urgent', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
  high: { label: 'High', color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.2)' },
  medium: { label: 'Medium', color: '#facc15', bg: 'rgba(250,204,21,0.08)', border: 'rgba(250,204,21,0.2)' },
  low: { label: 'Low', color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
};

/* ── Helpers ───────────────────────────────────────────────────────── */
const formatDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getRelativeTime = (date) => {
  if (!date) return null;
  const now = new Date();
  const due = new Date(date);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, color: '#f87171' };
  if (diffDays === 0) return { text: 'Due today', color: '#fb923c' };
  if (diffDays === 1) return { text: 'Due tomorrow', color: '#facc15' };
  return { text: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), color: 'rgba(255,255,255,0.4)' };
};

const getViewportWidth = () => {
  if (typeof window === 'undefined') return 1280;
  return window.innerWidth;
};

const useViewportWidth = () => {
  const [width, setWidth] = useState(getViewportWidth);
  // rAF ref so rapid resize events only trigger one setState per paint frame.
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return width;
};

/* ── Components ────────────────────────────────────────────────────── */

const IconButton = ({ children, onClick, color = 'rgba(255,255,255,0.4)', hoverColor = 'white', size = 'medium' }) => {
  const s = size === 'small' ? '28px' : '32px';
  const r = size === 'small' ? '0.6rem' : '0.75rem';

  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
        cursor: 'pointer', color, width: s, height: s,
        borderRadius: r, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        transform: 'translateY(0)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = hoverColor;
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = color;
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {children}
    </button>
  );
};

/* ── Date Ribbon ───────────────────────────────────────────────────── */
const DateRibbon = ({ selectedDate, onSelectDate, compact = false }) => {
  const scrollRef = useRef(null);
  const compactCardWidth = 'clamp(48px, 14vw, 56px)';
  const compactCardHeight = 'clamp(66px, 18vw, 74px)';

  const dates = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = -14; i < 45; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  useEffect(() => {
    const active = scrollRef.current?.querySelector('.active-date');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedDate]);

  const isToday = (d) => formatDateKey(d) === formatDateKey(new Date());
  const isSelected = (d) => formatDateKey(d) === formatDateKey(selectedDate);

  return (
    <div style={{ position: 'relative', width: compact ? 'clamp(14rem, 86vw, 22rem)' : '100%', maxWidth: '100%', margin: compact ? '0 auto 1.75rem' : '0 0 2.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: compact ? '1rem' : '1.5rem', padding: compact ? '0.3rem' : '0.5rem', border: '1px solid rgba(255,255,255,0.03)' }}>
      <div
        ref={scrollRef}
        style={{
          display: 'flex', gap: compact ? '0.3rem' : '0.5rem', overflowX: 'auto', padding: compact ? '0.25rem' : '0.5rem',
          scrollbarWidth: 'none', msOverflowStyle: 'none'
        }}
      >
        {dates.map((d, i) => (
          <motion.div
            key={i}
            onClick={() => onSelectDate(d)}
            className={isSelected(d) ? 'active-date' : ''}
            style={{
              flexShrink: 0, width: compact ? compactCardWidth : '64px', height: compact ? compactCardHeight : '84px', borderRadius: compact ? '1rem' : '1.25rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.4s',
              background: isSelected(d) ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: `1px solid ${isSelected(d) ? 'rgba(255,255,255,0.2)' : 'transparent'}`,
              boxShadow: isSelected(d) ? '0 0 20px rgba(167, 139, 250, 0.15)' : 'none',
              scale: isSelected(d) ? 1.05 : 1
            }}
            whileHover={compact ? undefined : { background: 'rgba(255,255,255,0.05)', scale: isSelected(d) ? 1.05 : 1.02 }}
          >
            <span style={{ fontSize: compact ? '0.52rem' : '0.65rem', color: isSelected(d) ? 'white' : 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {d.toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <span style={{ fontSize: compact ? '0.95rem' : '1.15rem', color: isSelected(d) ? 'white' : 'rgba(255,255,255,0.5)', fontWeight: 800 }}>
              {d.getDate()}
            </span>
            {isToday(d) && (
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#a78bfa', marginTop: '0.2rem', boxShadow: '0 0 8px #a78bfa' }} />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color = '#a78bfa', compact = false }) => (
  <motion.div
    whileHover={{ y: -2, background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
    style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
      padding: compact ? '0.75rem 0.9rem' : '0.75rem 1.25rem', borderRadius: compact ? '1rem' : '1.25rem', display: 'flex', alignItems: 'center', gap: compact ? '0.75rem' : '1rem',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', minWidth: compact ? '100%' : '160px', flex: compact ? '1 1 100%' : 1, transition: 'all 0.3s'
    }}
  >
    <div style={{
      width: compact ? '32px' : '36px', height: compact ? '32px' : '36px', borderRadius: '0.8rem', background: `${color}15`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0
    }}>
      <Icon size={compact ? 16 : 18} strokeWidth={2.5} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: compact ? '1.05rem' : '1.25rem', fontWeight: 900, color: 'white' }}>{value}</div>
    </div>
  </motion.div>
);

const SuccessProgress = ({ value, color = '#facc15' }) => (
  <div style={{ marginTop: '0.5rem', marginBottom: '1.5rem', flex: '1 1 100%' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', padding: '0 0.25rem' }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Success Rate</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 900, color, filter: `drop-shadow(0 0 5px ${color}40)` }}>{value}%</div>
    </div>
    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.03)', position: 'relative' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        style={{
          height: '100%',
          background: `linear-gradient(90deg, ${color}cc, ${color}, ${color}cc)`,
          boxShadow: `0 0 12px ${color}40`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* CSS keyframe shimmer — GPU composited, zero JS thread cost */}
        <div className="tasks-shimmer" />
      </motion.div>
    </div>
  </div>
);

const PriorityBars = ({ priority }) => {
  const levels = { urgent: 4, high: 3, medium: 2, low: 1 };
  const count = levels[priority] || 2;
  const p = PRIORITY[priority] || PRIORITY.medium;

  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '12px' }}>
      {[1, 2, 3, 4].map(idx => (
        <div
          key={idx}
          style={{
            width: '4px',
            height: `${idx * 25}%`,
            borderRadius: '1px',
            background: idx <= count ? p.color : 'rgba(255,255,255,0.05)',
            boxShadow: idx <= count ? `0 0 8px ${p.color}80` : 'none',
            transition: 'all 0.3s ease'
          }}
        />
      ))}
    </div>
  );
};

/* ── Task Card ─────────────────────────────────────────────────────── */
const TaskCard = ({ task, onEdit, onDelete, onToggleStatus, onTogglePin, onToggleSubtask, compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const p = PRIORITY[task.priority] || PRIORITY.medium;
  const isDone = task.status === 'done';
  const relativeTime = getRelativeTime(task.dueDate);

  // Deterministic star positions seeded from task ID — stable across renders,
  // no new random values on each component mount or compact toggle.
  const stars = useMemo(() => {
    const seedBase = (task._id || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const sr = (n) => { const x = Math.sin(seedBase + n) * 43758.5453123; return x - Math.floor(x); };
    return Array.from({ length: compact ? 3 : 6 }).map((_, i) => ({
      id: i,
      top: `${(sr(i * 4) * 100).toFixed(1)}%`,
      left: `${(sr(i * 4 + 1) * 100).toFixed(1)}%`,
      delay: `${(sr(i * 4 + 2) * 3).toFixed(2)}s`,
      size: sr(i * 4 + 3) * 2 + 1,
    }));
  }, [task._id, compact]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isDone ? 0.6 : 1, y: 0 }}
      style={{
        position: 'relative',
        background: 'rgba(15, 15, 25, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${isDone ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: compact ? '1.1rem' : '1.5rem',
        boxShadow: isDone ? 'none' : '0 10px 40px rgba(0,0,0,0.4)',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        contain: 'layout paint',
      }}
      whileHover={compact ? undefined : { y: -5, borderColor: isDone ? 'rgba(255,255,255,0.1)' : 'rgba(167, 139, 250, 0.4)' }}
    >
      {/* Background Nebula & Stars */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
        borderRadius: 'inherit'
      }}>
        <div style={{
          position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
          background: `radial-gradient(circle at center, ${p.color}15 0%, transparent 40%)`,
          animation: 'nebula-pulse 8s infinite ease-in-out',
        }} />
        {stars.map(s => (
          <div key={s.id} style={{
            position: 'absolute', top: s.top, left: s.left,
            width: `${s.size}px`, height: `${s.size}px`, borderRadius: '50%',
            background: 'white', opacity: 0.5,
            boxShadow: '0 0 8px white',
            animation: `star-shine 3s infinite ease-in-out ${s.delay}`
          }} />
        ))}
      </div>

      <div style={{ padding: compact ? '1rem' : '1.5rem', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: compact ? '0.8rem' : '1.25rem', alignItems: 'flex-start', flexWrap: compact ? 'wrap' : 'nowrap' }}>
          <button
            onClick={() => onToggleStatus(task)}
            style={{
              background: isDone ? p.color : 'rgba(255, 255, 255, 0.05)',
              border: `1.5px solid ${isDone ? p.color : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '50%', width: compact ? 24 : 22, height: compact ? 24 : 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, marginTop: '0.2rem',
              boxShadow: isDone ? `0 0 15px ${p.color}60` : 'none',
              backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
              transition: 'all 0.3s'
            }}
          >
            {isDone && <Check size={14} color="#000" strokeWidth={4} />}
          </button>

          <div style={{ flex: 1, minWidth: 0, paddingRight: compact ? 0 : '4.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <h4 style={{
                margin: 0, fontSize: compact ? '1rem' : '1.1rem', color: 'white', fontWeight: 700,
                textDecoration: isDone ? 'line-through' : 'none',
                letterSpacing: '-0.02em',
                wordBreak: 'break-word'
              }}>
                {task.title}
              </h4>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ cursor: 'pointer', opacity: 0.4, display: task.description ? 'flex' : 'none' }}>
                <ChevronDown size={18} />
              </motion.div>
            </div>

            <AnimatePresence>
              {(isExpanded || (task.description && task.description.length < 60)) && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{
                    margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1.5, overflow: 'hidden', wordBreak: 'break-word'
                  }}>
                  {task.description}
                </motion.p>
              )}
            </AnimatePresence>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: compact ? '0.75rem' : '1.5rem', marginTop: compact ? '0.75rem' : '1rem' }}>
              <PriorityBars priority={task.priority} />

              {task.subtasks?.length > 0 && (
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.6rem', borderRadius: '0.6rem' }}>
                  <CheckSquare size={18} strokeWidth={3} style={{ flexShrink: 0 }} /> {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                </span>
              )}

              {relativeTime && (
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: compact ? 'normal' : 'nowrap' }}>
                  <Clock size={18} strokeWidth={3} style={{ flexShrink: 0 }} /> {relativeTime.text}
                </span>
              )}
            </div>

            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
              >
                {/* Subtasks List */}
                {task.subtasks?.length > 0 && (
                  <div style={{
                    padding: compact ? '0.9rem' : '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: compact ? '1rem' : '1.25rem',
                    border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden'
                  }}>
                    {/* Mission Progress Pipe */}
                    <div style={{ height: '2px', width: '100%', background: 'rgba(255,255,255,0.05)', position: 'absolute', top: 0, left: 0 }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%` }}
                        style={{ height: '100%', background: p.color, boxShadow: `0 0 10px ${p.color}` }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>Mission Sequence</div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: p.color, opacity: 0.8, whiteSpace: 'nowrap' }}>{Math.round((task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100)}% COMPLETE</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {task.subtasks.map((st, i) => (
                        <motion.div
                          key={i}
                          whileHover={{ x: 4, background: 'rgba(255,255,255,0.04)' }}
                          onClick={(e) => { e.stopPropagation(); onToggleSubtask(task, i); }}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer',
                            padding: '0.5rem 0.6rem', borderRadius: '0.75rem',
                            background: st.done ? 'rgba(255,255,255,0.01)' : 'transparent',
                            transition: 'all 0.2s',
                            border: `1px solid ${st.done ? 'transparent' : 'rgba(255,255,255,0.03)'}`
                          }}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: '4px', marginTop: '2px', flexShrink: 0,
                            border: `1.5px solid ${st.done ? p.color : 'rgba(255,255,255,0.15)'}`,
                            background: st.done ? p.color : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: st.done ? `0 0 8px ${p.color}40` : 'none',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}>
                            {st.done && <Check size={10} color="#000" strokeWidth={5} />}
                          </div>
                          <span style={{
                            fontSize: '0.8rem', color: st.done ? 'rgba(255,255,255,0.3)' : 'white',
                            textDecoration: st.done ? 'line-through' : 'none',
                            fontWeight: st.done ? 400 : 500,
                            transition: 'all 0.3s',
                            lineHeight: 1.4, wordBreak: 'break-word'
                          }}>
                            {st.title}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags Fragments */}
                {task.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                    {task.tags.map(t => (
                      <span key={t} style={{ fontSize: '0.65rem', color: 'rgba(167, 139, 250, 0.8)', background: 'rgba(167, 139, 250, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', border: '1px solid rgba(167, 139, 250, 0.1)' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <div style={{
            position: compact ? 'static' : 'absolute', top: compact ? 'auto' : 0, right: compact ? 'auto' : '1.5rem',
            transform: compact ? 'none' : 'translateY(-50%)',
            display: 'flex', gap: '0.25rem', zIndex: 10,
            background: 'rgba(25, 25, 40, 0.7)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            padding: '0.2rem', borderRadius: '0.8rem',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
            marginLeft: compact ? 'auto' : 0,
            marginTop: compact ? '0.5rem' : 0,
            width: compact ? '100%' : 'auto',
            justifyContent: compact ? 'flex-end' : 'flex-start'
          }}>
            <IconButton onClick={() => onTogglePin(task)} color={task.pinned ? '#facc15' : undefined} size="small">
              {task.pinned ? <Pin size={15} fill="#facc15" /> : <Pin size={15} />}
            </IconButton>
            <IconButton onClick={() => onEdit(task)} size="small"><Edit3 size={15} /></IconButton>
            <IconButton onClick={() => onDelete(task._id)} hoverColor="#f87171" size="small"><Trash2 size={15} /></IconButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Task Modal ─────────────────────────────────────────────────────── */
const TaskModal = ({ task, onClose, onSave, compact = false }) => {
  const isEdit = !!task?._id;
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'medium',
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    subtasks: task?.subtasks || [],
    tags: task?.tags || [],
  });

  const [newTag, setNewTag] = useState('');

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave(form);
    onClose();
  };

  const addSubtask = () => {
    setForm(f => ({ ...f, subtasks: [...f.subtasks, { title: '', done: false }] }));
  };

  const updateSubtask = (idx, val) => {
    const next = [...form.subtasks];
    next[idx].title = val;
    setForm(f => ({ ...f, subtasks: next }));
  };

  const removeSubtask = (idx) => {
    setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, i) => i !== idx) }));
  };

  const handleTagKey = (e) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!form.tags.includes(newTag.trim())) {
        setForm(f => ({ ...f, tags: [...f.tags, newTag.trim()] }));
      }
      setNewTag('');
    }
  };

  const removeTag = (tag) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  // Portal breaks out of all ancestor stacking contexts — no z-index number
  // can fix a stacking context problem, only a portal can.
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: compact ? 'flex-end' : 'center', justifyContent: 'center', padding: compact ? '0.6rem' : '1.5rem' }}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(5, 5, 10, 0.8)', backdropFilter: 'blur(6px)' }}
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: compact ? '100%' : '95%', maxWidth: '650px', maxHeight: compact ? '92dvh' : '90vh', overflowY: 'auto', overflowX: 'hidden',
          background: 'rgba(15, 15, 25, 0.4)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: compact ? '1.4rem' : '2rem',
          padding: compact ? '1rem' : 'clamp(1.5rem, 5vw, 3rem)', color: 'white',
          boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
          scrollbarWidth: 'none'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? '1.25rem' : '2.5rem', gap: '0.75rem' }}>
          <h2 style={{
            margin: 0, fontSize: compact ? '1.2rem' : '1.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em',
            background: 'linear-gradient(90deg, #FFFFFF, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            {isEdit ? 'Edit Mission' : 'New Protocol'}
          </h2>
          <IconButton onClick={onClose}><X size={24} /></IconButton>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '1rem' : '2rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>Objective</label>
            <input
              autoFocus value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Primary directive..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: compact ? '0.95rem' : '1.25rem', borderRadius: '1.25rem', color: 'white', fontSize: compact ? '1rem' : '1.2rem', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>Intelligence Briefing</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detailed parameters..." rows={3}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: compact ? '0.95rem' : '1.25rem', borderRadius: '1.25rem', color: 'white', fontSize: '1rem', outline: 'none', resize: 'vertical', minHeight: compact ? '88px' : '108px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1.2fr', gap: compact ? '1rem' : '2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>Priority</label>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '1.25rem', padding: '0.4rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                {Object.keys(PRIORITY).map(p => (
                  <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                    style={{
                      flex: 1, height: '40px', borderRadius: '1rem', border: 'none',
                      background: form.priority === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: form.priority === p ? PRIORITY[p].color : 'rgba(255,255,255,0.2)',
                      cursor: 'pointer', transition: 'all 0.3s', fontWeight: 800, fontSize: '0.8rem'
                    }}
                  >
                    {p === 'urgent' ? '!!!' : p === 'high' ? '!!' : p === 'medium' ? '!' : '•'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.1em' }}>Temporal Coordinate</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.8rem 1.25rem', borderRadius: '1.25rem', color: 'white', colorScheme: 'dark', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: compact ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Sequence Steps</label>
              <button
                onClick={addSubtask}
                style={{
                  background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.2)',
                  color: '#a78bfa', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: compact ? '0.45rem 0.75rem' : '0.5rem 1.2rem',
                  borderRadius: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Plus size={14} strokeWidth={3} /> Add Mission Step
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {form.subtasks.map((st, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  key={i}
                  style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: compact ? '0.35rem' : '0.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <div style={{ width: compact ? '26px' : '30px', height: compact ? '26px' : '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)' }}>{i + 1}</div>
                  <input
                    value={st.title} onChange={e => updateSubtask(i, e.target.value)}
                    placeholder="Refine directive..."
                    style={{ flex: 1, background: 'none', border: 'none', color: 'white', fontSize: '0.95rem', outline: 'none', padding: '0.5rem' }}
                  />
                  <IconButton onClick={() => removeSubtask(i)} hoverColor="#f87171" size="small"><Trash2 size={16} /></IconButton>
                </motion.div>
              ))}
              {form.subtasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2.5rem', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '1.25rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', letterSpacing: '0.02em' }}>
                  No extra steps defined for this protocol.
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.1em' }}>Classification Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              {form.tags.map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.08)', borderRadius: '0.75rem', fontSize: '0.8rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)' }}>
                  {t} <X size={14} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => removeTag(t)} />
                </div>
              ))}
              <input
                value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={handleTagKey} placeholder="New tag + Enter..."
                style={{ flex: 1, minWidth: '120px', background: 'none', border: 'none', color: 'white', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            style={{
              marginTop: compact ? '0.75rem' : '1.5rem', padding: compact ? '1rem' : '1.25rem', borderRadius: '1.5rem',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', fontWeight: 900, fontSize: compact ? '0.95rem' : '1.1rem', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'all 0.3s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.4)'; e.currentTarget.style.borderColor = '#a78bfa80'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          >
            {isEdit ? 'Archive Updates' : 'Authorize Protocol'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

/* ── Main Page ────────────────────────────────────────────────────── */
export default function TasksPage() {
  const { token } = useAuth();
  const viewportWidth = useViewportWidth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [drawerTask, setDrawerTask] = useState(null);
  const [tasksPendingSyncCount, setTasksPendingSyncCount] = useState(0);
  useEffect(() => {
    getOfflineSyncPendingCountByDedupePrefix('tasks:').then(setTasksPendingSyncCount);
  }, []);
  const lastFetchAtRef = useRef(0);
  const isFetchingRef = useRef(false);

  const isCompact = viewportWidth <= 640;

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const readTasksPendingSyncCount = useCallback(async () => await getOfflineSyncPendingCountByDedupePrefix('tasks:'), []);

  const sortTasksForList = useCallback((items) => {
    return [...items].sort((a, b) => {
      const pinnedDelta = Number(Boolean(b?.pinned)) - Number(Boolean(a?.pinned));
      if (pinnedDelta !== 0) return pinnedDelta;

      const createdA = new Date(a?.createdAt || 0).getTime();
      const createdB = new Date(b?.createdAt || 0).getTime();
      return createdB - createdA;
    });
  }, []);

  const toTaskPayload = useCallback((taskLike) => {
    return {
      title: String(taskLike?.title || 'Untitled Task').trim() || 'Untitled Task',
      description: String(taskLike?.description || ''),
      priority: String(taskLike?.priority || 'medium'),
      status: String(taskLike?.status || 'todo'),
      dueDate: taskLike?.dueDate || null,
      tags: Array.isArray(taskLike?.tags) ? taskLike.tags : [],
      subtasks: Array.isArray(taskLike?.subtasks)
        ? taskLike.subtasks.map((subtask) => ({
          title: String(subtask?.title || '').trim(),
          done: Boolean(subtask?.done),
        })).filter((subtask) => subtask.title)
        : [],
      pinned: Boolean(taskLike?.pinned),
    };
  }, []);

  const queueOfflineTaskCreate = useCallback((taskLike) => {
    if (!token) return;
    const taskId = String(taskLike?._id || createOfflineTaskId());

    enqueueOfflineSyncRequest({
      url: `${BASE}/tasks`,
      method: 'POST',
      authMode: 'bearer',
      dedupeKey: getTaskCreateDedupeKey(taskId),
      headers: { 'Content-Type': 'application/json' },
      body: toTaskPayload(taskLike),
    });
  }, [token, toTaskPayload]);

  const queueOfflineTaskUpdate = useCallback((id, payload, baseUpdatedAt = null) => {
    if (!token) return;
    const taskId = String(id || '');
    if (!taskId) return;

    enqueueOfflineSyncRequest({
      url: `${BASE}/tasks/${taskId}`,
      method: 'PATCH',
      authMode: 'bearer',
      dedupeKey: getTaskUpdateDedupeKey(taskId),
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      conflictGuard: baseUpdatedAt
        ? {
          strategy: 'skip-if-remote-newer',
          resourceUrl: `${BASE}/tasks/${taskId}`,
          baseUpdatedAt,
        }
        : null,
    });
  }, [token]);

  const queueOfflineTaskDelete = useCallback((id, baseUpdatedAt = null) => {
    if (!token) return;
    const taskId = String(id || '');
    if (!taskId) return;

    removeOfflineSyncRequestByDedupeKey(getTaskUpdateDedupeKey(taskId));

    enqueueOfflineSyncRequest({
      url: `${BASE}/tasks/${taskId}`,
      method: 'DELETE',
      authMode: 'bearer',
      dedupeKey: getTaskDeleteDedupeKey(taskId),
      headers: { 'Content-Type': 'application/json' },
      body: null,
      conflictGuard: baseUpdatedAt
        ? {
          strategy: 'skip-if-remote-newer',
          resourceUrl: `${BASE}/tasks/${taskId}`,
          baseUpdatedAt,
        }
        : null,
    });
  }, [token]);

  const applyLocalTaskUpdate = useCallback((nextTask) => {
    setTasks((previousTasks) => {
      const existingIndex = previousTasks.findIndex((task) => task._id === nextTask._id);
      const merged = existingIndex >= 0
        ? previousTasks.map((task) => (task._id === nextTask._id ? nextTask : task))
        : [nextTask, ...previousTasks];

      return sortTasksForList(merged);
    });
  }, [sortTasksForList]);

  const fetchTasks = useCallback(async ({ background = false, minIntervalMs = 0 } = {}) => {
    if (!token) {
      if (!background) setLoading(false);
      return;
    }

    const now = Date.now();
    if (minIntervalMs > 0 && now - lastFetchAtRef.current < minIntervalMs) {
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchAtRef.current = now;

    if (!background) {
      setLoading(true);
    }

    try {
      const res = await fetch(`${BASE}/tasks`, { headers });
      if (!res.ok) {
        throw new Error(`Task fetch failed with status ${res.status}`);
      }

      const data = await res.json();
      const remoteTasks = Array.isArray(data) ? data : [];

      setTasks((currentTasks) => {
        const pendingLocalTasks = currentTasks.filter((task) => {
          if (!isOfflineTaskId(task?._id)) return false;
          return hasOfflineSyncRequestWithDedupeKey(getTaskCreateDedupeKey(task._id));
        });

        return sortTasksForList([...pendingLocalTasks, ...remoteTasks]);
      });
    } catch {
      // Preserve local task state when offline or when network requests fail.
    } finally {
      isFetchingRef.current = false;
      if (!background) {
        setLoading(false);
      }
    }
  }, [headers, sortTasksForList, token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetchTasks({ background: false }).catch(() => undefined);
  }, [fetchTasks, token]);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return undefined;

    const handleOnline = () => {
      window.setTimeout(() => {
        fetchTasks({ background: true, minIntervalMs: 1200 }).catch(() => undefined);
      }, 2200);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchTasks, token]);

  useEffect(() => {
    if (!token) {
      setTasksPendingSyncCount(0);
      return undefined;
    }

    setTasksPendingSyncCount(readTasksPendingSyncCount());
    return subscribeToOfflineSyncQueue(() => {
      setTasksPendingSyncCount(readTasksPendingSyncCount());
    });
  }, [token, readTasksPendingSyncCount]);

  useEffect(() => {
    if (!token) return undefined;

    return subscribeToOfflineSyncQueue((pendingCount) => {
      if (pendingCount === 0 && !isClientOffline()) {
        fetchTasks({ background: true, minIntervalMs: 1200 }).catch(() => undefined);
      }
    });
  }, [fetchTasks, token]);

  const filteredTasks = useMemo(() => {
    const dateKey = formatDateKey(selectedDate);
    return tasks.filter(t => t.dueDate ? formatDateKey(t.dueDate) === dateKey : false);
  }, [tasks, selectedDate]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter(t => t.status === 'done').length;
    const efficiency = total > 0 ? Math.round((done / total) * 100) : 0;
    const highCount = filteredTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
    return { total, done, efficiency, highCount };
  }, [filteredTasks]);

  const saveTask = async (data) => {
    const isEdit = Boolean(data?._id);
    const taskId = String(data?._id || '');
    const baseUpdatedAt = data?.updatedAt || null;
    const payload = toTaskPayload(data);

    const fallbackToOfflineCreate = () => {
      const timestamp = new Date().toISOString();
      const offlineTask = {
        _id: createOfflineTaskId(),
        ...payload,
        createdAt: timestamp,
        updatedAt: timestamp,
        __pendingSync: true,
      };

      applyLocalTaskUpdate(offlineTask);
      queueOfflineTaskCreate(offlineTask);
    };

    if (isEdit && isOfflineTaskId(taskId)) {
      const optimisticTask = {
        ...data,
        ...payload,
        updatedAt: new Date().toISOString(),
        __pendingSync: true,
      };
      applyLocalTaskUpdate(optimisticTask);
      queueOfflineTaskCreate(optimisticTask);
      return;
    }

    if (!isEdit && isClientOffline()) {
      fallbackToOfflineCreate();
      return;
    }

    if (isEdit && isClientOffline()) {
      const optimisticTask = {
        ...data,
        ...payload,
        updatedAt: new Date().toISOString(),
        __pendingSync: true,
      };
      applyLocalTaskUpdate(optimisticTask);
      queueOfflineTaskUpdate(taskId, payload, baseUpdatedAt);
      return;
    }

    try {
      const url = isEdit ? `${BASE}/tasks/${taskId}` : `${BASE}/tasks`;
      const method = isEdit ? 'PATCH' : 'POST';
      const response = await fetch(url, { method, headers, body: JSON.stringify(payload) });

      if (!response.ok) {
        throw new Error(`Task save failed with status ${response.status}`);
      }

      const updatedTask = await response.json();
      applyLocalTaskUpdate({ ...updatedTask, __pendingSync: false });

      if (isEdit) {
        removeOfflineSyncRequestByDedupeKey(getTaskUpdateDedupeKey(taskId));
      }
    } catch {
      if (isEdit) {
        const optimisticTask = {
          ...data,
          ...payload,
          updatedAt: new Date().toISOString(),
          __pendingSync: true,
        };
        applyLocalTaskUpdate(optimisticTask);
        queueOfflineTaskUpdate(taskId, payload, baseUpdatedAt);
      } else {
        fallbackToOfflineCreate();
      }
    }
  };

  const toggleTaskStatus = async (task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    saveTask({ ...task, status: nextStatus });
  };

  const deleteTask = async (id) => {
    const taskId = String(id || '');
    if (!taskId) return;
    const targetTask = tasks.find((task) => task._id === taskId);
    const baseUpdatedAt = targetTask?.updatedAt || null;

    const removeFromLocalState = () => {
      setTasks((previousTasks) => previousTasks.filter((task) => task._id !== taskId));
    };

    removeOfflineSyncRequestByDedupeKey(getTaskUpdateDedupeKey(taskId));

    if (isOfflineTaskId(taskId)) {
      removeOfflineSyncRequestByDedupeKey(getTaskCreateDedupeKey(taskId));
      removeOfflineSyncRequestByDedupeKey(getTaskDeleteDedupeKey(taskId));
      removeFromLocalState();
      return;
    }

    if (isClientOffline()) {
      queueOfflineTaskDelete(taskId, baseUpdatedAt);
      removeFromLocalState();
      return;
    }

    try {
      const response = await fetch(`${BASE}/tasks/${taskId}`, { method: 'DELETE', headers });
      if (!response.ok) {
        throw new Error(`Task delete failed with status ${response.status}`);
      }
      removeOfflineSyncRequestByDedupeKey(getTaskDeleteDedupeKey(taskId));
    } catch {
      queueOfflineTaskDelete(taskId, baseUpdatedAt);
    }

    removeFromLocalState();
  };

  const togglePin = async (task) => {
    saveTask({ ...task, pinned: !task.pinned });
  };

  const toggleSubtask = async (task, subIndex) => {
    const nextSubtasks = [...task.subtasks];
    nextSubtasks[subIndex].done = !nextSubtasks[subIndex].done;
    saveTask({ ...task, subtasks: nextSubtasks });
  };

  return (
    <div style={{ padding: isCompact ? '1rem 0.8rem 1.5rem' : 'clamp(1rem, 5vw, 3rem) clamp(1rem, 3vw, 2rem)', maxWidth: '1280px', margin: '0 auto', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'stretch' : 'center', marginBottom: isCompact ? '2rem' : '3rem', gap: isCompact ? '1rem' : '2.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: 'min(320px, 100%)', flexWrap: 'wrap' }}>
          <StatCard label="Total Tasks" value={stats.total} icon={CheckSquare} color="#a78bfa" compact={isCompact} />
          <StatCard label="Completed" value={stats.done} icon={Check} color="#4ade80" compact={isCompact} />
          <StatCard label="Important" value={stats.highCount} icon={AlertTriangle} color="#f87171" compact={isCompact} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isCompact ? 'stretch' : 'flex-end', gap: '0.45rem', width: isCompact ? '100%' : 'auto' }}>
          {tasksPendingSyncCount > 0 && (
            <span style={{
              alignSelf: isCompact ? 'flex-start' : 'flex-end',
              fontSize: '0.66rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: '999px',
              padding: '0.16rem 0.5rem',
              background: 'rgba(255,255,255,0.08)'
            }}>
              {tasksPendingSyncCount} pending sync
            </span>
          )}
          <button
            onClick={() => setDrawerTask({ dueDate: selectedDate.toISOString() })}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              width: isCompact ? '100%' : 'auto',
              padding: isCompact ? '0.8rem 1rem' : '0.8rem 1.8rem', borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white', fontWeight: 700, fontSize: isCompact ? '0.9rem' : '1rem', cursor: 'pointer',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Plus size={18} strokeWidth={3} /> New Entry
          </button>
        </div>
      </div>

      <DateRibbon selectedDate={selectedDate} onSelectDate={setSelectedDate} compact={isCompact} />

      <SuccessProgress value={stats.efficiency} color="#facc15" />

      {/* Plain div — list items animate individually via TaskCard's own motion.div */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', opacity: 0.6, flexWrap: 'wrap' }}>
          <CalendarDays size={isCompact ? 16 : 18} />
          <h3 style={{ margin: 0, fontSize: isCompact ? '0.85rem' : '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: isCompact ? '0.06em' : '0.1em', lineHeight: 1.4 }}>
            {selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: isCompact ? '3rem 1rem' : '5rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-body)' }}>Synchronizing missions...</div>
        ) : filteredTasks.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: isCompact ? '3rem 1.2rem' : '6rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '1.5rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <CalendarIcon size={40} style={{ color: 'rgba(255,255,255,0.05)', marginBottom: '1.25rem' }} />
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1rem', fontWeight: 500 }}>No protocols active for this sequence.</p>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: isCompact ? '1rem' : '1.25rem' }}>
            <AnimatePresence mode="popLayout">
              {filteredTasks.map(t => (
                <TaskCard key={t._id} task={t} onEdit={setDrawerTask} onDelete={deleteTask} onToggleStatus={toggleTaskStatus} onTogglePin={togglePin} onToggleSubtask={toggleSubtask} compact={isCompact} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {drawerTask && <TaskModal task={drawerTask} onClose={() => setDrawerTask(null)} onSave={saveTask} compact={isCompact} />}
      </AnimatePresence>
    </div>
  );
}

