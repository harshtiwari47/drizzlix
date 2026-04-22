import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame, Target, Brain, Activity, Zap } from 'lucide-react';
import { useDeck } from '../context/DeckContext';
import {
  formatDateKeyLocal,
  getDayMonthLabelFromDateKey,
  getWeekdayLabelFromDateKey,
  isDateKeyOnOrBefore,
} from '../services/dateKey';
import './Mastery.css';

const MasteryChartsSection = React.lazy(() => import('./mastery/MasteryChartsSection'));

function toPercent(value) {
  return `${value.toFixed(1)}%`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export default function Mastery() {
  const { stats, decks } = useDeck();
  const prefersReducedMotion = useReducedMotion();

  const safeStats = stats || {};
  const totals = safeStats.totals || {};
  const streak = safeStats.streak || {};
  const daily = safeStats.daily || {};
  const cardsPerf = safeStats.cards || {};

  const {
    lifetimeReviews,
    lifetimeStudySeconds,
    hardCount,
    goodCount,
    easyCount,
    lapsesCount,
    retention,
    dueToday,
    totalCards,
    matureCards,
    avgInterval,
    totalRatings,
    qualityVector,
    activityData,
    loadState,
  } = React.useMemo(() => {
    const deckList = Array.isArray(decks) ? decks : [];
    const lifetimeReviewsLocal = Number(totals.reviews || 0);
    const lifetimeCorrectLocal = Number(totals.correct || 0);
    const lifetimeStudySecondsLocal = Number(totals.studySeconds || 0);
    const hardCountLocal = Number(totals.hard || 0);
    const goodCountLocal = Number(totals.good || 0);
    const easyCountLocal = Number(totals.easy || 0);
    const lapsesCountLocal = Number(totals.lapses ?? hardCountLocal);
    const retentionLocal = lifetimeReviewsLocal > 0 ? (lifetimeCorrectLocal / lifetimeReviewsLocal) * 100 : 0;

    const dueTodayLocal = deckList.reduce((acc, deck) => {
      const dueCards = (deck.cards || []).filter((card) => {
        if (!card.nextReview) return true;
        return isDateKeyOnOrBefore(card.nextReview);
      }).length;
      return acc + dueCards;
    }, 0);

    const totalCardsLocal = deckList.reduce((acc, deck) => acc + (deck.cards?.length || 0), 0);
    const matureCardsLocal = deckList.reduce((acc, deck) => {
      const mature = (deck.cards || []).filter((card) => Number(card.interval || 0) >= 21).length;
      return acc + mature;
    }, 0);

    const intervals = deckList.flatMap((deck) => (deck.cards || []).map((card) => Number(card.interval || 0)));
    const avgIntervalLocal = intervals.length > 0
      ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
      : 0;

    const activityDataLocal = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const dateKey = formatDateKeyLocal(d);
      const weekday = getWeekdayLabelFromDateKey(dateKey);
      const dayMonth = getDayMonthLabelFromDateKey(dateKey);
      const day = daily[dateKey] || {};
      const dayReviews = Number(day.reviews || 0);
      const dayCorrect = Number(day.correct || 0);

      return {
        name: `${weekday} ${dayMonth}`,
        dateLabel: dayMonth,
        reviews: dayReviews,
        retention: dayReviews > 0 ? Number(((dayCorrect / dayReviews) * 100).toFixed(1)) : 0,
      };
    });

    const last7 = activityDataLocal.slice(-7);
    const reviewsLast7 = last7.reduce((sum, day) => sum + day.reviews, 0);
    const daysStudiedLast14 = activityDataLocal.filter((day) => day.reviews > 0).length;

    const consistencyScore = clamp((daysStudiedLast14 / 14) * 100);
    const maturityScore = totalCardsLocal > 0 ? clamp((matureCardsLocal / totalCardsLocal) * 100) : 0;
    const workloadControlScore = totalCardsLocal > 0 ? clamp(100 - ((dueTodayLocal / totalCardsLocal) * 100)) : 0;
    const velocityScore = clamp((reviewsLast7 / 70) * 100);

    const qualityVectorLocal = [
      { subject: 'Retention', value: Number(retentionLocal.toFixed(1)), fullMark: 100 },
      { subject: 'Consistency', value: Number(consistencyScore.toFixed(1)), fullMark: 100 },
      { subject: 'Maturity', value: Number(maturityScore.toFixed(1)), fullMark: 100 },
      { subject: 'Workload', value: Number(workloadControlScore.toFixed(1)), fullMark: 100 },
      { subject: 'Velocity', value: Number(velocityScore.toFixed(1)), fullMark: 100 },
    ];

    const totalRatingsLocal = hardCountLocal + goodCountLocal + easyCountLocal;
    const loadStateLocal = dueTodayLocal === 0 ? 'Recovered' : dueTodayLocal < 10 ? 'Stable' : dueTodayLocal < 30 ? 'Busy' : 'Overloaded';

    return {
      lifetimeReviews: lifetimeReviewsLocal,
      lifetimeStudySeconds: lifetimeStudySecondsLocal,
      hardCount: hardCountLocal,
      goodCount: goodCountLocal,
      easyCount: easyCountLocal,
      lapsesCount: lapsesCountLocal,
      retention: retentionLocal,
      dueToday: dueTodayLocal,
      totalCards: totalCardsLocal,
      matureCards: matureCardsLocal,
      avgInterval: avgIntervalLocal,
      totalRatings: totalRatingsLocal,
      qualityVector: qualityVectorLocal,
      activityData: activityDataLocal,
      loadState: loadStateLocal,
    };
  }, [decks, totals, daily]);

  const trackedCardsCount = React.useMemo(() => Object.keys(cardsPerf).length, [cardsPerf]);
  const studyHours = React.useMemo(() => (lifetimeStudySeconds / 3600).toFixed(1), [lifetimeStudySeconds]);

  const containerVariants = React.useMemo(() => {
    if (prefersReducedMotion) {
      return {
        hidden: { opacity: 1 },
        show: { opacity: 1 },
      };
    }

    return {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: { staggerChildren: 0.08 },
      },
    };
  }, [prefersReducedMotion]);

  const itemVariants = React.useMemo(() => {
    if (prefersReducedMotion) {
      return {
        hidden: { opacity: 1, y: 0 },
        show: { opacity: 1, y: 0 },
      };
    }

    return {
      hidden: { opacity: 0, y: 16 },
      show: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 280, damping: 26 },
      },
    };
  }, [prefersReducedMotion]);

  return (
    <div className="mastery-container">
      <header className="mastery-header">
        <div>
          <h2 className="mastery-title title-sparkle-effect">
            <Activity size={26} className="page-title-icon" />
            SRS Diagnostics
          </h2>
          <p className="mastery-subtitle">Spaced-repetition performance mapped to real review behavior.</p>
        </div>
      </header>
      
      <motion.div 
        className="mastery-content"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Top Stats Grid */}
        <section className="stats-grid">
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Flame size={20} color="#ffaa00" /></div>
            <div className="stat-data">
              <h3>{streak.current || 0} Days</h3>
              <p>Active Streak</p>
            </div>
          </motion.div>
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Target size={20} color="#00ffaa" /></div>
            <div className="stat-data">
              <h3>{toPercent(retention)}</h3>
              <p>Retention Rate</p>
            </div>
          </motion.div>
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Brain size={20} color="var(--primary)" /></div>
            <div className="stat-data">
              <h3>{matureCards}/{totalCards}</h3>
              <p>Mature Cards</p>
            </div>
          </motion.div>
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Activity size={20} color="#ff00aa" /></div>
            <div className="stat-data">
              <h3>{loadState}</h3>
              <p>Due Today: {dueToday}</p>
            </div>
          </motion.div>
        </section>

        <section className="stats-grid stats-grid-3">
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Zap size={20} color="#38bdf8" /></div>
            <div className="stat-data">
              <h3>{lifetimeReviews}</h3>
              <p>Total Reviews</p>
            </div>
          </motion.div>
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Activity size={20} color="#a3e635" /></div>
            <div className="stat-data">
              <h3>{studyHours}h</h3>
              <p>Focused Study</p>
            </div>
          </motion.div>
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Brain size={20} color="#f97316" /></div>
            <div className="stat-data">
              <h3>{avgInterval.toFixed(1)}d</h3>
              <p>Average Interval</p>
            </div>
          </motion.div>
        </section>

        {/* Charts Section */}
        <section className="charts-section">
          <React.Suspense
            fallback={
              <>
                <motion.div className="chart-card wide" variants={itemVariants}>
                  <div className="chart-header">
                    <Zap size={16} />
                    <h4>Loading Review Trends...</h4>
                  </div>
                </motion.div>
                <motion.div className="chart-card" variants={itemVariants}>
                  <div className="chart-header">
                    <Brain size={16} />
                    <h4>Loading Learning Vector...</h4>
                  </div>
                </motion.div>
              </>
            }
          >
            <MasteryChartsSection
              activityData={activityData}
              qualityVector={qualityVector}
              itemVariants={itemVariants}
            />
          </React.Suspense>
        </section>

        <section className="stats-grid stats-grid-3">
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Target size={20} color="#34d399" /></div>
            <div className="stat-data">
              <h3>{lapsesCount}/{totalRatings}</h3>
              <p>Lapses vs Total Ratings</p>
            </div>
          </motion.div>
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Flame size={20} color="#f59e0b" /></div>
            <div className="stat-data">
              <h3>{streak.best || 0} Days</h3>
              <p>Best Streak</p>
            </div>
          </motion.div>
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon-wrapper"><Activity size={20} color="#c084fc" /></div>
            <div className="stat-data">
              <h3>{trackedCardsCount}</h3>
              <p>Tracked Cards</p>
            </div>
          </motion.div>
        </section>
      </motion.div>
    </div>
  );
}

