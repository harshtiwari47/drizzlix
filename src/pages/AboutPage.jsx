import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BrainCircuit, WandSparkles, Zap, BarChart3, ArrowRight
} from 'lucide-react';
import './InfoPage.css';

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 80, damping: 20 } },
};

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const VALUES = [
  {
    icon: <BrainCircuit size={20} aria-hidden="true" />,
    title: 'Science-first',
    text: 'Every feature — from SM-2 scheduling to active recall prompts — is grounded in peer-reviewed cognitive science, not dark patterns.',
    accent: '#38bdf8',
  },
  {
    icon: <WandSparkles size={20} aria-hidden="true" />,
    title: 'Radically simple',
    text: "The most powerful study system in the world is useless if it's too complicated to open. We obsess over removing friction.",
    accent: '#818cf8',
  },
  {
    icon: <Zap size={20} aria-hidden="true" />,
    title: 'AI as a tool, not a crutch',
    text: 'We use Gemini to handle the tedious parts — card generation, rephrasing, quiz synthesis — so your attention goes to actually learning.',
    accent: '#a78bfa',
  },
  {
    icon: <BarChart3 size={20} aria-hidden="true" />,
    title: 'Transparent by default',
    text: 'Your data is yours. Our analytics surface insights, never surveill. We will never sell your content or training data to third parties.',
    accent: '#34d399',
  },
];

const FEATURES_BRIEF = [
  { label: 'AI-powered deck generation', sub: 'Paste notes → instant flashcards' },
  { label: 'SM-2 spaced repetition',     sub: 'Optimal review scheduling' },
  { label: 'Neural Breakdown quizzes',    sub: 'Micro-quizzes from any card answer' },
  { label: 'Pomodoro timer',              sub: 'Built-in focus sessions' },
  { label: 'Mastery analytics',           sub: 'Streaks, accuracy, weak-card detection' },
  { label: 'Discover public decks',       sub: 'Community-shared study material' },
  { label: 'Offline-ready',              sub: 'LocalStorage sync, no signal needed' },
  { label: 'Accessibility-first',        sub: 'Dyslexia font, high contrast, font scaling' },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="info-page">
      <div className="info-orb top" aria-hidden="true" />
      <div className="info-orb bottom" aria-hidden="true" />

      {/* Topbar */}
      <header className="info-topbar">
        <Link to="/" className="info-back">
          <span className="info-back-icon" aria-hidden="true">←</span>
          Drizzlix
        </Link>
        <nav className="info-subnav" aria-label="Legal pages">
          <Link className="info-subnav-link" to="/privacy">Privacy</Link>
          <Link className="info-subnav-link" to="/terms">Terms</Link>
          <Link className="info-subnav-link" to="/about">About</Link>
        </nav>
      </header>

      {/* Hero */}
      <motion.section
        className="about-hero"
        variants={STAGGER}
        initial="hidden"
        animate="show"
      >
        <motion.span variants={FADE_UP} className="info-page-badge">About</motion.span>
        <motion.h1 variants={FADE_UP} className="about-h1">
          Built for people who take<br />
          <span className="about-gradient">learning seriously.</span>
        </motion.h1>
        <motion.p variants={FADE_UP} className="about-lead">
          Drizzlix is an AI-powered flashcard and spaced repetition platform
          designed to make deep, lasting learning feel effortless — for
          students, researchers, and lifelong learners.
        </motion.p>
        <motion.div variants={FADE_UP}>
          <button
            type="button"
            className="about-cta"
            onClick={() => navigate('/login')}
          >
            Start studying free <ArrowRight size={15} aria-hidden="true" />
          </button>
        </motion.div>
      </motion.section>

      {/* Mission */}
      <motion.section
        className="about-section about-mission"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6 }}
      >
        <div className="about-mission-inner">
          <h2>The mission</h2>
          <p>
            Most students spend hundreds of hours re-reading notes that vanish
            from memory within days — not because they aren't trying, but
            because passive study does not produce durable knowledge. Drizzlix
            exists to change that.
          </p>
          <p>
            We combined two of the most evidence-backed techniques in cognitive
            science — <strong>active recall</strong> and{' '}
            <strong>spaced repetition</strong> — with the generative power of
            Gemini AI to create a system that does the hard scaffolding for you,
            so you can spend every minute actually learning.
          </p>
        </div>
        <div className="about-mission-stat-grid" aria-label="Platform numbers">
          {[
            { num: '50K+', label: 'Decks created' },
            { num: '2M+', label: 'Cards generated' },
            { num: '94%', label: 'Retention rate' },
            { num: '8+', label: 'Core features' },
          ].map((s) => (
            <div key={s.label} className="about-stat">
              <span className="about-stat-num">{s.num}</span>
              <span className="about-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Values */}
      <section className="about-section">
        <motion.h2
          className="about-section-title"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          What we stand for
        </motion.h2>
        <div className="about-values-grid">
          {VALUES.map((v) => (
            <motion.div
              key={v.title}
              className="about-value-card"
              style={{ '--val-accent': v.accent }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.45 }}
            >
              <div className="about-val-icon" style={{ color: v.accent }}>
                {v.icon}
              </div>
              <h3>{v.title}</h3>
              <p>{v.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature list */}
      <motion.section
        className="about-section about-feature-list"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="about-section-title">Everything in Drizzlix</h2>
        <ul className="about-features-ul" aria-label="Complete feature list">
          {FEATURES_BRIEF.map((f) => (
            <li key={f.label} className="about-feature-item">
              <span className="about-feat-dot" aria-hidden="true" />
              <span>
                <strong>{f.label}</strong>
                <span className="about-feat-sub"> — {f.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Tech stack */}
      <motion.section
        className="about-section about-tech"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="about-section-title">Built with</h2>
        <div className="about-tech-grid">
          {[
            { name: 'React 19', note: 'Frontend SPA' },
            { name: 'Vite 8', note: 'Build tooling' },
            { name: 'Framer Motion', note: 'Animations' },
            { name: 'Express.js', note: 'REST API' },
            { name: 'MongoDB', note: 'Database' },
            { name: 'Google Gemini 2.5', note: 'AI engine' },
          ].map((t) => (
            <div key={t.name} className="about-tech-chip">
              <span className="about-tech-name">{t.name}</span>
              <span className="about-tech-note">{t.note}</span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section
        className="about-bottom-cta"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <h2>Ready to upgrade your memory?</h2>
        <p>Free to start. No credit card. Generate your first deck in 30 seconds.</p>
        <button
          type="button"
          className="about-cta"
          onClick={() => navigate('/login')}
        >
          Get started free <ArrowRight size={15} aria-hidden="true" />
        </button>
      </motion.section>
    </div>
  );
}

