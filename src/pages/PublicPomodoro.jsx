import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Timer, ArrowRight, BrainCircuit, BarChart3, Focus } from 'lucide-react';
import SEOMeta from '../components/SEOMeta';
import './Landing.css';

export default function PublicPomodoro() {
  const location = useLocation();

  return (
    <div className="landing-page dark-theme">
      {/* 
        Self-Referencing Canonical is handled by SEOMeta matching this route.
        The FAQ schema is injected directly via SEOMeta for standard JSON-LD.
      */}
      
      <div className="glow-orb top-left" aria-hidden="true" />
      <div className="glow-orb center-mid" aria-hidden="true" />

      <header className="landing-topbar glass-panel">
        <div className="landing-brand">
          <div className="brand-icon">
            <img src="/favicon.svg" alt="Drizzlix logo" width="24" height="24" />
          </div>
          <Link to="/" style={{color:'inherit', textDecoration:'none'}}>Drizzlix</Link>
        </div>
        <nav className="topbar-nav" aria-label="Site navigation">
          <Link className="topbar-link" to="/features/notes">AI Notes</Link>
          <Link className="topbar-link" to="/features/tasks">Smart Tasks</Link>
        </nav>
        <div className="topbar-actions">
          <Link className="topbar-link" to="/login">Log in</Link>
          <Link to="/login" className="modern-button primary-btn small-btn">
            Start Free <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="landing-main">
        <section className="hero-section" style={{ textAlign: 'center', alignItems: 'center' }}>
          <div className="hero-text-col" style={{ alignItems: 'center' }}>
            <h1 className="hero-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1 }}>
              Integrated Pomodoro Timer <br />
              <span className="hero-gradient-text">for Deep Focus Studies</span>
            </h1>
            <p className="hero-sub" style={{ maxWidth: '800px', margin: '0 auto' }}>
              Stop breaking your concentration. Maximize your study efficiency and beat procrastination by combining the proven Pomodoro Technique with Drizzlix's advanced AI-powered spaced repetition flashcards. Lock in deep work states, manage burnout, and comprehensively track your mastery metrics all in one unified dashboard.
            </p>
            <div className="hero-actions" style={{ justifyContent: 'center' }}>
              <Link to="/login" className="modern-button primary-btn large-btn">
                Launch Focus Timer
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="workflow-section">
          <div className="section-header">
            <h2>The Science of Structured Focus</h2>
            <div className="bento-text" style={{maxWidth: '800px', margin: '0 auto', fontSize: '1.2rem', lineHeight: 1.6, textAlign: 'left'}}>
              <p style={{marginBottom: '1rem'}}>
                The Drizzlix Pomodoro Timer isn't just a basic on-screen clock widget. It is an intelligent, reactive focus environment deeply integrated into your active cognitive sessions. Our system automatically structures your workflow into 25-minute sprints of maximum cognitive load, directly followed by 5-minute structured break intervals designed to consolidate memory and prevent mental fatigue.
              </p>
              <p>
                When you initiate a study session, the <Link to="/features/notes" style={{color: '#818cf8'}}>AI flashcards engine</Link> syncs seamlessly. The moment a rest period hits, the active review pauses automatically. This guarantees you aren't interrupted mid-thought, but it also strictly enforces downtime to protect your brain from burnout over long, 8-hour study blocks.
              </p>
            </div>
          </div>
        </section>

        {/* Benefits & Features Bento */}
        <section className="bento-section">
          <div className="section-header">
            <h2>Built Specifically for Deep Work</h2>
            <p>Everything you need to eliminate distraction and lock in retention.</p>
          </div>
          <div className="bento-grid">
            <article className="bento-card bento-pomo" style={{'--card-glow': 'rgba(251,191,36,0.12)', '--card-accent': '#fbbf24'}}>
              <div className="bento-icon" style={{color: '#fbbf24'}}><Timer size={20}/></div>
              <h3 className="bento-title">Smart Focus Intervals</h3>
              <p className="bento-text">Automatically transitions between deep focus, short mental breaks, and mandatory long breaks based on how many continuous cycles you’ve successfully completed. Fully customizable to fit your exact stamina thresholds.</p>
            </article>
            <article className="bento-card bento-sm2" style={{'--card-glow': 'rgba(56,189,248,0.14)', '--card-accent': '#38bdf8'}}>
              <div className="bento-icon" style={{color: '#38bdf8'}}><BrainCircuit size={20}/></div>
              <h3 className="bento-title">Spaced Repetition Sync</h3>
              <p className="bento-text">Unlike standalone timer apps, this tool communicates directly with your SM-2 flashcard deck. Ensure that you are completing your critically expiring daily reviews while strictly adhering to scientifically proven Pomodoro boundaries.</p>
            </article>
            <article className="bento-card bento-analytics" style={{'--card-glow': 'rgba(52,211,153,0.14)', '--card-accent': '#34d399'}}>
              <div className="bento-icon" style={{color: '#34d399'}}><BarChart3 size={20}/></div>
              <h3 className="bento-title">Granular Focus Analytics</h3>
              <p className="bento-text">Visualize your most productive hours throughout the week. Track precisely how much time you dedicate to your <Link to="/features/tasks" style={{color: '#34d399'}}>Smart Study Tasks</Link> versus passive reading or direct active recall flashcard reviews.</p>
            </article>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="workflow-section">
          <div className="section-header">
            <h2>Why Traditional Pomodoro Apps Fail Students</h2>
            <div className="bento-text" style={{maxWidth: '800px', margin: '0 auto', textAlign: 'left', lineHeight: 1.8}}>
              <p>
                Using a generic timer app (or a physical kitchen timer) alongside a separate flashcard application forces context switching. Every time the timer goes off, you have to manually pause your flashcards, resulting in friction that often breaks flow states. Furthermore, standalone timers cannot measure <i>what</i> you were doing.
              </p>
              <br/>
              <p>
                The Drizzlix ecosystem solves this by measuring <strong>active study time vs idle time</strong>. Because the timer is directly hooked into the active recall interface, we know exactly when you are answering questions. This provides you with ultra-accurate analytics that distinguish between "time spent sitting at the desk" versus "time spent actively forming neural pathways."
              </p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="workflow-section">
          <div className="section-header">
            <h2>Who Relies on Our Pomodoro System?</h2>
            <div className="bento-text" style={{maxWidth: '800px', margin: '0 auto', textAlign: 'left', lineHeight: 1.8}}>
              <ul>
                <li><strong style={{color:'#fff'}}>Medical and Law Students:</strong> Managing exhaustive pharmacology, anatomy, and case law decks requires intense pacing. The integrated timer ensures you get mandatory eye-rest to prevent exhaustion over a 10-hour study day, allowing you to retain massive volumes of rote memorization.</li>
                <li><strong style={{color:'#fff'}}>Language Learners:</strong> Pairing vocabulary acquisition through AI flashcards with aggressive 25-minute sprints drastically improves recall. The rigid time constraint forces you to learn actively rather than passively scrolling.</li>
                <li><strong style={{color:'#fff'}}>Software Engineers:</strong> Programmers studying LeetCode patterns use the Pomodoro timer to enforce a strict "20-minute struggle limit" on complex algorithmic problems prior to checking the AI-generated solution.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="workflow-section" id="faq">
          <div className="section-header">
            <h2>Frequently Asked Questions</h2>
            <div className="bento-text" style={{maxWidth: '800px', margin: '0 auto', textAlign: 'left'}}>
              
              <div style={{marginBottom: '2rem'}}>
                <h3 style={{color:'#fff', marginBottom: '0.5rem'}}>How does the Pomodoro Timer integrate with active recall?</h3>
                <p>The timer communicates directly with the Drizzlix SM-2 spaced repetition engine. During a 25-minute focus session, you are presented with high-priority flashcards. When the timer hits a 5-minute break, the study session safely pauses without losing progress.</p>
              </div>

              <div style={{marginBottom: '2rem'}}>
                <h3 style={{color:'#fff', marginBottom: '0.5rem'}}>Can I configure the Pomodoro intervals?</h3>
                <p>Yes. Drizzlix allows you to customize focus durations from 15 to 60 minutes, short breaks from 3 to 15 minutes, and long breaks from 15 to 30 minutes, adapting to your specific cognitive load threshold and attention span.</p>
              </div>
              
              <div style={{marginBottom: '2rem'}}>
                <h3 style={{color:'#fff', marginBottom: '0.5rem'}}>Is the Pomodoro feature free to use?</h3>
                <p>Yes, the core timer and its synchronization with your flashcard study queues are entirely free. Advanced historical analytics tracking study efficiency across months may be part of premium tiers.</p>
              </div>

            </div>
          </div>
        </section>

      </main>

      <footer className="landing-footer">
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Drizzlix · Built for deep work</p>
        </div>
      </footer>
    </div>
  );
}
