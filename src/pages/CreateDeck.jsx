import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Save, Trash2, Bold, Italic, Code, Strikethrough, Heading2, Link, List, Quote, Image, Copy, Wand2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useNavigate, useParams } from 'react-router-dom';
import { useDeck } from '../context/DeckContext';
import { useAuth } from '../context/AuthContext';
import { measureTextBlock } from '../services/textMetrics';
import AuthoringToast from '../components/AuthoringToast';
import './CreateDeck.css';

const CREATE_TEXTAREA_FONT = '400 16px Geist';
const CREATE_TEXTAREA_LINE_HEIGHT = 27.2;
const CREATE_TEXTAREA_HORIZONTAL_PADDING = 48;
const CREATE_TEXTAREA_VERTICAL_PADDING = 48;
const CREATE_TEXTAREA_MIN_HEIGHT = 120;
const TOAST_DURATION_MS = 2800;
const TAG_SUGGESTIONS_LIST_ID = 'create-deck-tag-suggestions';
const MOTION_EASE_OUT = [0.23, 1, 0.32, 1];

const MD_TOOLS = [
  { icon: Bold,          label: 'Bold',         prefix: '**', suffix: '**',  placeholder: 'bold text' },
  { icon: Italic,        label: 'Italic',       prefix: '_',  suffix: '_',   placeholder: 'italic text' },
  { icon: Strikethrough, label: 'Strikethrough',prefix: '~~', suffix: '~~',  placeholder: 'strikethrough' },
  { icon: Code,          label: 'Inline Code',  prefix: '`',  suffix: '`',   placeholder: 'code' },
  { divider: true },
  { icon: Heading2,      label: 'Heading',      prefix: '## ', suffix: '',   placeholder: 'Heading' },
  { icon: List,          label: 'List',         prefix: '- ', suffix: '',    placeholder: 'List item' },
  { icon: Quote,         label: 'Blockquote',   prefix: '> ', suffix: '',    placeholder: 'quotation' },
  { divider: true },
  { icon: Code, label: 'Code Block', block: true },
  { icon: Link,          label: 'Link',         prefix: '[',  suffix: '](url)', placeholder: 'link text' },
  { icon: Image,         label: 'Image',        prefix: '![', suffix: '](image-url)', placeholder: 'alt text' },
];

const createCardId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyCard = () => ({
  id: createCardId(),
  front: '',
  back: ''
});

const normalizeIncomingCard = (card = {}, index = 0) => ({
  ...card,
  id: card.id || `${createCardId()}-${index}`,
  front: String(card.front || ''),
  back: String(card.back || ''),
  lastOpened: card.lastOpened || null,
  nextReview: card.nextReview || null,
  interval: card.interval || 0,
  repetition: card.repetition || 0,
  easeFactor: card.easeFactor || 2.5,
});

const buildInitialSuggestions = (query, tags = []) => {
  const parts = String(query || '').split(',');
  const currentPart = parts[parts.length - 1].trim().toLowerCase();
  if (!currentPart) return [];

  const existingSelections = new Set(parts.map((part) => part.trim().toLowerCase()));
  return tags.filter((tag) => {
    const lowerTag = tag.toLowerCase();
    return lowerTag.includes(currentPart) && !existingSelections.has(lowerTag);
  });
};

function MarkdownToolbar({ textareaRef, onUpdate, value, onAutoResize }) {
  const insertMarkdown = useCallback((tool) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);

    let insertion;
    if (tool.block) {
      insertion = `\n\`\`\`\n${selected || 'code here'}\n\`\`\`\n`;
    } else {
      const text = selected || tool.placeholder || '';
      insertion = `${tool.prefix}${text}${tool.suffix}`;
    }

    const newValue = value.substring(0, start) + insertion + value.substring(end);
    onUpdate(newValue);

    // Restore focus and cursor after state update
    setTimeout(() => {
      if (!ta.isConnected) return;
      ta.focus();
      const cursorPos = tool.block
        ? start + 5
        : start + tool.prefix.length + (selected || tool.placeholder || '').length;
      ta.setSelectionRange(cursorPos, cursorPos);
      onAutoResize?.(ta, newValue);
    }, 0);
  }, [textareaRef, value, onUpdate, onAutoResize]);

  return (
    <div className="md-toolbar">
      {MD_TOOLS.map((tool, i) =>
        tool.divider
          ? <span key={i} className="md-divider" />
          : <button
              key={i}
              type="button"
              className="md-btn"
              title={tool.label}
              aria-label={tool.label}
              onClick={() => insertMarkdown(tool)}
            >
              <tool.icon size={13} />
            </button>
      )}
    </div>
  );
}

const CardEditorBlock = React.memo(function CardEditorBlock({
  card,
  index,
  cardsLength,
  frontRef,
  backRef,
  onUpdate,
  onAutoResize,
  onRemove,
  onFocus,
  showPreview,
  isFocused,
  onTogglePreview,
  shouldReduceMotion,
}) {
  const nodeNumberLabel = String(index + 1).padStart(2, '0');
  const cardInitial = shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 };
  const cardExit = shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  const cardTransition = shouldReduceMotion
    ? { duration: 0.12 }
    : { duration: 0.2, ease: MOTION_EASE_OUT };

  return (
    <motion.div
      key={card.id}
      className={`card-input-block${isFocused ? ' is-focused' : ''}`}
      initial={cardInitial}
      animate={{ opacity: 1, scale: 1 }}
      exit={cardExit}
      transition={cardTransition}
      onClick={() => onFocus(card.id)}
    >
      <div className="card-input-header">
        <div className="node-id">
          <span className="node-num">{nodeNumberLabel}</span>
          <span className="node-label">Cognitive Node</span>
        </div>

        <div className="card-header-actions">
          {isFocused ? (
            <span className="card-focus-chip">Focused Live Preview</span>
          ) : (
            <button
              type="button"
              className="btn-preview-toggle"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePreview(card.id);
              }}
              aria-expanded={showPreview}
              aria-label={showPreview ? 'Collapse live preview' : 'Expand live preview'}
            >
              {showPreview ? 'Collapse Preview' : 'Expand Preview'}
            </button>
          )}

          {cardsLength > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(card.id);
              }}
              className="btn-remove"
              title="Delete Node"
              aria-label="Delete node"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="node-editor-grid">
        <div className="editor-pane">
          <div className="pane-header">
            <label>Concept</label>
            <span className="pane-mode">Markdown Enabled</span>
          </div>
          <MarkdownToolbar
            textareaRef={frontRef}
            value={card.front}
            onUpdate={(val) => onUpdate(card.id, 'front', val)}
            onAutoResize={onAutoResize}
          />
          <div className="pane-content">
            <textarea
              ref={frontRef}
              placeholder="Enter specific cue or query..."
              value={card.front}
              onChange={(event) => {
                onUpdate(card.id, 'front', event.target.value);
                onAutoResize(event.currentTarget, event.target.value);
              }}
              onFocus={(event) => {
                onFocus(card.id);
                onAutoResize(event.currentTarget, event.currentTarget.value);
              }}
              className="live-editor-textarea"
            />
            {showPreview && (
              <div className="live-preview-mini">
                <div className="preview-label">Live Render</div>
                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                  {card.front || '_Concept Preview_'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        <div className="editor-pane accent-pane">
          <div className="pane-header">
            <label>Synthesis</label>
            <span className="pane-mode">Neural Logic</span>
          </div>
          <MarkdownToolbar
            textareaRef={backRef}
            value={card.back}
            onUpdate={(val) => onUpdate(card.id, 'back', val)}
            onAutoResize={onAutoResize}
          />
          <div className="pane-content">
            <textarea
              ref={backRef}
              placeholder="Enter target logic or explanation..."
              value={card.back}
              onChange={(event) => {
                onUpdate(card.id, 'back', event.target.value);
                onAutoResize(event.currentTarget, event.target.value);
              }}
              onFocus={(event) => {
                onFocus(card.id);
                onAutoResize(event.currentTarget, event.currentTarget.value);
              }}
              className="live-editor-textarea"
            />
            {showPreview && (
              <div className="live-preview-mini">
                <div className="preview-label">Live Render</div>
                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                  {card.back || '_Synthesis Preview_'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default function CreateDeck() {
  const LAST_DRAFT_STORAGE_KEY = 'aiFlashcards:lastAIDraftDeck';
  const { deckId } = useParams();
  const [title, setTitle] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [labels, setLabels] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [discoverMetadata, setDiscoverMetadata] = useState({ topic: '', level: '', language: '' });
  const [cards, setCards] = useState(() => [createEmptyCard()]);
  const [activeCardId, setActiveCardId] = useState(null);
  const [expandedPreviewByCardId, setExpandedPreviewByCardId] = useState({});
  const { decks, addDeck, updateDeck } = useDeck();
  const [allTags, setAllTags] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [copyLabel, setCopyLabel] = useState('Copy URL');
  const [errors, setErrors] = useState({ title: '', cards: '' });
  const [toast, setToast] = useState(null);
  const frontRefs = useRef(new Map());
  const backRefs = useRef(new Map());
  const cardsBuilderRef = useRef(null);
  const cardsRef = useRef(cards);
  const syncFrameRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const tagsInputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ msg, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  const computeTextareaHeight = useCallback((text, textareaWidth) => {
    const safeWidth = Math.max(110, Number(textareaWidth || 0));
    const contentWidth = Math.max(80, safeWidth - CREATE_TEXTAREA_HORIZONTAL_PADDING);
    const measured = measureTextBlock(text, {
      font: CREATE_TEXTAREA_FONT,
      maxWidth: contentWidth,
      lineHeight: CREATE_TEXTAREA_LINE_HEIGHT,
      whiteSpace: 'pre-wrap',
    });

    return Math.max(
      CREATE_TEXTAREA_MIN_HEIGHT,
      Math.ceil(measured.height + CREATE_TEXTAREA_VERTICAL_PADDING)
    );
  }, []);

  const autoResizeTextarea = useCallback((textareaEl, textValue) => {
    if (!textareaEl) return;

    const nextHeight = computeTextareaHeight(textValue, textareaEl.clientWidth || textareaEl.offsetWidth || 0);
    textareaEl.style.height = `${nextHeight}px`;
    textareaEl.dataset.pretextHeight = String(nextHeight);
    textareaEl.dataset.pretextText = String(textValue || '');
    textareaEl.dataset.pretextWidth = String(Math.round(textareaEl.clientWidth || textareaEl.offsetWidth || 0));
  }, [computeTextareaHeight]);

  const getCardTextareaRef = useCallback((side, cardId) => {
    const refStore = side === 'front' ? frontRefs.current : backRefs.current;
    if (!refStore.has(cardId)) {
      refStore.set(cardId, React.createRef());
    }
    return refStore.get(cardId);
  }, []);

  const syncAllVisibleTextareas = useCallback(() => {
    const currentCards = cardsRef.current;
    for (const card of currentCards) {
      const frontRef = getCardTextareaRef('front', card.id);
      const backRef = getCardTextareaRef('back', card.id);
      const frontEl = frontRef?.current;
      const backEl = backRef?.current;

      if (frontEl) {
        const width = Math.round(frontEl.clientWidth || frontEl.offsetWidth || 0);
        if (frontEl.dataset.pretextText !== String(card.front || '') || frontEl.dataset.pretextWidth !== String(width)) {
          autoResizeTextarea(frontEl, card.front || '');
        }
      }

      if (backEl) {
        const width = Math.round(backEl.clientWidth || backEl.offsetWidth || 0);
        if (backEl.dataset.pretextText !== String(card.back || '') || backEl.dataset.pretextWidth !== String(width)) {
          autoResizeTextarea(backEl, card.back || '');
        }
      }
    }
  }, [getCardTextareaRef, autoResizeTextarea]);

  const scheduleSyncAllTextareas = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (syncFrameRef.current !== null) {
      window.cancelAnimationFrame(syncFrameRef.current);
    }
    syncFrameRef.current = window.requestAnimationFrame(() => {
      syncFrameRef.current = null;
      syncAllVisibleTextareas();
    });
  }, [syncAllVisibleTextareas]);

  const deferTextareaSync = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      scheduleSyncAllTextareas();
    });
  }, [scheduleSyncAllTextareas]);

  const shareLink = (() => {
    if (!deckId || !isPublic) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const username = user?.username;
    if (origin && username) return `${origin}/deck/${username}/${deckId}`;
    if (origin) return `${origin}/decks`;
    return '';
  })();

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    scheduleSyncAllTextareas();
  }, [cards.length, scheduleSyncAllTextareas]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onResize = () => {
      scheduleSyncAllTextareas();
    };

    window.addEventListener('resize', onResize, { passive: true });

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && cardsBuilderRef.current) {
      resizeObserver = new ResizeObserver(() => {
        scheduleSyncAllTextareas();
      });
      resizeObserver.observe(cardsBuilderRef.current);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
        syncFrameRef.current = null;
      }
    };
  }, [scheduleSyncAllTextareas]);

  useEffect(() => {
    if (!cards.length) {
      setActiveCardId(null);
      return;
    }

    const hasActiveCard = cards.some((card) => card.id === activeCardId);
    if (!hasActiveCard) {
      setActiveCardId(cards[0].id);
    }
  }, [cards, activeCardId]);

  useEffect(() => {
    if (!errors.cards) return;
    const hasAnyValidCard = cards.some((card) => card.front.trim() || card.back.trim());
    if (hasAnyValidCard) {
      setErrors((prev) => ({ ...prev, cards: '' }));
    }
  }, [cards, errors.cards]);

  useEffect(() => {
    const ids = new Set(cards.map((card) => card.id));
    setExpandedPreviewByCardId((prev) => {
      let changed = false;
      const next = {};
      for (const [id, isExpanded] of Object.entries(prev)) {
        if (ids.has(id) && isExpanded) {
          next[id] = true;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cards]);

  useEffect(() => {
    // Extract unique tags for autocomplete
    const uniqueTags = [...new Set(decks.flatMap(d => d.labels || []))];
    setAllTags(uniqueTags);

    if (deckId) {
      const existing = decks.find(d => d.id === deckId);
      if (existing) {
        setTitle(existing.title);
        setThumbnail(existing.thumbnail || '');
        setLabels(existing.labels ? existing.labels.join(', ') : '');
        setIsPublic(Boolean(existing.isPublic));
        setIsDiscoverable(Boolean(existing.isDiscoverable));
        setDiscoverMetadata({
          topic: existing?.discoverMetadata?.topic || '',
          level: existing?.discoverMetadata?.level || '',
          language: existing?.discoverMetadata?.language || ''
        });
        const normalizedCards = (existing.cards || []).map((card, index) => normalizeIncomingCard(card, index));
        setCards(normalizedCards.length ? normalizedCards : [createEmptyCard()]);
        setExpandedPreviewByCardId({});
        deferTextareaSync();
      } else {
        navigate('/decks'); // Fallback if data string is corrupted
      }
    }
  }, [deckId, decks, navigate, deferTextareaSync]);

  useEffect(() => {
    const ids = new Set(cards.map((card) => card.id));
    for (const key of frontRefs.current.keys()) {
      if (!ids.has(key)) frontRefs.current.delete(key);
    }
    for (const key of backRefs.current.keys()) {
      if (!ids.has(key)) backRefs.current.delete(key);
    }
  }, [cards]);

  const handleAddCard = useCallback(() => {
    const nextCard = createEmptyCard();
    setCards((prev) => [...prev, nextCard]);
    setActiveCardId(nextCard.id);
  }, []);

  const handleUpdateCard = useCallback((id, field, value) => {
    setCards((prev) => prev.map((card) => (card.id === id ? { ...card, [field]: value } : card)));
  }, []);

  const handleRemoveCard = useCallback((id) => {
    setCards((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((card) => card.id !== id);
    });

    setExpandedPreviewByCardId((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleFocusCard = useCallback((cardId) => {
    setActiveCardId(cardId);
  }, []);

  const handleTogglePreview = useCallback((cardId) => {
    setExpandedPreviewByCardId((prev) => {
      const next = { ...prev };
      if (next[cardId]) {
        delete next[cardId];
      } else {
        next[cardId] = true;
      }
      return next;
    });
  }, []);

  const hideSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  }, []);

  const handleLabelsChange = useCallback((value) => {
    setLabels(value);
    const filtered = buildInitialSuggestions(value, allTags);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setActiveSuggestionIndex(filtered.length > 0 ? 0 : -1);
  }, [allTags]);

  const selectSuggestion = useCallback((suggestion) => {
    setLabels((current) => {
      const parts = current.split(',');
      parts[parts.length - 1] = ` ${suggestion}`;
      return parts.join(',').replace(/\s+,/g, ',').trim();
    });
    hideSuggestions();
    if (tagsInputRef.current?.isConnected) {
      tagsInputRef.current.focus();
    }
  }, [hideSuggestions]);

  const handleSuggestionsKeyDown = useCallback((event) => {
    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter' && showSuggestions && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const chosen = suggestions[activeSuggestionIndex];
      if (chosen) {
        selectSuggestion(chosen);
      }
      return;
    }

    if (event.key === 'Escape') {
      hideSuggestions();
    }
  }, [suggestions, showSuggestions, activeSuggestionIndex, selectSuggestion, hideSuggestions]);

  const handleSuggestionsBlur = useCallback((event) => {
    const nextFocused = event.relatedTarget;
    if (nextFocused && event.currentTarget.contains(nextFocused)) return;
    hideSuggestions();
  }, [hideSuggestions]);

  const handleTitleChange = useCallback((event) => {
    setTitle(event.target.value);
    setErrors((prev) => (prev.title ? { ...prev, title: '' } : prev));
  }, []);

  const handleSave = useCallback((e) => {
    e.preventDefault();

    const nextErrors = { title: '', cards: '' };
    if (!title.trim()) {
      nextErrors.title = 'Please provide a Data Vector Title.';
    }

    const validCards = cards.filter((card) => card.front.trim() || card.back.trim());
    if (validCards.length === 0) {
      nextErrors.cards = 'Please add at least one valid cognitive node.';
    }

    setErrors(nextErrors);

    if (nextErrors.title || nextErrors.cards) {
      showToast('Please fix the highlighted fields before saving.', 'error');
      return;
    }

    const processedDeck = {
      id: deckId || Date.now().toString(),
      title,
      thumbnail,
      labels: labels.split(',').map(l => l.trim()).filter(Boolean),
      isPublic,
      isDiscoverable,
      discoverMetadata: {
        topic: discoverMetadata.topic || '',
        level: discoverMetadata.level || '',
        language: discoverMetadata.language || ''
      },
      cards: validCards.map((c, i) => ({
        ...c,
        id: c.id || Date.now().toString() + i,
        lastOpened: c.lastOpened || null,
        nextReview: c.nextReview || null,
        interval: c.interval || 0,
        repetition: c.repetition || 0,
        easeFactor: c.easeFactor || 2.5
      }))
    };

    if (deckId) {
      updateDeck(deckId, processedDeck);
    } else {
      addDeck(processedDeck);
    }

    navigate(`/decks`);
  }, [title, cards, deckId, thumbnail, labels, isPublic, isDiscoverable, discoverMetadata, updateDeck, addDeck, navigate, showToast]);

  const handleMetadataChange = (field, value) => {
    setDiscoverMetadata(prev => ({ ...prev, [field]: value }));
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyLabel('Copied');
      setTimeout(() => setCopyLabel('Copy URL'), 1200);
    } catch {
      setCopyLabel('Copy failed');
      setTimeout(() => setCopyLabel('Copy URL'), 1200);
    }
  };

  const handleLoadLastDraft = useCallback(() => {
    if (deckId) return;
    try {
      const raw = localStorage.getItem(LAST_DRAFT_STORAGE_KEY);
      if (!raw) {
        showToast('No saved AI draft found yet. Generate one from Dashboard first.', 'error');
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        showToast('Saved draft is invalid or empty.', 'error');
        return;
      }

      setTitle(String(parsed.title || 'Untitled AI Draft'));
      setThumbnail(String(parsed.thumbnail || ''));
      setLabels(Array.isArray(parsed.labels) ? parsed.labels.join(', ') : '');
      setIsPublic(Boolean(parsed.isPublic));
      setIsDiscoverable(Boolean(parsed.isDiscoverable));
      setDiscoverMetadata({
        topic: parsed?.discoverMetadata?.topic || '',
        level: parsed?.discoverMetadata?.level || '',
        language: parsed?.discoverMetadata?.language || ''
      });
      const normalizedCards = parsed.cards.map((card, index) => normalizeIncomingCard(card, index));
      setCards(normalizedCards.length ? normalizedCards : [createEmptyCard()]);
      setExpandedPreviewByCardId({});
      setErrors({ title: '', cards: '' });
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      deferTextareaSync();
      showToast('Loaded your last AI draft.');
    } catch {
      showToast('Could not load the saved draft.', 'error');
    }
  }, [deckId, showToast, deferTextareaSync]);

  const suggestionMotionInitial = shouldReduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: -8, scale: 0.98 };
  const suggestionMotionExit = shouldReduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: -6, scale: 0.98 };
  const suggestionMotionTransition = shouldReduceMotion
    ? { duration: 0.1 }
    : { duration: 0.18, ease: MOTION_EASE_OUT };

  return (
    <div className="create-container">
      <header className="create-header">
        <div>
          <h2 className="create-title title-sparkle-effect">
            <Wand2 size={24} className="page-title-icon" />
            {deckId ? 'Edit Vector' : 'Neural Authoring'}
          </h2>
          <p className="create-subtitle">{deckId ? 'Modify existing logic structures.' : 'Manually synthesize custom cognitive nodes.'}</p>
          {!deckId && (
            <button type="button" className="btn-load-last-draft" onClick={handleLoadLastDraft}>
              Load Last AI Draft
            </button>
          )}
        </div>
        <button type="submit" form="create-deck-form" className="btn-save-primary" aria-label={deckId ? 'Update vector' : 'Save vector'}>
          <Save size={14} strokeWidth={2.2} /> {deckId ? 'Update Vector' : 'Save Vector'}
        </button>
      </header>

      <form id="create-deck-form" className="create-form" onSubmit={handleSave}>
        <div className="form-group title-group">
          <label>Data Vector Title</label>
          <input
            type="text"
            placeholder="e.g. Advanced TypeScript Definitions..."
            value={title}
            onChange={handleTitleChange}
            className="input-title"
            autoFocus
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'create-title-error' : undefined}
          />
          {errors.title && (
            <p id="create-title-error" className="field-error" role="alert">
              {errors.title}
            </p>
          )}
        </div>

        <div className="meta-inputs-grid">
          <div className="form-group title-group title-group-sm">
            <label>Cover Thumbnail (URL)</label>
            <input 
              type="text" 
              placeholder="e.g. https://images.unsplash.com..." 
              value={thumbnail} 
              onChange={e => setThumbnail(e.target.value)} 
              className="input-meta"
            />
          </div>
          <div className="form-group title-group title-group-sm dropdown-container" onBlur={handleSuggestionsBlur}>
            <label>Tags (Comma Separated)</label>
            <input
              ref={tagsInputRef}
              type="text"
              placeholder="e.g. React, Advanced, Frontend"
              value={labels}
              onChange={(event) => handleLabelsChange(event.target.value)}
              onKeyDown={handleSuggestionsKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              className="input-meta"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls={TAG_SUGGESTIONS_LIST_ID}
              aria-activedescendant={
                showSuggestions && activeSuggestionIndex >= 0
                  ? `${TAG_SUGGESTIONS_LIST_ID}-option-${activeSuggestionIndex}`
                  : undefined
              }
            />
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  id={TAG_SUGGESTIONS_LIST_ID}
                  role="listbox"
                  className="suggestions-dropdown"
                  initial={suggestionMotionInitial}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={suggestionMotionExit}
                  transition={suggestionMotionTransition}
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      id={`${TAG_SUGGESTIONS_LIST_ID}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeSuggestionIndex}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSuggestion(suggestion)}
                      className="suggestion-item"
                    >
                      {suggestion}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {deckId && (
          <div style={{ marginTop: '0.6rem', marginBottom: '0.3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
                  {isPublic ? 'Public Deck' : 'Private Deck'}
                </div>
                <div style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                  Manage visibility from edit mode.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPublic(prev => {
                    const next = !prev;
                    if (!next) setIsDiscoverable(false);
                    return next;
                  });
                }}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}
              >
                Switch to {isPublic ? 'Private' : 'Public'}
              </button>
            </div>

            {isPublic && (
              <div style={{ marginTop: '0.8rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.55rem' }}>
                <input
                  type="text"
                  value={discoverMetadata.topic}
                  onChange={(e) => handleMetadataChange('topic', e.target.value)}
                  placeholder="Topic"
                  className="input-meta visibility-meta-input"
                />
                <input
                  type="text"
                  value={discoverMetadata.level}
                  onChange={(e) => handleMetadataChange('level', e.target.value)}
                  placeholder="Level"
                  className="input-meta visibility-meta-input"
                />
                <input
                  type="text"
                  value={discoverMetadata.language}
                  onChange={(e) => handleMetadataChange('language', e.target.value)}
                  placeholder="Language"
                  className="input-meta visibility-meta-input"
                />
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    placeholder="Share URL will appear here"
                    className="input-meta visibility-meta-input"
                    style={{ minWidth: '260px', flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    disabled={!shareLink}
                    style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99,179,237,0.35)', background: 'rgba(99,179,237,0.1)', color: '#93c5fd', cursor: shareLink ? 'pointer' : 'not-allowed', opacity: shareLink ? 1 : 0.5, fontFamily: 'var(--font-body)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Copy size={14} /> {copyLabel}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {errors.cards && (
          <p className="field-error field-error-wide" role="alert">
            {errors.cards}
          </p>
        )}

        <div ref={cardsBuilderRef} className="cards-builder">
          <AnimatePresence>
            {cards.map((card, index) => {
              const frontRef = getCardTextareaRef('front', card.id);
              const backRef = getCardTextareaRef('back', card.id);
              const isFocused = card.id === activeCardId;
              const showPreview = isFocused || Boolean(expandedPreviewByCardId[card.id]);

              return (
                <CardEditorBlock
                  key={card.id}
                  card={card}
                  index={index}
                  cardsLength={cards.length}
                  frontRef={frontRef}
                  backRef={backRef}
                  onUpdate={handleUpdateCard}
                  onAutoResize={autoResizeTextarea}
                  onRemove={handleRemoveCard}
                  onFocus={handleFocusCard}
                  showPreview={showPreview}
                  isFocused={isFocused}
                  onTogglePreview={handleTogglePreview}
                  shouldReduceMotion={shouldReduceMotion}
                />
              );
            })}
          </AnimatePresence>
        </div>

        <button type="button" onClick={handleAddCard} className="btn-add-node" aria-label="Append active node">
          <Plus size={16} /> Append Active Node
        </button>
      </form>

      <AuthoringToast toast={toast} reduceMotion={shouldReduceMotion} />
    </div>
  );
}

