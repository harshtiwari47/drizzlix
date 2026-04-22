import { Link, useNavigate } from 'react-router-dom';
import { motion, animate, useInView } from 'framer-motion';
import { useEffect, useRef, useState, Fragment } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Sparkles,
  WandSparkles,
  Timer,
  BarChart3,
  Zap,
  RotateCcw,
} from 'lucide-react';
import './Landing.css';

// ─── Demo Card Content ───────────────────────────────────────────────────────
const DEMO_CARDS = [
  {
    front: 'What is the SM-2 algorithm?',
    back: 'An adaptive scheduling algorithm that updates each card\'s ease factor, repetition count, and review interval based on Hard / Good / Easy ratings.',
    deck: 'Cognitive Science',
    tag: 'Memory Systems',
    cardNum: '3',
    deckTotal: '12',
  },
  {
    front: 'Define neuroplasticity.',
    back: 'The brain\'s capacity to reorganise itself by forming new synaptic connections throughout life in response to learning and experience.',
    deck: 'Neuroscience 101',
    tag: 'Core Concepts',
    cardNum: '7',
    deckTotal: '20',
  },
  {
    front: 'What is active recall?',
    back: 'A study technique where you deliberately retrieve information from memory rather than passively re-reading — one of the highest-yield learning methods.',
    deck: 'Study Techniques',
    tag: 'Methods',
    cardNum: '2',
    deckTotal: '8',
  },
];

// ─── Live Flashcard Demo ─────────────────────────────────────────────────────
function LiveFlashcardDemo() {
  const [cardIdx, setCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const prefersReduced = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (prefersReduced.current) return;

    const flipT = setTimeout(() => setIsFlipped(true), 2800);

    const nextT = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setCardIdx((p) => (p + 1) % DEMO_CARDS.length);
        setIsFlipped(false);
        setIsExiting(false);
      }, 380);
    }, 5200);

    return () => {
      clearTimeout(flipT);
      clearTimeout(nextT);
    };
  }, [cardIdx]);

  const card = DEMO_CARDS[cardIdx];
  const progressPct = ((cardIdx + 1) / DEMO_CARDS.length) * 100;

  return (
    <div
      className="demo-wrapper"
      role="img"
      aria-label="Animated flashcard demonstration"
    >
      {/* Animated gradient border ring */}
      <div className="demo-ring" aria-hidden="true" />

      {/* Inner surface */}
      <div className="demo-inner-surface">

        {/* Header bar */}
        <div className="demo-header">
          <div className="demo-header-left">
            <span className="demo-deck-dot" aria-hidden="true" />
            <span className="demo-deck-name">{card.deck}</span>
          </div>
          <span className="demo-tag">{card.tag}</span>
        </div>

        {/* Card flip scene */}
        <div className={`demo-scene${isExiting ? ' demo-exiting' : ''}`}>
          <div className={`demo-card-inner${isFlipped ? ' flipped' : ''}`}>

            {/* Front face */}
            <div className="demo-face demo-front">
              <div className="demo-face-stripe front-stripe" aria-hidden="true" />
              <p className="demo-face-label">Question</p>
              <p className="demo-question-text">{card.front}</p>
              <div className="demo-reveal-hint" aria-hidden="true">
                <RotateCcw size={12} />
                <span>flip to reveal</span>
              </div>
            </div>

            {/* Back face */}
            <div className="demo-face demo-back">
              <div className="demo-face-stripe back-stripe" aria-hidden="true" />
              <p className="demo-face-label">Answer</p>
              <p className="demo-answer-text">{card.back}</p>
            </div>

          </div>
        </div>

        {/* Progress bar */}
        <div className="demo-prog-track" aria-hidden="true">
          <div
            className="demo-prog-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Rating buttons */}
        <div className="demo-rating-row" aria-hidden="true">
          <button className="demo-rate hard" tabIndex="-1" type="button">
            <span className="rate-dot" aria-hidden="true" />Hard
          </button>
          <button className="demo-rate good" tabIndex="-1" type="button">
            <span className="rate-dot" aria-hidden="true" />Good
          </button>
          <button className="demo-rate easy" tabIndex="-1" type="button">
            <span className="rate-dot" aria-hidden="true" />Easy
          </button>
        </div>

        {/* Footer: card count + pips */}
        <div className="demo-footer" aria-hidden="true">
          <span>Card {card.cardNum} of {card.deckTotal}</span>
          <div className="demo-pips">
            {DEMO_CARDS.map((_, i) => (
              <span
                key={i}
                className={`demo-pip${i === cardIdx ? ' active' : i < cardIdx ? ' done' : ''}`}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}


// ─── Animated Stat Counter ───────────────────────────────────────────────────
function StatCounter({ target, suffix = '', label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(0, target, {
      duration: 2.2,
      ease: 'easeOut',
      onUpdate: (v) => setCount(Math.floor(v)),
    });
    return ctrl.stop;
  }, [inView, target]);

  return (
    <div className="stat-block" ref={ref}>
      <span className="stat-num" aria-live="polite">
        {count.toLocaleString()}{suffix}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

// ─── Bento Features ──────────────────────────────────────────────────────────
const BENTO = [
  {
    id: 'ai',
    icon: <WandSparkles size={20} aria-hidden="true" />,
    title: 'AI Card Generation',
    text: 'Paste notes, a topic prompt, or upload a PDF. Gemini synthesises exam-ready flashcards with LaTeX, code blocks, and rich markdown in seconds.',
    glow: 'rgba(99,102,241,0.18)',
    accent: '#818cf8',
  },
  {
    id: 'sm2',
    icon: <BrainCircuit size={18} aria-hidden="true" />,
    title: 'Spaced Repetition',
    text: 'SM-2 schedules every card at the precise moment before you forget — so no revision session is wasted.',
    glow: 'rgba(56,189,248,0.14)',
    accent: '#38bdf8',
  },
  {
    id: 'quiz',
    icon: <Zap size={18} aria-hidden="true" />,
    title: 'Neural Breakdown',
    text: 'Generate targeted micro-quizzes from any card\'s answer and inject them directly into your active study queue.',
    glow: 'rgba(167,139,250,0.16)',
    accent: '#a78bfa',
  },
  {
    id: 'pomo',
    icon: <Timer size={18} aria-hidden="true" />,
    title: 'Pomodoro Timer',
    text: 'Built-in focus timer with work/break cycles and persistent session history.',
    glow: 'rgba(251,191,36,0.12)',
    accent: '#fbbf24',
  },
  {
    id: 'analytics',
    icon: <BarChart3 size={18} aria-hidden="true" />,
    title: 'Mastery Analytics',
    text: 'Track accuracy, streaks, weak cards, and study time across every deck. Know exactly where your attention should go.',
    glow: 'rgba(52,211,153,0.14)',
    accent: '#34d399',
  },
];

// ─── Workflow Steps ──────────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    title: 'Input Your Material',
    text: 'Paste notes, type a topic, or upload a PDF. Any subject, any depth.',
  },
  {
    num: '02',
    title: 'AI Builds Your Deck',
    text: 'Gemini extracts key concepts and generates precise question-answer pairs with rich formatting.',
  },
  {
    num: '03',
    title: 'Revise & Master',
    text: 'SM-2 spaces your reviews to the optimal interval, locking knowledge into long-term memory.',
  },
];

// ─── Framer Motion Variants ──────────────────────────────────────────────────
const FADE_UP = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 85, damping: 20 },
  },
};

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const STAGGER_FAST = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const goToLogin = () => navigate('/login');

  return (
    <div className="landing-page dark-theme">
      {/* Ambient glow orbs */}
      <div className="glow-orb top-left" aria-hidden="true" />
      <div className="glow-orb bottom-right" aria-hidden="true" />
      <div className="glow-orb center-mid" aria-hidden="true" />

      {/* ══════════════ TOPBAR ══════════════ */}
      <motion.header
        className="landing-topbar glass-panel"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <div className="landing-brand">
          <div className="brand-icon">
            <img src="/favicon.svg" alt="Drizzlix logo" width="24" height="24" />
          </div>
          <span>Drizzlix</span>
        </div>

        <nav className="topbar-nav" aria-label="Site navigation">
          <a className="topbar-link" href="#features">Features</a>
          <Link className="topbar-link" to="/discover">Discover</Link>
        </nav>

        <div className="topbar-actions">
          <Link className="topbar-link" to="/login">Log in</Link>
          <button
            type="button"
            id="topbar-cta"
            className="modern-button primary-btn small-btn"
            onClick={goToLogin}
          >
            Start free <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </motion.header>

      <main className="landing-main">

        {/* ══════════════ HERO ══════════════ */}
        <section className="hero-section" aria-label="Hero">
          <motion.div
            className="hero-text-col"
            variants={STAGGER}
            initial="hidden"
            animate="show"
          >
            <motion.h1 variants={FADE_UP} className="hero-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1 }}>
              AI Flashcard Generator <br />
              <span className="hero-gradient-text">& Spaced Repetition App</span>
            </motion.h1>

            <motion.p variants={FADE_UP} className="hero-sub" style={{ fontSize: '1.2rem', lineHeight: 1.6 }}>
              Drizzlix actively tests your memory to solve the forgetting curve.
              Upload PDFs to generate <Link to="/features/notes" style={{ color: '#818cf8' }}>AI Flashcards</Link>,
              manage study schedules with <Link to="/features/tasks" style={{ color: '#34d399' }}>Smart Tasks</Link>, and
              build unshakeable focus using the integrated <Link to="/features/pomodoro" style={{ color: '#fbbf24' }}>Pomodoro Timer</Link>.
            </motion.p>


            <motion.div variants={FADE_UP} className="hero-actions">
              <button
                type="button"
                id="hero-cta-primary"
                className="modern-button primary-btn large-btn"
                onClick={goToLogin}
              >
                Start generating free
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <a
                id="hero-cta-secondary"
                className="modern-button secondary-btn large-btn"
                href="#workflow"
              >
                How it works
              </a>
            </motion.div>

            <motion.ul variants={FADE_UP} className="hero-trust" aria-label="Key benefits">
              {['Free to start', 'No credit card', 'Generate in seconds'].map((item) => (
                <li key={item} className="trust-item">
                  <span className="trust-dot" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Live card demo */}
          <motion.div
            className="hero-demo-col"
            initial={{ opacity: 0, x: 36, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <LiveFlashcardDemo />
            </motion.div>
          </motion.div>
        </section>

        {/* ══════════════ STATS TICKER ══════════════ */}
        <motion.section
          className="stats-ticker"
          aria-label="Platform statistics"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7 }}
        >
          <StatCounter target={50000} suffix="+" label="Decks created" />
          <div className="ticker-sep" aria-hidden="true" />
          <StatCounter target={2000000} suffix="+" label="Cards generated" />
          <div className="ticker-sep" aria-hidden="true" />
          <StatCounter target={94} suffix="%" label="Avg. retention rate" />
          <div className="ticker-sep" aria-hidden="true" />
          <StatCounter target={30} suffix=" days" label="Longest streak" />
        </motion.section>

        {/* ══════════════ BENTO FEATURES ══════════════ */}
        <motion.section
          className="bento-section"
          id="features"
          aria-label="Features"
          variants={STAGGER_FAST}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div variants={FADE_UP} className="section-header">
            <h2>Everything your brain needs</h2>
            <p>A complete study system. Not just flashcards.</p>
          </motion.div>

          <div className="bento-grid" role="list">
            {BENTO.map((feat) => (
              <motion.article
                key={feat.id}
                variants={FADE_UP}
                role="listitem"
                className={`bento-card bento-${feat.id}`}
                style={{
                  '--card-glow': feat.glow,
                  '--card-accent': feat.accent,
                }}
              >
                <div
                  className="bento-icon"
                  style={{ color: feat.accent }}
                  aria-hidden="true"
                >
                  {feat.icon}
                </div>
                <h3 className="bento-title">{feat.title}</h3>
                <p className="bento-text">{feat.text}</p>
                <div className="bento-glow-layer" aria-hidden="true" />
              </motion.article>
            ))}
          </div>
        </motion.section>

        {/* ══════════════ WORKFLOW ══════════════ */}
        <motion.section
          className="workflow-section"
          id="workflow"
          aria-label="How it works"
          variants={STAGGER}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div variants={FADE_UP} className="section-header">
            <h2>From notes to retention</h2>
            <p>Three steps to a flawless study session.</p>
          </motion.div>

          <div className="workflow-track">
            {STEPS.map((step, i) => (
              <Fragment key={step.num}>
                <motion.div variants={FADE_UP} className="workflow-step">
                  <div className="workflow-step-num" aria-hidden="true">
                    {step.num}
                  </div>
                  <div className="workflow-step-body">
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </motion.div>

                {i < STEPS.length - 1 && (
                  <div className="workflow-connector" aria-hidden="true">
                    <motion.div
                      className="connector-fill"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{
                        delay: 0.35 + i * 0.18,
                        duration: 0.65,
                        ease: 'easeOut',
                      }}
                    />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </motion.section>

        {/* ══════════════ CTA ══════════════ */}
        <motion.section
          className="cta-section"
          aria-label="Sign up call to action"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={FADE_UP}
        >
          {/* Nebula background */}
          <div className="cta-nebula" aria-hidden="true" />

          {/* Floating sparkle particles */}
          {[
            { top: '22%', left: '10%', w: 6, delay: 0 },
            { top: '65%', left: '7%', w: 4, delay: 0.8 },
            { top: '28%', right: '9%', w: 5, delay: 1.3 },
            { top: '72%', right: '12%', w: 7, delay: 0.5 },
            { top: '50%', left: '25%', w: 3, delay: 1.7 },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="cta-sparkle"
              aria-hidden="true"
              style={{
                top: s.top,
                left: s.left,
                right: s.right,
                width: s.w,
                height: s.w,
              }}
              animate={{ y: [-10, 10], opacity: [0.15, 0.65] }}
              transition={{
                duration: 2.8 + i * 0.3,
                repeat: Infinity,
                repeatType: 'mirror',
                delay: s.delay,
              }}
            />
          ))}

          <div className="cta-content">
            <div className="cta-eyebrow">
              <Sparkles size={13} aria-hidden="true" />
              <span>Join thousands of learners</span>
            </div>
            <h2>Your memory. Upgraded.</h2>
            <p>
              Start studying with AI today. Build better habits, retain more,
              and perform at your peak — without cramming.
            </p>
            <button
              type="button"
              id="cta-main-btn"
              className="modern-button primary-btn cta-main-btn"
              onClick={goToLogin}
            >
              Begin for free
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </motion.section>
      </main>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="landing-footer" aria-label="Site footer">
        <div className="footer-inner">

          {/* Brand column */}
          <div className="footer-col footer-brand-col">
            <div className="landing-brand footer-logo">
              <div className="brand-icon">
                <img src="/favicon.svg" alt="Drizzlix logo" width="24" height="24" />
              </div>
              <span>Drizzlix</span>
            </div>
            <p className="footer-tagline">
              AI-powered flashcards and spaced repetition — built for
              people who take learning seriously.
            </p>
            <div className="footer-social" aria-label="Social links">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-link"
                aria-label="Twitter / X"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-link"
                aria-label="GitHub"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="mailto:hello@drizzlix.app"
                className="footer-social-link"
                aria-label="Email us"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product links */}
          <div className="footer-col">
            <p className="footer-col-heading">Product</p>
            <ul className="footer-links" aria-label="Product links">
              <li><Link to="/login" className="footer-link">Get started</Link></li>
              <li><a href="#features" className="footer-link">Features</a></li>
              <li><Link to="/discover" className="footer-link">Discover decks</Link></li>
              <li><Link to="/login" className="footer-link">Study session</Link></li>
              <li><Link to="/login" className="footer-link">Analytics</Link></li>
            </ul>
          </div>

          {/* Learn links */}
          <div className="footer-col">
            <p className="footer-col-heading">Learn</p>
            <ul className="footer-links" aria-label="Learn links">
              <li>
                <a
                  href="https://ncase.me/remember/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link-ext"
                >
                  What is spaced repetition?
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              </li>
              <li>
                <a
                  href="https://gwern.net/spaced-repetition"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link-ext"
                >
                  SM-2 algorithm explained
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              </li>
              <li>
                <a
                  href="https://en.wikipedia.org/wiki/Active_recall"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link-ext"
                >
                  Active recall research
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              </li>
            </ul>
          </div>

          {/* Legal links */}
          <div className="footer-col">
            <p className="footer-col-heading">Company</p>
            <ul className="footer-links" aria-label="Company links">
              <li><Link to="/about" className="footer-link">About</Link></li>
              <li><Link to="/privacy" className="footer-link">Privacy Policy</Link></li>
              <li><Link to="/terms" className="footer-link">Terms of Service</Link></li>
              <li>
                <a href="mailto:hello@drizzlix.app" className="footer-link">
                  Contact us
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom strip */}
        <div className="footer-bottom">
          <p>© 2026 Drizzlix · Built for curious minds</p>
          <p className="footer-bottom-right">
            Powered by{' '} HANVER</p>
        </div>
      </footer>
    </div>
  );
}

