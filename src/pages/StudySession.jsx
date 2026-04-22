import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeck } from '../context/DeckContext';
import { useAuth } from '../context/AuthContext';
import Flashcard from '../components/Flashcard';
import StudyControls from '../components/StudyControls';
import CelestialMeteors from '../components/CelestialMeteors';
import GridBackground from '../components/GridBackground';
import { generateLineQuizzes } from '../services/gemini';
import { isDateKeyOnOrBefore } from '../services/dateKey';
import { 
  Sparkles, ArrowLeft, Timer, TimerOff, RefreshCw, Clock, 
  Zap, Layers, SlidersHorizontal, ChevronLeft, ChevronRight, HelpCircle, Lightbulb, X, Loader2, Ban
} from 'lucide-react';
import '../App.css';

const CARD_TIMER_DURATION = 30; // seconds per card
const SESSION_STATE_KEY_PREFIX = 'studySessionState_';
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function formatSessionTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function StudySession() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { decks, processCardReview } = useDeck();
  const { token } = useAuth();

  const deck = decks.find(d => d.id === deckId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toast, setToast] = useState(null);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [forceAll, setForceAll] = useState(false);
  const [hardRequeuedIds, setHardRequeuedIds] = useState(new Set());
  const [showMeteors, setShowMeteors] = useState(false);
  const [showGeneralSettings, setShowGeneralSettings] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [readAloudTrigger, setReadAloudTrigger] = useState(0);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizItems, setQuizItems] = useState([]);
  const [quizError, setQuizError] = useState('');
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizCurrentIndex, setQuizCurrentIndex] = useState(0);
  const [quizShowAnswer, setQuizShowAnswer] = useState(false);
  const [quizResultMap, setQuizResultMap] = useState({});
  const [quizScore, setQuizScore] = useState({ correct: 0, wrong: 0 });
  const [accessWarning, setAccessWarning] = useState('');
  const quizRequestIdRef = useRef(0);
  const quizCancelledRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  const sessionStateKey = `${SESSION_STATE_KEY_PREFIX}${deckId}`;
  const isCompact = viewportWidth < 1100;
  const isNarrow = viewportWidth < 760;
  const sideControlInset = isNarrow ? 0 : (isCompact ? 132 : 172);

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
    if (deck) {
      setAccessWarning('');
      return;
    }
    if (!deckId || !token) return;

    let cancelled = false;
    fetch(`${BASE_URL}/decks/${deckId}/access`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 403 && data?.status === 'not_owner') {
          setAccessWarning('This deck is not in your library. Only the owner can open it in Study mode. Use a shared /deck/... link to preview public decks.');
          return;
        }

        if (res.status === 404) {
          setAccessWarning('Deck not found. It may have been deleted or the URL is invalid.');
          return;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccessWarning('Unable to verify deck access right now. Please retry.');
        }
      });

    return () => { cancelled = true; };
  }, [deck, deckId, token]);

  // Font Size Settings (REM based)
  const [frontFontSize, setFrontFontSize] = useState(() => 
    parseFloat(localStorage.getItem(`frontFont_${deckId}`)) || 1.8
  );
  const [backFontSize, setBackFontSize] = useState(() => 
    parseFloat(localStorage.getItem(`backFont_${deckId}`)) || 1.05
  );
  const [speechRate, setSpeechRate] = useState(() =>
    parseFloat(localStorage.getItem(`speechRate_${deckId}`)) || 1
  );

  const saveFontSize = (type, val) => {
    if (type === 'front') {
      setFrontFontSize(val);
      localStorage.setItem(`frontFont_${deckId}`, val);
    } else {
      setBackFontSize(val);
      localStorage.setItem(`backFont_${deckId}`, val);
    }
  };

  const saveSpeechRate = (val) => {
    setSpeechRate(val);
    localStorage.setItem(`speechRate_${deckId}`, val);
  };

  // === Session timer (counts UP) ===
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const sessionTimerRef = useRef(null);

  // === Per-card countdown timer ===
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [cardTimeLeft, setCardTimeLeft] = useState(CARD_TIMER_DURATION);
  const cardTimerRef = useRef(null);
  const hiddenStartedAtRef = useRef(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenStartedAtRef.current = Date.now();
        return;
      }

      const hiddenStartedAt = hiddenStartedAtRef.current;
      hiddenStartedAtRef.current = null;
      if (!hiddenStartedAt) return;

      const hiddenSeconds = Math.floor((Date.now() - hiddenStartedAt) / 1000);
      if (hiddenSeconds <= 0) return;

      setSessionSeconds((prev) => prev + hiddenSeconds);
      if (timerEnabled) {
        setCardTimeLeft((prev) => Math.max(0, prev - hiddenSeconds));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timerEnabled]);

  // Build session queue on deck load
  useEffect(() => {
    if (deck && !isLoaded) {
      const due = deck.cards.filter(card => {
        if (!card.nextReview) return true;
        return isDateKeyOnOrBefore(card.nextReview);
      });

      let restored = false;
      let restoredQueue = due;

      try {
        const raw = localStorage.getItem(sessionStateKey);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && typeof saved === 'object') {
            if (saved.forceAll) {
              restoredQueue = [...deck.cards];
            }

            const restoredHardIds = Array.isArray(saved.hardRequeuedIds) ? saved.hardRequeuedIds : [];
            if (restoredHardIds.length > 0) {
              for (const id of restoredHardIds) {
                const card = deck.cards.find(c => c.id === id);
                if (card) restoredQueue.push({ ...card });
              }
            }

            setCurrentIndex(Math.max(0, Math.min(saved.currentIndex || 0, Math.max(0, restoredQueue.length - 1))));
            setTimerEnabled(Boolean(saved.timerEnabled));
            setSessionSeconds(Number.isFinite(saved.sessionSeconds) ? saved.sessionSeconds : 0);
            setForceAll(Boolean(saved.forceAll));
            setHardRequeuedIds(new Set(restoredHardIds));
            setShowHint(Boolean(saved.showHint));
            restored = true;
          }
        }
      } catch {
        // Ignore corrupted saved session state and continue with a fresh queue.
      }

      setSessionQueue(restoredQueue);
      setIsLoaded(true);

      if (restored) {
        setToast({ message: 'Restored your previous session.', type: 'good' });
        setTimeout(() => setToast(null), 1800);
      }
    }
  }, [deck, isLoaded, sessionStateKey]);

  useEffect(() => {
    if (!isLoaded || sessionQueue.length === 0) return;

    const snapshot = {
      currentIndex,
      timerEnabled,
      sessionSeconds,
      forceAll,
      hardRequeuedIds: Array.from(hardRequeuedIds),
      showHint
    };

    localStorage.setItem(sessionStateKey, JSON.stringify(snapshot));
  }, [
    isLoaded,
    sessionQueue.length,
    currentIndex,
    timerEnabled,
    sessionSeconds,
    forceAll,
    hardRequeuedIds,
    showHint,
    sessionStateKey
  ]);

  // Session elapsed timer — starts when loaded, never stops
  useEffect(() => {
    if (isLoaded && sessionQueue.length > 0) {
      sessionTimerRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        setSessionSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(sessionTimerRef.current);
  }, [isLoaded, sessionQueue.length]);

  // Per-card countdown — resets on card change or timer toggle
  const resetCardTimer = useCallback(() => {
    clearInterval(cardTimerRef.current);
    setCardTimeLeft(CARD_TIMER_DURATION);
    if (timerEnabled) {
      cardTimerRef.current = setInterval(() => {
        setCardTimeLeft(prev => {
          if (typeof document !== 'undefined' && document.hidden) return prev;
          if (prev <= 1) { clearInterval(cardTimerRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
  }, [timerEnabled]);

  useEffect(() => {
    resetCardTimer();
    return () => clearInterval(cardTimerRef.current);
  }, [currentIndex, timerEnabled, resetCardTimer]);

  // Force-study all cards
  const handleForceAll = () => {
    if (deck) {
      setSessionQueue([...deck.cards]);
      setCurrentIndex(0);
      setSessionSeconds(0);
      setForceAll(true);
    }
  };

  const showToast = useCallback((rating) => {
    const labels = { hard: '⚡ Hard — Re-queued at end', good: '✓ Good — Scheduled', easy: '🔥 Easy — Long interval set' };
    setToast({ message: labels[rating] || `Marked: ${rating}`, type: rating });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleNext = useCallback((rating) => {
    if (!isLoaded || sessionQueue.length === 0) return;
    if (isGeneratingQuiz) {
      setToast({ message: 'AI quiz is loading. Cancel or wait for completion.', type: 'hard' });
      setTimeout(() => setToast(null), 1800);
      return;
    }
    clearInterval(cardTimerRef.current);

    const currentCard = sessionQueue[currentIndex];
    const elapsedOnCard = timerEnabled ? (CARD_TIMER_DURATION - cardTimeLeft) : 0;

    showToast(rating);
    processCardReview(deckId, currentCard.id, rating.toLowerCase(), {
      elapsedSeconds: elapsedOnCard
    });

    if (rating.toLowerCase() === 'easy') {
      setShowMeteors(true);
      setTimeout(() => setShowMeteors(false), 1500);
    }

    // SM-2 Hard mechanic: re-queue card at end of session (like Anki)
    if (rating.toLowerCase() === 'hard' && !hardRequeuedIds.has(currentCard.id)) {
      setHardRequeuedIds(prev => new Set([...prev, currentCard.id]));
      setSessionQueue(prev => [...prev, { ...currentCard }]);
      // Move to next index — re-queued card will appear again at end
      setCurrentIndex(prev => prev + 1);
      return;
    }

    if (currentIndex < sessionQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      clearInterval(sessionTimerRef.current);
      localStorage.removeItem(sessionStateKey);
      setTimeout(() => navigate('/decks'), 1000);
    }
  }, [
    isLoaded,
    sessionQueue,
    isGeneratingQuiz,
    currentIndex,
    timerEnabled,
    cardTimeLeft,
    showToast,
    processCardReview,
    deckId,
    hardRequeuedIds,
    sessionStateKey,
    navigate
  ]);

  // Auto-advance when card timer hits 0
  useEffect(() => {
    if (cardTimeLeft === 0 && timerEnabled && isLoaded && sessionQueue.length > 0) {
      handleNext('hard');
    }
  }, [cardTimeLeft, timerEnabled, isLoaded, sessionQueue.length, handleNext]);

  // Per-card timer ring calculation
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const cardTimerProgress = timerEnabled ? (cardTimeLeft / CARD_TIMER_DURATION) * circumference : 0;
  const cardTimerColor = cardTimeLeft > 10 ? 'var(--primary)' : cardTimeLeft > 5 ? '#f59e0b' : '#ef4444';

  const totalCards = sessionQueue.length;
  const requeuedCount = hardRequeuedIds.size;
  const currentCard = sessionQueue[currentIndex];
  const currentQuizItem = quizItems[quizCurrentIndex];
  const quizAnsweredCount = quizScore.correct + quizScore.wrong;
  const isQuizComplete = quizItems.length > 0 && quizAnsweredCount >= quizItems.length;

  const resetQuizSession = () => {
    setQuizCurrentIndex(0);
    setQuizShowAnswer(false);
    setQuizResultMap({});
    setQuizScore({ correct: 0, wrong: 0 });
  };

  const handleCancelQuizGeneration = () => {
    if (!isGeneratingQuiz) return;
    quizCancelledRef.current = true;
    setIsGeneratingQuiz(false);
    setToast({ message: 'Quiz generation cancelled.', type: 'hard' });
    setTimeout(() => setToast(null), 1400);
  };

  const handleGenerateQuiz = async () => {
    if (!currentCard) return;
    const requestId = Date.now();
    quizRequestIdRef.current = requestId;
    setIsGeneratingQuiz(true);
    quizCancelledRef.current = false;
    setQuizError('');
    setShowQuizModal(false);
    resetQuizSession();
    try {
      const sourceText = `${currentCard.front || ''}\n${currentCard.back || ''}`.trim();
      const items = await generateLineQuizzes(sourceText);

      if (quizRequestIdRef.current !== requestId || quizCancelledRef.current) return;

      setQuizItems(items);
      setShowQuizModal(true);
    } catch (err) {
      if (quizRequestIdRef.current !== requestId || quizCancelledRef.current) return;
      setQuizError(err.message || 'Quiz generation failed.');
      setShowQuizModal(true);
    } finally {
      if (quizRequestIdRef.current === requestId) {
        setIsGeneratingQuiz(false);
      }
    }
  };

  const handleMarkQuiz = (result) => {
    const item = quizItems[quizCurrentIndex];
    if (!item) return;
    if (quizResultMap[item.id]) return;

    setQuizResultMap(prev => ({ ...prev, [item.id]: result }));
    setQuizScore(prev => ({
      correct: prev.correct + (result === 'correct' ? 1 : 0),
      wrong: prev.wrong + (result === 'wrong' ? 1 : 0)
    }));
  };

  const handleNextQuizItem = () => {
    if (quizCurrentIndex < quizItems.length - 1) {
      setQuizCurrentIndex(prev => prev + 1);
      setQuizShowAnswer(false);
    }
  };

  const handleRestartQuiz = () => {
    resetQuizSession();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      if (showQuizModal || isGeneratingQuiz) return;

      if (e.code === 'Digit1') {
        e.preventDefault();
        handleNext('hard');
      } else if (e.code === 'Digit2') {
        e.preventDefault();
        handleNext('good');
      } else if (e.code === 'Digit3') {
        e.preventDefault();
        handleNext('easy');
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        setShowHint(prev => !prev);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        setReadAloudTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuizModal, isGeneratingQuiz, handleNext]);

  if (!deck) {
    if (accessWarning) {
      return (
        <div className="app-container" style={{ minHeight: '100dvh', background: '#0a0a0a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ maxWidth: '620px', width: '100%', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-xl)', padding: '1.6rem' }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '58px', height: '58px', borderRadius: '50%', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.45)', marginBottom: '0.9rem' }}>
              <Ban size={24} color="#fca5a5" />
            </div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>Access Restricted</h2>
            <p style={{ marginTop: '0.7rem', color: 'var(--secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>{accessWarning}</p>
            <button
              onClick={() => navigate('/decks')}
              style={{ marginTop: '1rem', padding: '0.75rem 1.2rem', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600 }}
            >
              Go to Library
            </button>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="app-container" style={{ minHeight: '100dvh', background: '#0a0a0a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Connecting to Cloud Grid...
      </div>
    );
  }

  if (isLoaded && sessionQueue.length === 0) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', flexDirection: 'column', color: 'white', background: '#0a0a0a' }}>
        <GridBackground />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 10, textAlign: 'center', padding: '2rem' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <Sparkles size={32} color="var(--primary)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Vector Exhausted</h2>
          <p style={{ color: 'var(--secondary)', fontFamily: 'var(--font-body)', fontSize: '1.05rem', maxWidth: '400px', lineHeight: 1.7 }}>
            All cognitive nodes are in their refractory periods — no cards are due today. The SM-2 scheduler will surface them at the optimal time for maximum retention.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => navigate('/decks')} style={{ padding: '0.85rem 1.6rem', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
              <ArrowLeft size={16} /> Retreat to Library
            </button>
            <button onClick={handleForceAll} style={{ padding: '0.85rem 1.6rem', borderRadius: 'var(--radius-full)', background: 'var(--primary)', color: 'black', border: 'none', fontWeight: 700, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease', boxShadow: '0 4px 15px rgba(217,119,6,0.3)' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <RefreshCw size={16} /> Study All Cards Anyway
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isLoaded) return null;

  return (
    <div className="app-container">
      <GridBackground />

      {/* ─── Header ─── */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: isNarrow ? '0.75rem 0.9rem' : (isCompact ? '1rem 1.25rem' : '1.5rem 2.5rem'), zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: isNarrow ? 'stretch' : 'center', flexDirection: isNarrow ? 'column' : 'row', gap: isNarrow ? '0.7rem' : 0, boxSizing: 'border-box' }}>

        {/* Left: Exit + Session Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? '0.8rem' : '1.5rem', flexWrap: isNarrow ? 'wrap' : 'nowrap' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--secondary)', display: 'flex', gap: '0.5rem', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, alignItems: 'center' }}>
            <ArrowLeft size={16} /> Exit
          </button>

          {/* Session Elapsed Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)' }}>
            <Clock size={14} />
            {formatSessionTime(sessionSeconds)}
          </div>
        </div>

        {/* Center: Session label (Glassy Pill) */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: isNarrow ? '0.42rem 0.8rem' : '0.5rem 1.4rem',
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          gap: isNarrow ? '0.45rem' : '0.8rem',
          width: isNarrow ? '100%' : 'auto',
          justifyContent: isNarrow ? 'space-between' : 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
        }}>
          <span style={{ 
            fontFamily: 'var(--font-body)', 
            fontWeight: 800, 
            letterSpacing: '0.05em', 
            textTransform: 'uppercase',
            fontSize: isNarrow ? '0.75rem' : '0.85rem',
            background: 'linear-gradient(90deg, #FFFFFF 0%, var(--primary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            maxWidth: isNarrow ? '58vw' : 'unset',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {deck.title}
          </span>
          <Layers size={14} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 5px var(--primary))' }} />
          {requeuedCount > 0 && (
            <span style={{ color: 'var(--secondary)', fontSize: '0.75rem', fontWeight: 600, marginLeft: '0.4rem' }}>
              Revisit cards +{requeuedCount}
            </span>
          )}
        </div>

        {/* Right: Per-card timer toggle + ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? '0.55rem' : '1rem', flexWrap: isNarrow ? 'wrap' : 'nowrap', justifyContent: isNarrow ? 'flex-start' : 'flex-end' }}>
          {/* General Settings Toggle */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowGeneralSettings(!showGeneralSettings)}
              title="General settings"
              style={{ 
                background: showGeneralSettings ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                color: 'var(--secondary)', 
                width: '36px', height: '36px', 
                borderRadius: '50%', cursor: 'pointer', 
                display: 'flex', alignItems: 'center', justifyContent: 'center' 
              }}
            >
              <SlidersHorizontal size={18} />
            </button>

            <AnimatePresence>
              {showGeneralSettings && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  style={{
                    position: 'absolute', top: '100%', right: isNarrow ? 'auto' : 0, left: isNarrow ? 0 : 'auto', marginTop: '1rem',
                    width: isNarrow ? 'min(280px, calc(100vw - 1.8rem))' : '280px', background: 'rgba(15,15,25,0.95)', 
                    backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 'var(--radius-xl)', padding: '1.25rem',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 110
                  }}
                >
                  <div style={{ marginBottom: '0.9rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: 'white', letterSpacing: '0.02em' }}>General Settings</p>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>Typography and read-aloud preferences</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Front Size (rem)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <input 
                          type="range" min="1" max="3.5" step="0.1" 
                          value={frontFontSize} onChange={(e) => saveFontSize('front', parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--primary)', height: '4px' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, minWidth: '30px' }}>{frontFontSize.toFixed(1)}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Back Size (rem)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <input 
                          type="range" min="0.8" max="2.5" step="0.1" 
                          value={backFontSize} onChange={(e) => saveFontSize('back', parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--primary)', height: '4px' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, minWidth: '30px' }}>{backFontSize.toFixed(1)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Read Speed (x)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <input
                          type="range" min="0.6" max="1.8" step="0.1"
                          value={speechRate} onChange={(e) => saveSpeechRate(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--primary)', height: '4px' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, minWidth: '34px' }}>{speechRate.toFixed(1)}x</span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keyboard Shortcuts</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.72)' }}><strong>Space:</strong> Flip card</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.72)' }}><strong>1 / 2 / 3:</strong> Hard / Good / Easy</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.72)' }}><strong>H:</strong> Toggle hint</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.72)' }}><strong>R:</strong> Read aloud toggle</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setShowHint(prev => !prev)}
            title={showHint ? 'Hide hint' : 'Show hint'}
            style={{
              background: showHint ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showHint ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.1)'}`,
              color: showHint ? '#fbbf24' : 'var(--secondary)',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Lightbulb size={18} />
          </button>

          <button
            onClick={handleGenerateQuiz}
            title="Generate AI quiz from current card"
            disabled={isGeneratingQuiz}
            style={{
              background: isGeneratingQuiz ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--secondary)',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              cursor: isGeneratingQuiz ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isGeneratingQuiz ? 0.7 : 1
            }}
          >
            {isGeneratingQuiz ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <HelpCircle size={18} />}
          </button>

          <button
            onClick={() => setTimerEnabled(prev => !prev)}
            title={timerEnabled ? 'Disable card timer' : 'Enable 30s per-card timer'}
            style={{ background: timerEnabled ? 'rgba(217,119,6,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${timerEnabled ? 'rgba(217,119,6,0.4)' : 'rgba(255,255,255,0.1)'}`, color: timerEnabled ? 'var(--primary)' : 'var(--secondary)', padding: isNarrow ? '0.38rem 0.72rem' : '0.45rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: isNarrow ? '0.75rem' : '0.82rem', display: 'flex', alignItems: 'center', gap: '0.45rem', transition: 'all 0.2s ease' }}
          >
            {timerEnabled ? <Timer size={14} /> : <TimerOff size={14} />}
            {timerEnabled ? (isNarrow ? '30s' : '30s/card') : (isNarrow ? 'Timer' : 'Card Timer')}
          </button>

          {/* Per-card countdown ring */}
          <AnimatePresence>
            {timerEnabled && (
              <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} style={{ position: 'relative', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="44" height="44" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                  <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                  <circle
                    cx="22" cy="22" r={radius} fill="none"
                    stroke={cardTimerColor}
                    strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - cardTimerProgress}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
                  />
                </svg>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, color: cardTimerColor, zIndex: 1 }}>{cardTimeLeft}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Main Study Stage ─── */}
      <main className="main-stage" style={{ paddingTop: isNarrow ? '165px' : (isCompact ? '118px' : '80px'), paddingBottom: isNarrow ? '118px' : '0px', display: 'flex', alignItems: 'center', zIndex: showQuizModal ? 2147483647 : 10 }}>
        <section
          className="study-area"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            paddingLeft: `calc(var(--spacing-8) + ${sideControlInset}px)`,
            paddingRight: `calc(var(--spacing-8) + ${sideControlInset}px)`
          }}
        >
          <motion.div
            className="flashcard-wrapper"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
          >
            {/* Shining Beam Progress with Stars */}
            <div className="study-orbits" aria-label={`Node ${currentIndex + 1} of ${totalCards}`} style={{ marginBottom: isNarrow ? '0.95rem' : '1.35rem' }}>
              <div className="study-beam-container" style={{ position: 'relative', overflow: 'visible' }}>
                <motion.div 
                  className="study-beam-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentIndex / totalCards) * 100}%` }}
                  transition={{ type: "spring", stiffness: 80, damping: 20 }}
                />
                
                {/* Progress Markers */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {totalCards > 0 && Array.from({ length: totalCards }).map((_, i) => {
                    const pos = (i / (totalCards - 1 || 1)) * 100;
                    const isCurrent = i === currentIndex;
                    const isCompleted = i < currentIndex;
                    
                    return (
                      <div 
                        key={i} 
                        className={`study-beam-star ${isCurrent ? 'active' : 'dim'}`}
                        style={{ 
                          left: `${pos}%`,
                          color: isCurrent ? 'var(--primary)' : isCompleted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)'
                        }}
                      >
                        {isCurrent ? (
                          <Zap size={14} fill="currentColor" strokeWidth={0} />
                        ) : (
                          <div style={{ width: '4px', height: '4px', background: 'currentColor', borderRadius: '50%' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontFamily: 'var(--font-display)', fontWeight: 700, minWidth: '40px', textAlign: 'right', marginLeft: '0.5rem' }}>
                {currentIndex + 1} / {totalCards}
              </div>
            </div>

            <Flashcard
              key={sessionQueue[currentIndex]?.id + '-' + currentIndex}
              frontContent={currentCard?.front}
              backContent={currentCard?.back}
              frontFontSize={`${frontFontSize}rem`}
              backFontSize={`${backFontSize}rem`}
              speechRate={speechRate}
              showHint={showHint}
              hintText={currentCard?.back}
              readAloudTrigger={readAloudTrigger}
            />
          </motion.div>
        </section>

        {/* Celestial Meteor Cheer (Canvas Engine) */}
        <CelestialMeteors active={showMeteors} />

        {/* Vertical Study Sidebar */}
        <StudyControls onNext={handleNext} />

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              className={`toast-notification ${toast.type}`}
              initial={{ y: 50, opacity: 0, x: "-50%" }}
              animate={{ y: 0, opacity: 1, x: "-50%" }}
              exit={{ y: 20, opacity: 0, x: "-50%" }}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quiz Loading Alert */}
        <AnimatePresence>
          {isGeneratingQuiz && (
            <motion.div
              initial={{ opacity: 0, y: 20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              style={{
                position: 'fixed',
                left: '50%',
                bottom: isNarrow ? '124px' : '108px',
                zIndex: 121,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: 'rgba(15,15,25,0.92)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 'var(--radius-full)',
                padding: '0.5rem 0.65rem 0.5rem 0.8rem',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
              }}
            >
              <Loader2 size={14} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ color: 'white', fontSize: '0.82rem', fontWeight: 600 }}>Generating AI quiz...</span>
              <button
                type="button"
                onClick={handleCancelQuizGeneration}
                style={{
                  border: '1px solid rgba(239,68,68,0.35)',
                  background: 'rgba(239,68,68,0.15)',
                  color: '#fca5a5',
                  borderRadius: '999px',
                  height: '28px',
                  padding: '0 0.55rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                <Ban size={12} /> Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Quiz Modal */}
        <AnimatePresence>
          {showQuizModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuizModal(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.72)',
                backdropFilter: 'blur(6px)',
                zIndex: 2147483646,
                padding: isNarrow ? '0.7rem' : '1rem',
                boxSizing: 'border-box'
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                onClick={e => e.stopPropagation()}
                style={{
                  maxWidth: isNarrow ? '100%' : '760px',
                  width: isNarrow ? '100%' : 'calc(100% - 2rem)',
                  maxHeight: isNarrow ? 'calc(100dvh - 1.4rem)' : '82vh',
                  overflowY: 'auto',
                  margin: isNarrow ? '0 auto' : '7vh auto 0',
                  background: 'rgba(15,15,25,0.95)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-xl)',
                  padding: isNarrow ? '0.95rem 0.88rem 0.85rem' : '1.25rem 1.25rem 1rem',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
                  position: 'relative',
                  zIndex: 2147483647
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isNarrow ? '0.75rem' : '0.9rem', gap: '0.6rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: isNarrow ? '1.02rem' : '1.15rem', color: 'white' }}>Quiz</h3>
                    <p style={{ margin: '0.3rem 0 0 0', color: 'rgba(255,255,255,0.58)', fontSize: '0.82rem' }}>Test mode</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQuizModal(false)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'var(--secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 2
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>

                {quizError ? (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '0.8rem 0.9rem', color: '#fca5a5', fontSize: '0.9rem', lineHeight: 1.55, overflowWrap: 'anywhere', wordBreak: 'break-word', maxHeight: isNarrow ? '28vh' : '32vh', overflowY: 'auto' }}>
                    {quizError}
                  </div>
                ) : quizItems.length === 0 ? (
                  <p style={{ color: 'var(--secondary)', fontSize: '0.9rem' }}>No quiz items generated yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isNarrow ? '0.7rem' : '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: isNarrow ? 'flex-start' : 'center', flexDirection: isNarrow ? 'column' : 'row', gap: isNarrow ? '0.45rem' : 0, justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', padding: isNarrow ? '0.62rem 0.7rem' : '0.65rem 0.8rem' }}>
                      <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>Question {Math.min(quizCurrentIndex + 1, quizItems.length)} / {quizItems.length}</span>
                      <div style={{ display: 'flex', gap: '0.65rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>Correct: {quizScore.correct}</span>
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>Wrong: {quizScore.wrong}</span>
                      </div>
                    </div>

                    {currentQuizItem && (
                      <article
                        style={{
                          border: '1px solid rgba(255,255,255,0.09)',
                          borderRadius: 'var(--radius-lg)',
                          background: 'rgba(255,255,255,0.02)',
                          padding: isNarrow ? '0.78rem 0.82rem' : '0.95rem 1rem'
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.45)' }}>Question</p>
                          <p style={{ margin: '0.35rem 0 0 0', color: 'white', fontSize: isNarrow ? '0.92rem' : '0.98rem', fontWeight: 600, lineHeight: 1.5 }}>{currentQuizItem.question}</p>
                        </div>

                        {quizShowAnswer && (
                          <div style={{ marginTop: '0.9rem', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.08)' }}>
                            <p style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(187,247,208,0.9)' }}>Answer</p>
                            <p style={{ margin: '0.35rem 0 0 0', color: '#bbf7d0', fontSize: '0.92rem', lineHeight: 1.6 }}>{currentQuizItem.answer}</p>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => setQuizShowAnswer(prev => !prev)}
                            style={{ padding: '0.52rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '0.82rem', cursor: 'pointer', minHeight: '38px', minWidth: isNarrow ? 'calc(50% - 0.25rem)' : 'unset', flex: isNarrow ? '1 1 calc(50% - 0.25rem)' : 'unset' }}
                          >
                            {quizShowAnswer ? 'Hide Answer' : 'Show Answer'}
                          </button>

                          <button
                            type="button"
                            disabled={!quizShowAnswer || Boolean(quizResultMap[currentQuizItem.id])}
                            onClick={() => handleMarkQuiz('correct')}
                            style={{ padding: '0.52rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34,197,94,0.45)', background: 'rgba(34,197,94,0.12)', color: '#86efac', fontSize: '0.82rem', cursor: !quizShowAnswer || quizResultMap[currentQuizItem.id] ? 'not-allowed' : 'pointer', opacity: !quizShowAnswer || quizResultMap[currentQuizItem.id] ? 0.5 : 1, minHeight: '38px', minWidth: isNarrow ? 'calc(50% - 0.25rem)' : 'unset', flex: isNarrow ? '1 1 calc(50% - 0.25rem)' : 'unset' }}
                          >
                            Mark Correct
                          </button>

                          <button
                            type="button"
                            disabled={!quizShowAnswer || Boolean(quizResultMap[currentQuizItem.id])}
                            onClick={() => handleMarkQuiz('wrong')}
                            style={{ padding: '0.52rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.45)', background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontSize: '0.82rem', cursor: !quizShowAnswer || quizResultMap[currentQuizItem.id] ? 'not-allowed' : 'pointer', opacity: !quizShowAnswer || quizResultMap[currentQuizItem.id] ? 0.5 : 1, minHeight: '38px', minWidth: isNarrow ? 'calc(50% - 0.25rem)' : 'unset', flex: isNarrow ? '1 1 calc(50% - 0.25rem)' : 'unset' }}
                          >
                            Mark Wrong
                          </button>

                          <button
                            type="button"
                            disabled={quizCurrentIndex >= quizItems.length - 1}
                            onClick={handleNextQuizItem}
                            style={{ padding: '0.52rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '0.82rem', cursor: quizCurrentIndex >= quizItems.length - 1 ? 'not-allowed' : 'pointer', opacity: quizCurrentIndex >= quizItems.length - 1 ? 0.5 : 1, minHeight: '38px', width: isNarrow ? '100%' : 'unset' }}
                          >
                            Next Question
                          </button>
                        </div>
                      </article>
                    )}

                    {isQuizComplete && (
                      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', padding: '0.8rem 0.9rem' }}>
                        <p style={{ margin: 0, color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>Test Complete</p>
                        <p style={{ margin: '0.3rem 0 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem' }}>
                          Score: {quizScore.correct} correct / {quizItems.length} total
                        </p>
                        <button
                          type="button"
                          onClick={handleRestartQuiz}
                          style={{ marginTop: '0.55rem', padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'white', fontSize: '0.82rem', cursor: 'pointer' }}
                        >
                          Restart Test
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

