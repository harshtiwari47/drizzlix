import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowRight, Eye, Sparkles, Pin, Search } from 'lucide-react';
import './Landing.css';

export default function PublicNotes() {
  return (
    <div className="landing-page dark-theme">
      <div className="glow-orb top-left" aria-hidden="true" />
      <div className="glow-orb center-mid" aria-hidden="true" />

      <header className="landing-topbar glass-panel">
        <div className="landing-brand">
          <div className="brand-icon">
            <img src="/favicon.svg" alt="Drizzlix logo" width="24" height="24" />
          </div>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>Drizzlix</Link>
        </div>
        <nav className="topbar-nav" aria-label="Site navigation">
          <Link className="topbar-link" to="/features/pomodoro">Focus Timer</Link>
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
              Markdown Notes App with <br />
              <span className="hero-gradient-text">Live Preview, Search, and Offline Sync</span>
            </h1>
            <p className="hero-sub" style={{ maxWidth: '800px', margin: '0 auto' }}>
              Drizzlix Notes is a markdown note-taking workspace for students, self-learners, and technical writers who want clean writing, fast search, pinned references, and reliable offline editing. Write in Markdown, switch between editor and preview, organize notes with categories, and keep working even when your connection drops.
            </p>
            <div className="hero-actions" style={{ justifyContent: 'center' }}>
              <Link to="/login" className="modern-button primary-btn large-btn">
                Start Writing Notes
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="workflow-section">
          <div className="section-header">
            <h2>A Markdown Notes App Built for Real Study Work</h2>
            <div className="bento-text" style={{ maxWidth: '800px', margin: '0 auto', fontSize: '1.2rem', lineHeight: 1.6, textAlign: 'left' }}>
              <p style={{ marginBottom: '1rem' }}>
                Drizzlix Notes is not just another online notebook. It is a focused writing environment designed for people who need to capture ideas clearly, organize them fast, and revisit them without friction. The notes workspace is part of the broader Drizzlix study system, so it fits naturally beside your <Link to="/features/pomodoro" style={{ color: '#fbbf24' }}>focus sessions</Link> and study workflow.
              </p>
              <p>
                The editor supports GitHub-Flavored Markdown, including headings, tables, checklists, fenced code blocks, block quotes, nested lists, and rich formatting for structured notes. The split-screen preview shows formatted output instantly, so your study notes, technical documentation, and class summaries stay readable while you write.
              </p>
            </div>
          </div>
        </section>

        <section className="bento-section">
          <div className="section-header">
            <h2>Key Features for Better Digital Note-Taking</h2>
            <p>Designed for people who want organized notes, faster review, and less friction.</p>
          </div>
          <div className="bento-grid">
            <article className="bento-card bento-ai" style={{ '--card-glow': 'rgba(99,102,241,0.18)', '--card-accent': '#818cf8' }}>
              <div className="bento-icon" style={{ color: '#818cf8' }}><Sparkles size={20} /></div>
              <h3 className="bento-title">Markdown Editor with Autosave</h3>
              <p className="bento-text">Write in a distraction-light markdown editor with fast editing controls, structured formatting, and autosave behavior that keeps your work moving without manual save friction.</p>
            </article>

            <article className="bento-card bento-sm2" style={{ '--card-glow': 'rgba(56,189,248,0.14)', '--card-accent': '#38bdf8' }}>
              <div className="bento-icon" style={{ color: '#38bdf8' }}><Eye size={20} /></div>
              <h3 className="bento-title">Live Markdown Preview</h3>
              <p className="bento-text">Write on one side and preview the formatted result on the other. Switch between editor, preview, or split view depending on whether you are drafting, reviewing, or polishing.</p>
            </article>

            <article className="bento-card bento-quiz" style={{ '--card-glow': 'rgba(52,211,153,0.14)', '--card-accent': '#34d399' }}>
              <div className="bento-icon" style={{ color: '#34d399' }}><Search size={20} /></div>
              <h3 className="bento-title">Categories and Full-Text Search</h3>
              <p className="bento-text">Organize notes by category and filter them quickly with built-in search. Find definitions, formulas, snippets, and reference notes fast when it is time to review. The unified category system ensures you never lose a lecture summary again.</p>
            </article>

            <article className="bento-card bento-pomo" style={{ '--card-glow': 'rgba(250,204,21,0.12)', '--card-accent': '#facc15' }}>
              <div className="bento-icon" style={{ color: '#facc15' }}><Pin size={20} /></div>
              <h3 className="bento-title">Pin Important Notes</h3>
              <p className="bento-text">Keep critical notes at the top of the list so your most-used references stay easy to reach during classes.</p>
            </article>

            <article className="bento-card bento-analytics" style={{ '--card-glow': 'rgba(244,114,182,0.12)', '--card-accent': '#f472b6' }}>
              <div className="bento-icon" style={{ color: '#f472b6' }}><FileText size={20} /></div>
              <h3 className="bento-title">Offline-First Sync</h3>
              <p className="bento-text">Create, edit, and manage notes while offline. Drizzlix stores your changes locally and syncs them automatically when you reconnect, using a conflict-aware merge strategy that keeps your data safe.</p>
            </article>
          </div>
        </section>

        <section className="workflow-section">
          <div className="section-header">
            <h2>Why Drizzlix Notes Works Better for Learning</h2>
            <div className="bento-text" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left', lineHeight: 1.8 }}>
              <p>
                Most note-taking apps help you collect information, but they make everyday note management feel heavier than it should. Search is slow, preview is missing, and offline editing is an afterthought. That leaves people with cluttered notes that are harder to trust and harder to use.
              </p>
              <br />
              <p>
                Drizzlix focuses on the practical workflow: write in markdown, preview instantly, organize notes by category, pin the ones that matter, and keep editing offline. It is built for people who need their notes to stay clean, searchable, and dependable day after day.
              </p>
            </div>
          </div>
        </section>

        <section className="workflow-section">
          <div className="section-header">
            <h2>Who Uses This Notes Workspace?</h2>
            <div className="bento-text" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left', lineHeight: 1.8 }}>
              <ul>
                <li><strong style={{ color: '#fff' }}>Students:</strong> Capture lecture notes, chapter summaries, formulas, and revision guides in one place with cleaner structure and easier review.</li>
                <li><strong style={{ color: '#fff' }}>Engineers and technical writers:</strong> Write documentation with Markdown, code blocks, and structured headings while keeping everything searchable and easy to revisit.</li>
                <li><strong style={{ color: '#fff' }}>Self-learners:</strong> Build organized notes for books, courses, research, or personal study systems without losing track of important references.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="workflow-section" id="faq">
          <div className="section-header">
            <h2>Frequently Asked Questions</h2>
            <div className="bento-text" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Can I use Drizzlix Notes offline?</h3>
                <p>Yes. Drizzlix Notes is built with offline-first syncing, which means you can keep writing and editing notes without an internet connection. Your changes are stored locally and synced when you reconnect.</p>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>What markdown features are supported?</h3>
                <p>Drizzlix supports GitHub-Flavored Markdown, including tables, checklists, fenced code blocks, inline code, headings, quotes, and lists for clean study notes and technical writing.</p>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Can I organize notes by category and pin them?</h3>
                <p>Yes. Drizzlix Notes includes categories, pinning, and search so you can keep important notes visible and find the rest quickly.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Drizzlix · Write to Remember</p>
        </div>
      </footer>
    </div>
  );
}
