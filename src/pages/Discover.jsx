import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Search, Bookmark, BookmarkCheck, Layers, Globe, X, Eye, ChevronLeft, ChevronRight, Link2, Check } from 'lucide-react';
import { useDeck } from '../context/DeckContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { measureTextBlock } from '../services/textMetrics';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const MotionDiv = motion.div;
const CATEGORY_SPLIT_REGEX = /[,/|;&]+/;
const DISCOVER_TITLE_FONT = '700 19px Syne';
const DISCOVER_TITLE_LINE_HEIGHT = 24;
const DISCOVER_TITLE_MAX_LINES = 3;
const DISCOVER_IDLE_INDEX_THRESHOLD = 80;
const DISCOVER_IDLE_RANK_THRESHOLD = 70;
const DISCOVER_IDLE_TIMEOUT_MS = 1200;
const EASE_OUT_CURVE = [0.23, 1, 0.32, 1];

const normalizeCategoryKey = (value) => String(value || '').trim().toLowerCase();

const formatCategoryLabel = (value) => {
  const cleaned = String(value || '').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const splitCategoryValues = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => splitCategoryValues(entry));
  }

  return String(value || '')
    .split(CATEGORY_SPLIT_REGEX)
    .map((part) => part.trim())
    .filter(Boolean);
};

const getDeckTimestamp = (deck) => {
  const source =
    deck?.publishedAt ||
    deck?.discoverMetadata?.publishedAt ||
    deck?.updatedAt ||
    deck?.createdAt;

  if (!source) return 0;
  const timestamp = new Date(source).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const scoreFieldMatch = (field, query, { exact = 0, prefix = 0, includes = 0 }) => {
  if (!field || !query) return 0;
  if (field === query) return exact;
  if (field.startsWith(query)) return prefix;
  if (field.includes(query)) return includes;
  return 0;
};

const getSearchRelevanceScore = (query, deckIndexRow) => {
  if (!query) return 0;

  let score = 0;
  score += scoreFieldMatch(deckIndexRow.titleLower, query, { exact: 12, prefix: 8, includes: 5 });
  score += scoreFieldMatch(deckIndexRow.authorNameLower, query, { exact: 4, prefix: 3, includes: 2.2 });
  score += scoreFieldMatch(deckIndexRow.usernameLower, query, { exact: 5.5, prefix: 4, includes: 2.6 });
  score += scoreFieldMatch(deckIndexRow.userIdLower, query, { exact: 4.5, prefix: 3.4, includes: 2.1 });
  score += scoreFieldMatch(deckIndexRow.topicLower, query, { exact: 3.2, prefix: 2.4, includes: 1.6 });

  if (deckIndexRow.labelsLower.some((label) => label === query)) score += 3.8;
  else if (deckIndexRow.labelsLower.some((label) => label.startsWith(query))) score += 2.6;
  else if (deckIndexRow.labelsLower.some((label) => label.includes(query))) score += 1.7;

  return score;
};

const scheduleIdleTask = (callback, timeout = DISCOVER_IDLE_TIMEOUT_MS) => {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    return {
      type: 'idle',
      id: window.requestIdleCallback(() => callback(), { timeout }),
    };
  }

  return {
    type: 'timeout',
    id: typeof window !== 'undefined' ? window.setTimeout(callback, 20) : setTimeout(callback, 20),
  };
};

const cancelScheduledIdleTask = (handle) => {
  if (!handle) return;

  if (handle.type === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle.id);
    return;
  }

  if (typeof window !== 'undefined') {
    window.clearTimeout(handle.id);
    return;
  }

  clearTimeout(handle.id);
};

const buildIndexedDeckRows = (publicDecks) => {
  const now = Date.now();

  return publicDecks.map((deck, order) => {
    const labelsRaw = splitCategoryValues(deck.labels || []);
    const topicsRaw = splitCategoryValues(deck?.discoverMetadata?.topic || '');
    const categoryMap = new Map();

    for (const value of [...labelsRaw, ...topicsRaw]) {
      const key = normalizeCategoryKey(value);
      if (!key || categoryMap.has(key)) continue;
      categoryMap.set(key, formatCategoryLabel(value));
    }

    const categories = Array.from(categoryMap.entries()).map(([key, label]) => ({ key, label }));
    const categoryKeys = categories.map((category) => category.key);

    const titleLower = String(deck.title || '').toLowerCase();
    const authorNameLower = String(deck?.publishedBy?.name || '').toLowerCase();
    const usernameLower = String(deck?.publishedBy?.username || '').toLowerCase();
    const userIdLower = String(deck?.publishedBy?.userId || '').toLowerCase();
    const labelsLower = labelsRaw.map((label) => label.toLowerCase());
    const topicLower = topicsRaw.join(' ').toLowerCase();

    const cardCount = Array.isArray(deck.cards) ? deck.cards.length : 0;
    const saves = Number(deck.saves || 0);
    const timestamp = getDeckTimestamp(deck);

    const ageDays = timestamp > 0 ? Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24)) : 120;
    const freshnessScore = Math.max(0, 1.25 - (ageDays / 45));
    const popularityScore = (Math.log1p(saves) * 1.4) + (Math.min(cardCount, 30) * 0.045);
    const qualityScore =
      (deck.thumbnail ? 0.3 : 0) +
      (Math.min(categories.length, 6) * 0.08) +
      (Math.min(cardCount, 20) * 0.022);

    return {
      deck,
      order,
      titleLower,
      authorNameLower,
      usernameLower,
      userIdLower,
      labelsLower,
      topicLower,
      categories,
      categoryKeys,
      cardCount,
      saves,
      timestamp,
      freshnessScore,
      popularityScore,
      qualityScore,
    };
  });
};

const buildRankedDeckRows = (indexedDecks, normalizedSearchQuery, activeCategoryKeys) => {
  const query = normalizedSearchQuery;
  const hasQuery = Boolean(query);
  const hasCategorySelection = activeCategoryKeys.length > 0;
  const selectedCategories = new Set(activeCategoryKeys);

  return indexedDecks
    .filter((row) => {
      const matchesSearch = !hasQuery
        || row.titleLower.includes(query)
        || row.labelsLower.some((label) => label.includes(query))
        || row.authorNameLower.includes(query)
        || row.usernameLower.includes(query)
        || row.userIdLower.includes(query)
        || row.topicLower.includes(query);

      const matchesCategory =
        !hasCategorySelection
        || row.categoryKeys.some((key) => selectedCategories.has(key));

      return matchesSearch && matchesCategory;
    })
    .map((row) => {
      const searchScore = hasQuery ? getSearchRelevanceScore(query, row) : 0;
      const categoryMatchCount = hasCategorySelection
        ? row.categoryKeys.filter((key) => selectedCategories.has(key)).length
        : 0;

      const rankScore =
        (searchScore * (hasQuery ? 2.6 : 0)) +
        (row.popularityScore * 1.35) +
        (row.freshnessScore * 1.05) +
        row.qualityScore +
        (hasCategorySelection ? Math.min(categoryMatchCount, 3) * 0.85 : 0);

      const trendingScore =
        (row.popularityScore * 1.7) +
        (row.freshnessScore * 0.8) +
        (row.qualityScore * 0.55);

      const freshScore =
        (row.freshnessScore * 2) +
        (row.qualityScore * 0.65) +
        (row.popularityScore * 0.28);

      return {
        ...row,
        searchScore,
        rankScore,
        trendingScore,
        freshScore,
      };
    })
    .sort((a, b) =>
      b.rankScore - a.rankScore
      || b.searchScore - a.searchScore
      || b.saves - a.saves
      || b.timestamp - a.timestamp
      || a.order - b.order
    );
};

/* ─── Author chip ─── */
const AuthorChip = React.memo(function AuthorChip({ name, username, picture, userId, onClick }) {
  const displayName = username ? `@${username}` : name;
  const isClickable = username || userId;
  return (
    <div
      onClick={onClick}
      title={isClickable ? `View ${name}'s profile` : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isClickable ? 'pointer' : 'default', width: 'fit-content' }}
    >
      {picture
        ? <img loading="lazy" decoding="async" src={picture} alt={name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
        : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(99,179,237,0.2)', border: '1px solid rgba(99,179,237,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#63b3ed' }}>{name?.[0]?.toUpperCase()}</div>
      }
      <span style={{ fontSize: '0.78rem', color: isClickable ? '#63b3ed' : 'var(--secondary)', fontFamily: 'var(--font-body)', fontWeight: 500, textDecoration: isClickable ? 'underline' : 'none', textDecorationColor: 'rgba(99,179,237,0.4)' }}>{displayName}</span>
    </div>
  );
});

const UserSearchResultCard = React.memo(function UserSearchResultCard({ user, onOpenProfile }) {
  const canOpen = Boolean(user.username);

  const handleClick = useCallback(() => {
    if (!canOpen) return;
    onOpenProfile(user.username);
  }, [canOpen, onOpenProfile, user.username]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canOpen}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        padding: '0.62rem 0.72rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '0.75rem',
        cursor: canOpen ? 'pointer' : 'default',
        textAlign: 'left',
        opacity: canOpen ? 1 : 0.72,
      }}
      title={canOpen ? `Open @${user.username}` : 'Profile unavailable'}
    >
      {user.picture ? (
        <img
          loading="lazy"
          decoding="async"
          src={user.picture}
          alt={user.name}
          style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.16)' }}
        />
      ) : (
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(99,179,237,0.18)', border: '1px solid rgba(99,179,237,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#63b3ed', fontSize: '0.74rem', fontWeight: 800 }}>
          {(user.name || 'U').slice(0, 1).toUpperCase()}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ color: 'white', fontFamily: 'var(--font-body)', fontSize: '0.84rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.name || 'Unknown user'}
        </span>
        <span style={{ color: '#93c5fd', fontFamily: 'var(--font-body)', fontSize: '0.73rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.username ? `@${user.username}` : 'No username'}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-body)', fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.userId ? `ID: ${user.userId}` : 'ID unavailable'}
        </span>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {user.deckCount} {user.deckCount === 1 ? 'deck' : 'decks'}
      </span>
    </button>
  );
});

/* ─── Full-screen preview overlay ─── */
function DeckPreviewOverlay({ deck, onClose, onSave, isSaved, isSaving, canSave }) {
  const [idx, setIdx] = useState(0);
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  const hasCards = cards.length > 0;
  const safeCardCount = Math.max(cards.length, 1);
  const safeIndex = hasCards ? Math.min(idx, cards.length - 1) : 0;
  const card = hasCards ? cards[safeIndex] : null;
  const [flipped, setFlipped] = useState(false);

  const prev = () => {
    if (!hasCards) return;
    setIdx((i) => Math.max(0, i - 1));
    setFlipped(false);
  };
  const next = () => {
    if (!hasCards) return;
    setIdx((i) => Math.min(cards.length - 1, i + 1));
    setFlipped(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (!hasCards) return;

      if (e.key === 'ArrowLeft') {
        setIdx((i) => Math.max(0, i - 1));
        setFlipped(false);
      }
      if (e.key === 'ArrowRight') {
        setIdx((i) => Math.min(cards.length - 1, i + 1));
        setFlipped(false);
      }
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cards.length, hasCards, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(12,12,12,0.97)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '1.5rem', width: '100%', maxWidth: '680px', boxShadow: '0 40px 100px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.35rem', letterSpacing: '-0.02em' }}>{deck.title}</h3>
            {deck.publishedBy?.name && <AuthorChip name={deck.publishedBy.name} username={deck.publishedBy.username} picture={deck.publishedBy.picture} />}
          </div>
          <button
            onClick={onClose}
            aria-label="Close deck preview"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--secondary)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '50%',
              display: 'flex',
              transition: 'background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, transform 150ms ease-out',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <motion.div
            animate={{ width: hasCards ? `${((safeIndex + 1) / safeCardCount) * 100}%` : '0%' }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
            style={{ height: '100%', background: 'linear-gradient(90deg, rgba(99,179,237,0.8), rgba(99,179,237,0.4))' }}
          />
        </div>

        {/* Card counter */}
        <div style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--secondary)' }}>
            Card <strong style={{ color: 'white' }}>{hasCards ? safeIndex + 1 : 0}</strong> of <strong style={{ color: 'white' }}>{cards.length}</strong>
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
            Space to flip · ← → to navigate
          </span>
        </div>

        {/* Card body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 2rem 1.5rem' }}>
          {hasCards ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={safeIndex}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.18 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                {/* Front — always visible */}
                <div style={{ background: 'rgba(99,179,237,0.05)', border: '1px solid rgba(99,179,237,0.15)', borderRadius: '1rem', padding: '1.25rem 1.5rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#63b3ed' }}>Concept</p>
                  <div className="markdown-card-content" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'white', lineHeight: 1.6 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {card?.front || ''}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Back — toggle with flip */}
                <div>
                  {flipped ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1.25rem 1.5rem' }}
                    >
                      <p style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary)' }}>Synthesis</p>
                      <div className="markdown-card-content" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {card?.back || ''}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => setFlipped(true)}
                      aria-label="Reveal synthesis answer"
                      style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '1rem', color: 'var(--secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, transition: 'border-color 200ms ease-out, color 200ms ease-out', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      <Eye size={15} /> Reveal Synthesis
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div style={{ border: '1px dashed rgba(255,255,255,0.16)', borderRadius: '1rem', padding: '1.25rem', color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
              No preview cards available for this deck.
            </div>
          )}
        </div>

        {/* Footer nav + save */}
        <div style={{ padding: '1rem 2rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <button onClick={prev} aria-label="Previous card" disabled={!hasCards || safeIndex === 0} style={{ padding: '0.6rem 0.9rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: !hasCards || safeIndex === 0 ? 'rgba(255,255,255,0.2)' : 'var(--secondary)', borderRadius: 'var(--radius-sm)', cursor: !hasCards || safeIndex === 0 ? 'default' : 'pointer', display: 'flex', transition: 'border-color 150ms ease-out, color 150ms ease-out, transform 150ms ease-out' }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={next} aria-label="Next card" disabled={!hasCards || safeIndex === cards.length - 1} style={{ padding: '0.6rem 0.9rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: !hasCards || safeIndex === cards.length - 1 ? 'rgba(255,255,255,0.2)' : 'var(--secondary)', borderRadius: 'var(--radius-sm)', cursor: !hasCards || safeIndex === cards.length - 1 ? 'default' : 'pointer', display: 'flex', transition: 'border-color 150ms ease-out, color 150ms ease-out, transform 150ms ease-out' }}>
            <ChevronRight size={16} />
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={onSave}
            disabled={!canSave || isSaved || isSaving}
            aria-label="Save deck to library"
            style={{ padding: '0.65rem 1.5rem', background: isSaved ? 'rgba(34,197,94,0.12)' : 'rgba(99,179,237,0.15)', border: `1px solid ${isSaved ? 'rgba(34,197,94,0.4)' : 'rgba(99,179,237,0.4)'}`, color: isSaved ? '#4ade80' : '#63b3ed', borderRadius: 'var(--radius-md)', cursor: !canSave || isSaved ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background-color 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out, opacity 200ms ease-out', opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaved ? <><BookmarkCheck size={15} /> Saved</> : isSaving ? <>Saving…</> : <><Bookmark size={15} /> Save to Library</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Discover page ─── */
function DiscoverDeckSkeletonGrid({ isCompact, prefersReducedMotion }) {
  const skeletonCount = isCompact ? 6 : 8;
  const skeletonIds = Array.from({ length: skeletonCount }, (_, index) => `discover-skeleton-${index}`);

  return (
    <div>
      <div role="status" aria-live="polite" style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '0.88rem', marginBottom: '1rem' }}>
        Curating fresh public decks and learning insights for you...
      </div>

      <div className="app-content-visibility-section" style={{ marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isCompact ? '0.65rem' : '0.8rem' }}>
        {[0, 1].map((panelIndex) => (
          <MotionDiv
            key={`discover-skeleton-panel-${panelIndex}`}
            initial={{ opacity: 0.54 }}
            animate={prefersReducedMotion ? { opacity: 0.62 } : { opacity: [0.5, 0.76, 0.5] }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.25, repeat: Infinity, ease: 'easeInOut', delay: panelIndex * 0.08 }}
            style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.03)', padding: isCompact ? '0.7rem' : '0.85rem' }}
            aria-hidden="true"
          >
            <div style={{ width: '44%', height: '16px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', marginBottom: '0.55rem' }} />
            <div style={{ display: 'grid', gap: '0.42rem' }}>
              {[0, 1, 2, 3].map((rowIndex) => (
                <div key={`discover-skeleton-panel-row-${panelIndex}-${rowIndex}`} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', borderRadius: '0.62rem', padding: '0.38rem 0.42rem' }}>
                  <div style={{ flex: 1, height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ width: '24px', height: '24px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.12)' }} />
                  <div style={{ width: '24px', height: '24px', borderRadius: '0.5rem', background: 'rgba(99,179,237,0.2)' }} />
                </div>
              ))}
            </div>
          </MotionDiv>
        ))}
      </div>

      <div className="app-content-visibility-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isCompact ? 220 : 300}px, 1fr))`, gap: isCompact ? '1rem' : '1.5rem' }}>
        {skeletonIds.map((id) => (
          <MotionDiv
            key={id}
            initial={{ opacity: 0.56 }}
            animate={prefersReducedMotion ? { opacity: 0.62 } : { opacity: [0.52, 0.8, 0.52] }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
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
            <div style={{ height: '130px', background: 'linear-gradient(110deg, rgba(99,179,237,0.08), rgba(255,255,255,0.11), rgba(99,179,237,0.08))' }} />
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ width: '50%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.13)' }} />
              <div style={{ width: '78%', height: '16px', borderRadius: '999px', background: 'rgba(255,255,255,0.11)' }} />
              <div style={{ width: '64%', height: '16px', borderRadius: '999px', background: 'rgba(255,255,255,0.09)' }} />
              <div style={{ width: '88%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ marginTop: '0.45rem', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.45rem' }}>
                <div style={{ height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(99,179,237,0.18)' }} />
                <div style={{ height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.11)' }} />
                <div style={{ width: '42px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.09)' }} />
              </div>
            </div>
          </MotionDiv>
        ))}
      </div>
    </div>
  );
}

export default function Discover() {
  const [publicDecks, setPublicDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCompact, setIsCompact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 900 : false));
  const [activeCategoryKeys, setActiveCategoryKeys] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);
  const [copiedDeckId, setCopiedDeckId] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [previewDeck, setPreviewDeck] = useState(null); // deck object for overlay
  const [visibleDeckCount, setVisibleDeckCount] = useState(18);
  const [globalUserMatches, setGlobalUserMatches] = useState([]);
  const [indexedDecks, setIndexedDecks] = useState([]);
  const [rankedDeckRows, setRankedDeckRows] = useState([]);
  const loadMoreRef = useRef(null);

  const { saveToCopy, decks } = useDeck();
  const { token } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [canHoverPointer, setCanHoverPointer] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });
  const savedSourceDeckIds = useMemo(() => {
    const ids = decks
      .map((deck) => String(deck?.sourceDeckId || '').trim())
      .filter(Boolean);
    return new Set(ids);
  }, [decks]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const isDeckAlreadySaved = useCallback((deckId) => {
    const id = String(deckId || '').trim();
    if (!id) return false;
    return savedIds.has(id) || savedSourceDeckIds.has(id);
  }, [savedIds, savedSourceDeckIds]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updatePointerCapability = () => setCanHoverPointer(query.matches);

    updatePointerCapability();

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', updatePointerCapability);
      return () => query.removeEventListener('change', updatePointerCapability);
    }

    query.addListener(updatePointerCapability);
    return () => query.removeListener(updatePointerCapability);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getDeckShareLink = (deck) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const username = deck?.publishedBy?.username;
    if (!origin || !username || !deck?.id) return '';
    return `${origin}/deck/${username}/${deck.id}`;
  };

  const handleCopyDeckLink = async (deck) => {
    const link = getDeckShareLink(deck);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedDeckId(deck.id);
      showToast('Share link copied!');
      setTimeout(() => setCopiedDeckId(null), 1200);
    } catch {
      showToast('Could not copy link.', 'error');
    }
  };

  const fetchDiscover = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/discover`);
      const data = await res.json();
      if (Array.isArray(data)) setPublicDecks(data);
    } catch {
      setError('Failed to load the discovery feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDiscover(); }, [fetchDiscover]);

  useEffect(() => {
    let rafId = null;
    const onResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setIsCompact(window.innerWidth < 900);
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const commitRows = () => {
      const rows = buildIndexedDeckRows(publicDecks);
      if (!isCancelled) {
        setIndexedDecks(rows);
      }
    };

    if (publicDecks.length >= DISCOVER_IDLE_INDEX_THRESHOLD) {
      const handle = scheduleIdleTask(commitRows);
      return () => {
        isCancelled = true;
        cancelScheduledIdleTask(handle);
      };
    }

    commitRows();
    return () => {
      isCancelled = true;
    };
  }, [publicDecks]);

  const categories = useMemo(() => {
    const categoryCounts = new Map();

    for (const row of indexedDecks) {
      for (const category of row.categories) {
        const existing = categoryCounts.get(category.key);
        if (existing) {
          existing.count += 1;
          continue;
        }
        categoryCounts.set(category.key, {
          key: category.key,
          label: category.label,
          count: 1,
        });
      }
    }

    return Array.from(categoryCounts.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 24);
  }, [indexedDecks]);

  const activeCategorySet = useMemo(() => new Set(activeCategoryKeys), [activeCategoryKeys]);

  const toggleCategory = useCallback((categoryKey) => {
    setActiveCategoryKeys((previous) => {
      if (previous.includes(categoryKey)) {
        return previous.filter((key) => key !== categoryKey);
      }
      return [...previous, categoryKey];
    });
  }, []);

  const handleOpenProfile = useCallback((username) => {
    if (!username) return;
    navigate(`/u/${username}`);
  }, [navigate]);

  useEffect(() => {
    if (normalizedSearchQuery.length < 2) {
      setGlobalUserMatches([]);
      return;
    }

    const controller = new AbortController();
    const debounceTimer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${BASE_URL}/users/search?q=${encodeURIComponent(normalizedSearchQuery)}&limit=8`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setGlobalUserMatches([]);
          return;
        }

        const payload = await response.json();
        setGlobalUserMatches(Array.isArray(payload) ? payload : []);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setGlobalUserMatches([]);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [normalizedSearchQuery]);

  const deckMatchedUsers = useMemo(() => {
    if (!normalizedSearchQuery) return [];

    const usersByKey = new Map();

    for (const deck of publicDecks) {
      const author = deck?.publishedBy;
      if (!author) continue;

      const name = String(author.name || '').trim();
      const username = String(author.username || '').trim();
      const userId = String(author.userId || '').trim();
      const picture = author.picture || '';

      const matchesAuthor =
        name.toLowerCase().includes(normalizedSearchQuery) ||
        username.toLowerCase().includes(normalizedSearchQuery) ||
        userId.toLowerCase().includes(normalizedSearchQuery);

      if (!matchesAuthor) continue;

      const key = userId || username || name;
      if (!key) continue;

      const existing = usersByKey.get(key);
      if (existing) {
        existing.deckCount += 1;
        continue;
      }

      usersByKey.set(key, {
        name,
        username,
        userId,
        picture,
        deckCount: 1,
      });
    }

    return Array.from(usersByKey.values())
      .sort((a, b) => b.deckCount - a.deckCount || (a.name || '').localeCompare(b.name || ''))
      .slice(0, 8);
  }, [publicDecks, normalizedSearchQuery]);

  const mergedMatchedUsers = useMemo(() => {
    const userMap = new Map();
    const addOrMergeUser = (user) => {
      const key = user.userId || user.username || user.name;
      if (!key) return;

      const existing = userMap.get(key);
      if (!existing) {
        userMap.set(key, {
          name: user.name || '',
          username: user.username || '',
          userId: user.userId || '',
          picture: user.picture || '',
          deckCount: Number(user.deckCount || 0),
        });
        return;
      }

      existing.name = existing.name || user.name || '';
      existing.username = existing.username || user.username || '';
      existing.userId = existing.userId || user.userId || '';
      existing.picture = existing.picture || user.picture || '';
      existing.deckCount = Math.max(Number(existing.deckCount || 0), Number(user.deckCount || 0));
    };

    globalUserMatches.forEach(addOrMergeUser);
    deckMatchedUsers.forEach(addOrMergeUser);

    return Array.from(userMap.values())
      .sort((a, b) => b.deckCount - a.deckCount || (a.name || '').localeCompare(b.name || ''))
      .slice(0, 8);
  }, [globalUserMatches, deckMatchedUsers]);

  const handleSave = async (deckId) => {
    const normalizedDeckId = String(deckId || '').trim();

    if (!normalizedDeckId) {
      showToast('Deck ID unavailable.', 'error');
      return;
    }

    if (!token) { showToast('Sign in to save decks.', 'error'); return; }
    if (savingId) return;
    setSavingId(normalizedDeckId);
    try {
      await saveToCopy(normalizedDeckId);
      setSavedIds((prev) => new Set([...prev, normalizedDeckId]));
      setPublicDecks((prev) => prev.map((d) => String(d.id) === normalizedDeckId ? { ...d, saves: (d.saves || 0) + 1 } : d));
      showToast('Deck saved to your library!');
    } catch (err) {
      showToast(err.message || 'Could not save deck.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const commitRankedRows = () => {
      const rows = buildRankedDeckRows(indexedDecks, normalizedSearchQuery, activeCategoryKeys);
      if (!isCancelled) {
        setRankedDeckRows(rows);
      }
    };

    if (indexedDecks.length >= DISCOVER_IDLE_RANK_THRESHOLD) {
      const handle = scheduleIdleTask(commitRankedRows);
      return () => {
        isCancelled = true;
        cancelScheduledIdleTask(handle);
      };
    }

    commitRankedRows();
    return () => {
      isCancelled = true;
    };
  }, [indexedDecks, normalizedSearchQuery, activeCategoryKeys]);

  const rankedDecks = useMemo(() => rankedDeckRows.map((row) => row.deck), [rankedDeckRows]);

  const sectionDeckLimit = isCompact ? 3 : 5;

  const { trendingDecks, freshDecks } = useMemo(() => {
    const trendingRows = [...rankedDeckRows]
      .sort((a, b) => b.trendingScore - a.trendingScore || b.saves - a.saves || b.timestamp - a.timestamp)
      .slice(0, sectionDeckLimit);

    const trendingKeys = new Set(
      trendingRows.map((row) => row.deck.id || `${row.deck.title}-${row.order}`)
    );

    const freshPool = [...rankedDeckRows]
      .filter((row) => !trendingKeys.has(row.deck.id || `${row.deck.title}-${row.order}`))
      .sort((a, b) => b.freshScore - a.freshScore || b.timestamp - a.timestamp || b.rankScore - a.rankScore)
      .slice(0, sectionDeckLimit);

    return {
      trendingDecks: trendingRows.map((row) => row.deck),
      freshDecks: freshPool.map((row) => row.deck),
    };
  }, [rankedDeckRows, sectionDeckLimit]);

  const discoverBatchSize = isCompact ? 6 : 10;

  const visibleDecks = useMemo(() => {
    return rankedDecks.slice(0, visibleDeckCount);
  }, [rankedDecks, visibleDeckCount]);

  const discoverTitleMetrics = useMemo(() => {
    const metricsByDeck = new Map();
    const titleWidth = isCompact ? 172 : 252;

    for (const deck of visibleDecks) {
      const metricKey = deck.id || deck.title;
      if (!metricKey) continue;

      metricsByDeck.set(
        metricKey,
        measureTextBlock(deck.title, {
          font: DISCOVER_TITLE_FONT,
          maxWidth: titleWidth,
          lineHeight: DISCOVER_TITLE_LINE_HEIGHT,
          maxLines: DISCOVER_TITLE_MAX_LINES,
        })
      );
    }

    return metricsByDeck;
  }, [visibleDecks, isCompact]);

  const hasMoreDecks = visibleDeckCount < rankedDecks.length;
  const activeCategorySignature = activeCategoryKeys.join('|');

  useEffect(() => {
    setVisibleDeckCount(isCompact ? 10 : 16);
  }, [isCompact, normalizedSearchQuery, activeCategorySignature, rankedDecks.length]);

  useEffect(() => {
    if (!hasMoreDecks) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleDeckCount((count) => Math.min(count + discoverBatchSize, rankedDecks.length));
      },
      { root: null, rootMargin: '320px 0px', threshold: 0.01 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreDecks, discoverBatchSize, rankedDecks.length]);

  return (
    <div className="discover-root-shell" style={{ padding: isCompact ? '0.9rem 1rem 3rem' : '0.9rem 3rem 4rem', width: '100%', maxWidth: '1200px', margin: '0 auto', color: 'white' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'stretch' : 'flex-end', flexDirection: isCompact ? 'column' : 'row', gap: isCompact ? '0.9rem' : 0, marginBottom: '2.5rem', marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 className="title-sparkle-effect" style={{ fontFamily: 'var(--font-display)', fontSize: isCompact ? '2rem' : '2.4rem', margin: 0, background: 'linear-gradient(180deg, #fff 0%, #9ca3af 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Globe size={isCompact ? 24 : 28} color="rgba(147,197,253,0.95)" style={{ filter: 'drop-shadow(0 0 10px rgba(147,197,253,0.5))' }} />
            Discover
          </h2>
          <p style={{ color: 'var(--secondary)', margin: '0.4rem 0 0 0', fontWeight: 500, fontSize: '1rem' }}>Explore cognitive payloads synthesized by the community.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-full)', padding: '0.6rem 1.1rem', width: isCompact ? '100%' : 'auto', boxSizing: 'border-box' }}>
          <Search size={15} color="var(--secondary)" />
          <input aria-label="Search public decks and users" type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search decks, user name, @username, or user ID..." style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: isCompact ? '100%' : '240px', minWidth: 0 }} />
          {searchQuery && <button aria-label="Clear search" title="Clear search" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>}
        </div>
      </div>

      {normalizedSearchQuery && mergedMatchedUsers.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: 'rgba(255,255,255,0.62)', fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Matching users
          </p>
          <div className="app-content-visibility-list" style={{ display: 'grid', gap: '0.55rem', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
            {mergedMatchedUsers.map((user) => {
              const key = user.userId || user.username || user.name;
              return <UserSearchResultCard key={key} user={user} onOpenProfile={handleOpenProfile} />;
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveCategoryKeys([])}
          style={{
            padding: '0.42rem 0.7rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255,255,255,0.12)',
            background: activeCategoryKeys.length === 0 ? 'rgba(147,197,253,0.14)' : 'transparent',
            color: activeCategoryKeys.length === 0 ? '#dbeafe' : 'var(--secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.38rem',
          }}
        >
          All
          <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{indexedDecks.length}</span>
        </button>

        {categories.map((category) => {
          const active = activeCategorySet.has(category.key);
          return (
            <button
              key={category.key}
              onClick={() => toggleCategory(category.key)}
              style={{
                padding: '0.42rem 0.7rem',
                borderRadius: 'var(--radius-full)',
                border: `1px solid ${active ? 'rgba(147,197,253,0.45)' : 'rgba(255,255,255,0.12)'}`,
                background: active ? 'rgba(147,197,253,0.14)' : 'transparent',
                color: active ? '#dbeafe' : 'var(--secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.74rem',
                fontWeight: active ? 700 : 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'background-color 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out',
              }}
            >
              {category.label}
              {!isCompact && <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{category.count}</span>}
            </button>
          );
        })}

        {activeCategoryKeys.length > 0 && (
          <button
            onClick={() => setActiveCategoryKeys([])}
            style={{
              padding: '0.42rem 0.72rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(248,113,113,0.45)',
              background: 'rgba(248,113,113,0.08)',
              color: '#fca5a5',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '0.74rem',
              fontWeight: 700,
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {!loading && !error && rankedDecks.length > 0 && (
        <div className="app-content-visibility-section" style={{ marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isCompact ? '0.65rem' : '0.8rem' }}>
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.03)', padding: isCompact ? '0.7rem' : '0.85rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'white', letterSpacing: '-0.01em' }}>Trending Now</h3>
            </div>
            <div style={{ display: 'grid', gap: '0.42rem' }}>
              {trendingDecks.map((deck, idx) => {
                const rowKey = deck.id || `${deck.title || 'deck'}-trend-${idx}`;
                const isSaved = isDeckAlreadySaved(deck.id);
                return (
                  <div key={rowKey} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', borderRadius: '0.62rem', padding: '0.38rem 0.42rem' }}>
                    <button onClick={() => setPreviewDeck(deck)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: 'white', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.79rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {deck.title || 'Untitled deck'}
                    </button>
                    <button aria-label={`Preview ${deck.title || 'deck'}`} title="Preview deck" onClick={() => setPreviewDeck(deck)} style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: 'var(--secondary)', borderRadius: '0.5rem', padding: '0.3rem', display: 'flex', cursor: 'pointer' }}>
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => handleSave(deck.id)}
                      aria-label={`Save ${deck.title || 'deck'}`}
                      title="Save deck"
                      disabled={!deck.id || isSaved || savingId === deck.id}
                      style={{ border: `1px solid ${isSaved ? 'rgba(34,197,94,0.35)' : 'rgba(99,179,237,0.35)'}`, background: isSaved ? 'rgba(34,197,94,0.1)' : 'rgba(99,179,237,0.1)', color: isSaved ? '#4ade80' : '#63b3ed', borderRadius: '0.5rem', padding: '0.3rem', display: 'flex', cursor: (!deck.id || isSaved) ? 'default' : 'pointer', opacity: savingId === deck.id ? 0.65 : 1 }}
                    >
                      {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.03)', padding: isCompact ? '0.7rem' : '0.85rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'white', letterSpacing: '-0.01em' }}>Fresh Picks</h3>
            </div>
            <div style={{ display: 'grid', gap: '0.42rem' }}>
              {freshDecks.map((deck, idx) => {
                const rowKey = deck.id || `${deck.title || 'deck'}-fresh-${idx}`;
                const isSaved = isDeckAlreadySaved(deck.id);
                return (
                  <div key={rowKey} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', borderRadius: '0.62rem', padding: '0.38rem 0.42rem' }}>
                    <button onClick={() => setPreviewDeck(deck)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: 'white', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.79rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {deck.title || 'Untitled deck'}
                    </button>
                    <button aria-label={`Preview ${deck.title || 'deck'}`} title="Preview deck" onClick={() => setPreviewDeck(deck)} style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: 'var(--secondary)', borderRadius: '0.5rem', padding: '0.3rem', display: 'flex', cursor: 'pointer' }}>
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => handleSave(deck.id)}
                      aria-label={`Save ${deck.title || 'deck'}`}
                      title="Save deck"
                      disabled={!deck.id || isSaved || savingId === deck.id}
                      style={{ border: `1px solid ${isSaved ? 'rgba(34,197,94,0.35)' : 'rgba(99,179,237,0.35)'}`, background: isSaved ? 'rgba(34,197,94,0.1)' : 'rgba(99,179,237,0.1)', color: isSaved ? '#4ade80' : '#63b3ed', borderRadius: '0.5rem', padding: '0.3rem', display: 'flex', cursor: (!deck.id || isSaved) ? 'default' : 'pointer', opacity: savingId === deck.id ? 0.65 : 1 }}
                    >
                      {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <DiscoverDeckSkeletonGrid isCompact={isCompact} prefersReducedMotion={prefersReducedMotion} />
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#f87171', fontFamily: 'var(--font-body)' }}>⚠️ {error}</div>
      ) : rankedDecks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isCompact ? '2.5rem 1.25rem' : '5rem', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-xl)', background: 'var(--glass-surface)' }}>
          <Globe size={48} color="var(--secondary)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            {searchQuery ? `No decks match "${searchQuery}"` : 'No decks have been shared yet. Be the first!'}
          </p>
        </div>
      ) : (
        <motion.div className="app-content-visibility-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isCompact ? 220 : 300}px, 1fr))`, gap: isCompact ? '1rem' : '1.5rem' }}>
          <AnimatePresence initial={false}>
            {visibleDecks.map((deck, i) => {
              const deckKey = deck.id || `${deck.title || 'deck'}-${i}`;
              const titleMetricKey = deck.id || deck.title;
              const titleMetrics = titleMetricKey
                ? discoverTitleMetrics.get(titleMetricKey)
                : null;
              const isSaved = isDeckAlreadySaved(deck.id);
              const cardTotal = deck.cards?.length || 0;
              const canShareDeck = Boolean(getDeckShareLink(deck));

              return (
                <motion.div
                  key={deckKey}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: EASE_OUT_CURVE }}
                  whileHover={!isCompact && canHoverPointer && !prefersReducedMotion ? { scale: 1.01 } : undefined}
                  style={{ background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
                >
                  {/* Thumbnail */}
                  {deck.thumbnail ? (
                    <div style={{ width: '100%', height: '130px', overflow: 'hidden' }}>
                      <img loading="lazy" decoding="async" sizes="(max-width: 900px) 45vw, 300px" src={deck.thumbnail} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '130px', background: 'linear-gradient(135deg, rgba(99,179,237,0.08) 0%, rgba(0,0,0,0) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Globe size={36} color="rgba(99,179,237,0.25)" />
                    </div>
                  )}

                  {/* Save badge */}
                  <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontFamily: 'var(--font-body)', fontWeight: 700, color: deck.saves > 0 ? '#63b3ed' : 'var(--secondary)', border: '1px solid rgba(99,179,237,0.2)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Bookmark size={10} /> {deck.saves || 0}
                  </div>

                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.7rem' }}>
                    {deck.publishedBy?.name && <AuthorChip name={deck.publishedBy.name} username={deck.publishedBy.username} picture={deck.publishedBy.picture} userId={deck.publishedBy.userId} onClick={() => { if (deck.publishedBy?.username) navigate(`/u/${deck.publishedBy.username}`); }} />}
                    <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.2rem', lineHeight: 1.25, letterSpacing: '-0.02em', display: '-webkit-box', WebkitLineClamp: DISCOVER_TITLE_MAX_LINES, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: `${titleMetrics?.height || DISCOVER_TITLE_LINE_HEIGHT}px` }}>{deck.title}</h4>

                    {deck.labels?.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {deck.labels.map((lbl, idx) => (
                          <span key={idx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>
                      <Layers size={13} /> {cardTotal} {cardTotal === 1 ? 'node' : 'nodes'}
                    </div>

                    {/* Action buttons */}
                    <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.45rem' }}>
                      <button
                        onClick={() => handleSave(deck.id)}
                        disabled={!deck.id || isSaved || savingId === deck.id}
                        style={{ flex: 1, padding: '0.65rem', background: isSaved ? 'rgba(34,197,94,0.1)' : 'rgba(99,179,237,0.1)', border: `1px solid ${isSaved ? 'rgba(34,197,94,0.35)' : 'rgba(99,179,237,0.35)'}`, color: isSaved ? '#4ade80' : '#63b3ed', borderRadius: 'var(--radius-sm)', cursor: isSaved ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, fontFamily: 'var(--font-body)', fontSize: '0.82rem', transition: 'background-color 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out, opacity 200ms ease-out', opacity: savingId === deck.id ? 0.6 : 1 }}
                      >
                        {isSaved ? <><BookmarkCheck size={14} /> Saved</> : savingId === deck.id ? <>Saving…</> : <><Bookmark size={14} /> Save</>}
                      </button>

                      <button
                        onClick={() => setPreviewDeck(deck)}
                        title="Preview deck"
                        style={{ padding: '0.65rem 0.7rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8rem' }}
                      >
                        <Eye size={14} /> Preview
                      </button>

                      <button
                        onClick={() => handleCopyDeckLink(deck)}
                        aria-label={canShareDeck ? `Copy share URL for ${deck.title || 'deck'}` : 'Share URL unavailable'}
                        title={canShareDeck ? 'Copy share URL' : 'Share URL unavailable'}
                        disabled={!canShareDeck}
                        style={{ padding: '0.65rem 0.58rem', background: copiedDeckId === deck.id ? 'rgba(34,197,94,0.12)' : 'transparent', border: `1px solid ${copiedDeckId === deck.id ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.12)'}`, color: copiedDeckId === deck.id ? '#4ade80' : (canShareDeck ? 'var(--secondary)' : 'rgba(255,255,255,0.3)'), borderRadius: 'var(--radius-sm)', cursor: canShareDeck ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {copiedDeckId === deck.id ? <Check size={14} /> : <Link2 size={14} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {hasMoreDecks && <div ref={loadMoreRef} style={{ height: 1 }} />}

      {/* Preview Overlay */}
      <AnimatePresence>
        {previewDeck && (
          <DeckPreviewOverlay
            deck={previewDeck}
            onClose={() => setPreviewDeck(null)}
            onSave={() => handleSave(previewDeck.id)}
            isSaved={isDeckAlreadySaved(previewDeck.id)}
            isSaving={savingId === previewDeck.id}
            canSave={Boolean(previewDeck?.id)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{ position: 'fixed', bottom: isCompact ? '1rem' : '2rem', right: isCompact ? '1rem' : '2rem', left: isCompact ? '1rem' : 'auto', background: toast.type === 'error' ? 'rgba(239,68,68,0.9)' : 'rgba(20,20,20,0.95)', border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`, color: 'white', padding: '0.9rem 1.5rem', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontWeight: 600, backdropFilter: 'blur(8px)', zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

