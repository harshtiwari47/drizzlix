import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  enqueueOfflineSyncRequest,
  removeOfflineSyncRequestByDedupeKey,
} from '../services/offlineSyncQueue';
import { addDaysToDateKeyLocal, getTodayDateKeyLocal } from '../services/dateKey';

const DeckContext = createContext();
const BASE_URL = '/api';
const isOfflineMode = () => (typeof navigator !== 'undefined' ? !navigator.onLine : false);

async function readJsonResponseSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isInvalidAuthResponse(response, payload) {
  if (response.status === 401) return true;
  return response.status === 400 && payload?.msg === 'Token invalid';
}

const createEmptyStats = () => ({
  version: 2,
  totals: {
    reviews: 0,
    correct: 0,
    hard: 0,
    good: 0,
    easy: 0,
    lapses: 0,
    studySeconds: 0,
    uniqueCardsReviewed: 0,
    sessionsCompleted: 0
  },
  streak: {
    current: 0,
    best: 0,
    lastStudyDate: null
  },
  daily: {},
  decks: {},
  cards: {}
});

const normalizeStats = (incoming) => {
  if (!incoming || typeof incoming !== 'object') return createEmptyStats();
  if (incoming.version === 2) {
    return {
      ...createEmptyStats(),
      ...incoming,
      totals: { ...createEmptyStats().totals, ...(incoming.totals || {}) },
      streak: { ...createEmptyStats().streak, ...(incoming.streak || {}) },
      daily: incoming.daily || {},
      decks: incoming.decks || {},
      cards: incoming.cards || {}
    };
  }

  const migrated = createEmptyStats();
  const totalReviewed = Number(incoming.totalReviewed || 0);
  const correctCount = Number(incoming.correctCount || 0);
  migrated.totals.reviews = totalReviewed;
  migrated.totals.correct = correctCount;
  migrated.totals.good = correctCount;
  migrated.totals.hard = Math.max(0, totalReviewed - correctCount);
  migrated.totals.studySeconds = totalReviewed * 22;
  migrated.totals.uniqueCardsReviewed = Number(incoming.totalMastered || 0);
  migrated.streak.current = Number(incoming.currentStreak || 0);
  migrated.streak.best = Number(incoming.currentStreak || 0);
  migrated.streak.lastStudyDate = incoming.lastStudyDate || null;

  const legacyHistory = incoming.history || {};
  Object.keys(legacyHistory).forEach((dateKey) => {
    const reviews = Number(legacyHistory[dateKey] || 0);
    migrated.daily[dateKey] = {
      reviews,
      correct: Math.round(reviews * (totalReviewed ? (correctCount / totalReviewed) : 0)),
      hard: Math.max(0, reviews - Math.round(reviews * (totalReviewed ? (correctCount / totalReviewed) : 0))),
      good: Math.round(reviews * (totalReviewed ? (correctCount / totalReviewed) : 0)),
      easy: 0,
      studySeconds: reviews * 22
    };
  });

  return migrated;
};

export function useDeck() {
  return useContext(DeckContext);
}

export function DeckProvider({ children }) {
  const { token, logout } = useAuth();
  const [decks, setDecks] = useState([]);
  const [isDecksLoading, setIsDecksLoading] = useState(false);

  const [stats, setStats] = useState(createEmptyStats());

  const handleInvalidAuth = useCallback(() => {
    setDecks([]);
    setStats(createEmptyStats());
    setIsDecksLoading(false);
    logout();
  }, [logout]);

  const enqueueAuthenticatedSync = useCallback((url, method, body, dedupeKey) => {
    enqueueOfflineSyncRequest({
      url,
      method,
      body,
      headers: {
        'Content-Type': 'application/json',
      },
      authMode: 'bearer',
      dedupeKey,
    });
  }, []);

  useEffect(() => {
    if (token) {
      let cancelled = false;
      setIsDecksLoading(true);

      const fetchProtected = async (route) => {
        const response = await fetch(`${BASE_URL}${route}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = await readJsonResponseSafe(response);

        if (isInvalidAuthResponse(response, payload)) {
          if (!cancelled) handleInvalidAuth();
          return { unauthorized: true, payload: null };
        }

        if (!response.ok) {
          throw new Error(payload?.msg || `Request failed with status ${response.status}`);
        }

        return { unauthorized: false, payload };
      };

      (async () => {
        try {
          const [decksResult, statsResult] = await Promise.all([
            fetchProtected('/decks'),
            fetchProtected('/stats'),
          ]);

          if (cancelled || decksResult.unauthorized || statsResult.unauthorized) return;

          if (Array.isArray(decksResult.payload)) {
            setDecks(decksResult.payload);
          }

          const statsPayload = statsResult.payload;
          if (statsPayload && Object.keys(statsPayload).length > 0) {
            setStats(normalizeStats(statsPayload));
          } else {
            setStats(createEmptyStats());
          }
        } catch (err) {
          if (!cancelled) {
            console.error(err);
          }
        } finally {
          if (!cancelled) {
            setIsDecksLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    } else {
      setDecks([]);
      setStats(createEmptyStats());
      setIsDecksLoading(false);
    }
  }, [token, handleInvalidAuth]);

  const syncDeckToDB = useCallback(async (deckData) => {
    if (!token) return;

    const deckId = String(deckData?.id || 'unknown');
    const dedupeKey = `decks:upsert:${deckId}`;

    if (isOfflineMode()) {
      enqueueAuthenticatedSync(`${BASE_URL}/decks`, 'POST', deckData, dedupeKey);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/decks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(deckData)
      });

      const payload = await readJsonResponseSafe(response);

      if (isInvalidAuthResponse(response, payload)) {
        handleInvalidAuth();
        return;
      }

      if (!response.ok) {
        throw new Error(`Deck sync failed with status ${response.status}`);
      }

      removeOfflineSyncRequestByDedupeKey(dedupeKey);
    } catch (err) {
      console.error('DB Sync Failed', err);
      enqueueAuthenticatedSync(`${BASE_URL}/decks`, 'POST', deckData, dedupeKey);
    }
  }, [token, enqueueAuthenticatedSync, handleInvalidAuth]);

  const syncStatsToDB = useCallback(async (newStats) => {
    if (!token) return;

    const dedupeKey = 'stats:upsert';

    if (isOfflineMode()) {
      enqueueAuthenticatedSync(`${BASE_URL}/stats`, 'POST', newStats, dedupeKey);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newStats)
      });

      const payload = await readJsonResponseSafe(response);

      if (isInvalidAuthResponse(response, payload)) {
        handleInvalidAuth();
        return;
      }

      if (!response.ok) {
        throw new Error(`Stats sync failed with status ${response.status}`);
      }

      removeOfflineSyncRequestByDedupeKey(dedupeKey);
    } catch (err) {
      console.error('DB Stats Sync Failed', err);
      enqueueAuthenticatedSync(`${BASE_URL}/stats`, 'POST', newStats, dedupeKey);
    }
  }, [token, enqueueAuthenticatedSync, handleInvalidAuth]);

  const addDeck = useCallback((deck) => {
    setDecks(prev => [...prev, deck]);
    syncDeckToDB(deck);
  }, [syncDeckToDB]);

  const updateDeck = useCallback((id, updatedFields) => {
    setDecks(prev => {
      const updated = prev.map(deck => deck.id === id ? { ...deck, ...updatedFields } : deck);
      const target = updated.find(d => d.id === id);
      if (target) syncDeckToDB(target);
      return updated;
    });
  }, [syncDeckToDB]);

  const removeDeck = useCallback((id) => {
    setDecks(prev => prev.filter(deck => deck.id !== id));
    if (!token) return;

    const upsertDedupeKey = `decks:upsert:${id}`;
    const deleteDedupeKey = `decks:delete:${id}`;
    removeOfflineSyncRequestByDedupeKey(upsertDedupeKey);

    if (isOfflineMode()) {
      enqueueAuthenticatedSync(`${BASE_URL}/decks/${id}`, 'DELETE', null, deleteDedupeKey);
      return;
    }

    fetch(`${BASE_URL}/decks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      if (!response.ok) {
        enqueueAuthenticatedSync(`${BASE_URL}/decks/${id}`, 'DELETE', null, deleteDedupeKey);
      } else {
        removeOfflineSyncRequestByDedupeKey(deleteDedupeKey);
      }
    }).catch(() => {
      enqueueAuthenticatedSync(`${BASE_URL}/decks/${id}`, 'DELETE', null, deleteDedupeKey);
    });
  }, [token, enqueueAuthenticatedSync]);

  const publishDeck = useCallback(async (id) => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/decks/${id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDecks(prev => prev.map(deck => deck.id === id ? {
        ...deck,
        isPublic: data.isPublic,
        isDiscoverable: data.isDiscoverable
      } : deck));
      return data;
    } catch (err) { console.error('Publish failed', err); }
  }, [token]);

  const saveToCopy = useCallback(async (publicDeckId) => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/decks/${publicDeckId}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.msg);
      }
      const copied = await res.json();
      setDecks(prev => [...prev, copied]);
      return copied;
    } catch (err) {
      console.error('Save copy failed', err);
      throw err;
    }
  }, [token]);

  const logReview = useCallback((payload) => {
    const quality = String(payload?.quality || '').toLowerCase();
    if (!['hard', 'good', 'easy'].includes(quality)) return;

    const todayStr = getTodayDateKeyLocal();
    const elapsedSeconds = Math.max(5, Number(payload?.elapsedSeconds || 0));
    const deckId = payload?.deckId;
    const cardId = payload?.cardId;
    const deckTitle = payload?.deckTitle || 'Untitled Deck';
    const intervalAfter = Number(payload?.intervalAfter || 0);
    const repetitionAfter = Number(payload?.repetitionAfter || 0);
    const easeAfter = Number(payload?.easeAfter || 2.5);

    setStats(prevRaw => {
      const prev = normalizeStats(prevRaw);
      let newStreak = prev.streak.current || 0;
      if (prev.streak.lastStudyDate !== todayStr) {
        const yStr = addDaysToDateKeyLocal(-1);

        if (prev.streak.lastStudyDate === yStr) newStreak += 1;
        else if (prev.streak.lastStudyDate !== todayStr) newStreak = 1;
      }
      const isCorrect = quality === 'good' || quality === 'easy';
      const todayBucket = prev.daily[todayStr] || {
        reviews: 0,
        correct: 0,
        hard: 0,
        good: 0,
        easy: 0,
        studySeconds: 0
      };

      const cardPerf = cardId ? (prev.cards[cardId] || {
        reviews: 0,
        correct: 0,
        hard: 0,
        good: 0,
        easy: 0,
        lastReviewed: null,
        intervalAfter: 0,
        repetitionAfter: 0,
        easeAfter: 2.5,
        stabilityScore: 0
      }) : null;

      const deckPerf = deckId ? (prev.decks[deckId] || {
        title: deckTitle,
        reviews: 0,
        correct: 0,
        hard: 0,
        good: 0,
        easy: 0,
        lastReviewed: null
      }) : null;

      const stabilityScore = Math.max(
        0,
        Math.min(100, Math.round((repetitionAfter * 11) + (intervalAfter * 1.8) + ((easeAfter - 1.3) * 20)))
      );

      const nextStats = {
        ...prev,
        totals: {
          ...prev.totals,
          reviews: prev.totals.reviews + 1,
          correct: prev.totals.correct + (isCorrect ? 1 : 0),
          hard: prev.totals.hard + (quality === 'hard' ? 1 : 0),
          good: prev.totals.good + (quality === 'good' ? 1 : 0),
          easy: prev.totals.easy + (quality === 'easy' ? 1 : 0),
          lapses: prev.totals.lapses + (quality === 'hard' ? 1 : 0),
          studySeconds: prev.totals.studySeconds + elapsedSeconds,
          uniqueCardsReviewed: cardId
            ? Math.max(prev.totals.uniqueCardsReviewed, Object.keys(prev.cards).includes(cardId) ? prev.totals.uniqueCardsReviewed : prev.totals.uniqueCardsReviewed + 1)
            : prev.totals.uniqueCardsReviewed
        },
        streak: {
          current: newStreak,
          best: Math.max(prev.streak.best || 0, newStreak),
          lastStudyDate: todayStr
        },
        daily: {
          ...prev.daily,
          [todayStr]: {
            reviews: todayBucket.reviews + 1,
            correct: todayBucket.correct + (isCorrect ? 1 : 0),
            hard: todayBucket.hard + (quality === 'hard' ? 1 : 0),
            good: todayBucket.good + (quality === 'good' ? 1 : 0),
            easy: todayBucket.easy + (quality === 'easy' ? 1 : 0),
            studySeconds: todayBucket.studySeconds + elapsedSeconds
          }
        },
        cards: cardId ? {
          ...prev.cards,
          [cardId]: {
            ...cardPerf,
            reviews: cardPerf.reviews + 1,
            correct: cardPerf.correct + (isCorrect ? 1 : 0),
            hard: cardPerf.hard + (quality === 'hard' ? 1 : 0),
            good: cardPerf.good + (quality === 'good' ? 1 : 0),
            easy: cardPerf.easy + (quality === 'easy' ? 1 : 0),
            lastReviewed: new Date().toISOString(),
            intervalAfter,
            repetitionAfter,
            easeAfter,
            stabilityScore
          }
        } : prev.cards,
        decks: deckId ? {
          ...prev.decks,
          [deckId]: {
            ...deckPerf,
            title: deckTitle,
            reviews: deckPerf.reviews + 1,
            correct: deckPerf.correct + (isCorrect ? 1 : 0),
            hard: deckPerf.hard + (quality === 'hard' ? 1 : 0),
            good: deckPerf.good + (quality === 'good' ? 1 : 0),
            easy: deckPerf.easy + (quality === 'easy' ? 1 : 0),
            lastReviewed: new Date().toISOString()
          }
        } : prev.decks
      };

      syncStatsToDB(nextStats);
      return nextStats;
    });
  }, [syncStatsToDB]);

  const getReviewUpdate = useCallback((card, quality) => {
    const qualityNum = quality === 'easy' ? 5 : quality === 'good' ? 4 : 2;
    const curEase = card.easeFactor || 2.5;
    const curRep = card.repetition || 0;
    const curInt = card.interval || 0;

    let newEase = curEase + (0.1 - (5 - qualityNum) * (0.08 + (5 - qualityNum) * 0.02));
    if (newEase < 1.3) newEase = 1.3;

    let newRep = curRep;
    let newInt = curInt;

    if (qualityNum < 3) {
      newRep = 0;
      newInt = 1;
    } else {
      if (curRep === 0) newInt = 1;
      else if (curRep === 1) newInt = 6;
      else newInt = Math.round(curInt * newEase);
      newRep += 1;
    }

    const nextReviewStr = addDaysToDateKeyLocal(newInt);

    return {
      ...card,
      easeFactor: newEase,
      repetition: newRep,
      interval: newInt,
      lastOpened: new Date().toISOString(),
      nextReview: nextReviewStr
    };
  }, []);

  const processCardReview = useCallback((deckId, cardId, quality, meta = {}) => {
    const sourceDeck = decks.find(deck => deck.id === deckId);
    const sourceCard = sourceDeck?.cards?.find(card => card.id === cardId);
    if (!sourceDeck || !sourceCard) return;

    const updatedCard = getReviewUpdate(sourceCard, quality);
    const reviewPayload = {
      quality,
      deckId,
      deckTitle: sourceDeck.title,
      cardId,
      intervalAfter: updatedCard.interval,
      repetitionAfter: updatedCard.repetition,
      easeAfter: updatedCard.easeFactor,
      elapsedSeconds: meta.elapsedSeconds
    };

    setDecks(prevDecks => {
      const updatedDecks = prevDecks.map(deck => {
        if (deck.id !== deckId) return deck;
        const newCards = deck.cards.map(card => (card.id === cardId ? updatedCard : card));
        return { ...deck, cards: newCards };
      });

      const targetDeck = updatedDecks.find(d => d.id === deckId);
      if (targetDeck) syncDeckToDB(targetDeck);

      return updatedDecks;
    });

    if (reviewPayload) {
      logReview(reviewPayload);
    }
  }, [decks, getReviewUpdate, logReview, syncDeckToDB]);

  const setStreakForTesting = useCallback((value) => {
    const target = Math.max(0, Math.floor(Number(value) || 0));
    const todayStr = getTodayDateKeyLocal();

    setStats((prevRaw) => {
      const prev = normalizeStats(prevRaw);
      const nextStats = {
        ...prev,
        streak: {
          ...prev.streak,
          current: target,
          best: Math.max(prev.streak.best || 0, target),
          lastStudyDate: target > 0 ? todayStr : null,
        },
      };
      syncStatsToDB(nextStats);
      return nextStats;
    });
  }, [syncStatsToDB]);

  const addStreakForTesting = useCallback((increment = 1) => {
    const bonus = Math.max(0, Math.floor(Number(increment) || 0));
    if (bonus <= 0) return;

    setStats((prevRaw) => {
      const prev = normalizeStats(prevRaw);
      const todayStr = getTodayDateKeyLocal();
      const nextCurrent = Math.max(0, Number(prev.streak.current || 0) + bonus);
      const nextStats = {
        ...prev,
        streak: {
          ...prev.streak,
          current: nextCurrent,
          best: Math.max(prev.streak.best || 0, nextCurrent),
          lastStudyDate: nextCurrent > 0 ? todayStr : null,
        },
      };
      syncStatsToDB(nextStats);
      return nextStats;
    });
  }, [syncStatsToDB]);

  const deckValue = useMemo(() => ({
    decks,
    isDecksLoading,
    addDeck,
    updateDeck,
    removeDeck,
    publishDeck,
    saveToCopy,
    stats,
    logReview,
    processCardReview,
    setStreakForTesting,
    addStreakForTesting,
  }), [
    decks,
    isDecksLoading,
    addDeck,
    updateDeck,
    removeDeck,
    publishDeck,
    saveToCopy,
    stats,
    logReview,
    processCardReview,
    setStreakForTesting,
    addStreakForTesting,
  ]);

  return (
    <DeckContext.Provider value={deckValue}>
      {children}
    </DeckContext.Provider>
  );
}

