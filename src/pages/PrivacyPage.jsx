import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import './InfoPage.css';

const LAST_UPDATED = 'April 2, 2026';

const SECTIONS = [
  {
    id: 'overview',
    title: '1. Overview',
    content: `Drizzlix ("we", "us", or "our") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application at drizzlix.app.

Please read this policy carefully. By using Drizzlix you agree to the practices described here.`,
  },
  {
    id: 'collection',
    title: '2. Information We Collect',
    content: [
      {
        sub: 'Account data',
        text: 'When you create an account we collect your username, email address, and a hashed version of your password.',
      },
      {
        sub: 'Content data',
        text: 'Flashcard decks, notes, tasks, and other content you create or import are stored to deliver the service.',
      },
      {
        sub: 'Usage data',
        text: 'We collect aggregate analytics about how features are used (pages visited, button clicks, study session duration) to improve the product. This data is never sold.',
      },
      {
        sub: 'Profile data',
        text: 'Optional profile picture (max 2 MB), display name, and bio you choose to add.',
      },
    ],
  },
  {
    id: 'use',
    title: '3. How We Use Your Information',
    bullets: [
      'Provide, operate, and improve Drizzlix features',
      'Authenticate your account and keep it secure via JWT tokens',
      'Sync your decks and study progress across sessions',
      'Send transactional emails (password reset, account notices) — no marketing without opt-in',
      'Detect and prevent abuse, fraud, or security incidents',
    ],
  },
  {
    id: 'sharing',
    title: '4. Sharing & Disclosure',
    content: `We do not sell your personal data. We share information only in these limited circumstances:

• Service providers: hosting infrastructure (MongoDB Atlas), AI API providers (Google Gemini). Each bound by data-processing agreements.
• Legal requirements: if required by law, court order, or to protect the rights, property, or safety of Drizzlix or its users.
• Business transfer: in the event of a merger, acquisition, or asset sale, users will be notified before data is transferred.`,
  },
  {
    id: 'retention',
    title: '5. Data Retention',
    content: `Account data is retained for as long as your account is active. You may delete your account at any time from Settings → Account → Delete Account. Upon deletion, all personal data is permanently removed within 30 days, except where retention is required by law.`,
  },
  {
    id: 'security',
    title: '6. Security',
    content: `We implement industry-standard safeguards: HTTPS everywhere, bcrypt password hashing, JWT authentication with 7-day expiry, and limited data access within our team. No method of transmission over the Internet is 100% secure, however, and we cannot guarantee absolute security.`,
  },
  {
    id: 'rights',
    title: '7. Your Rights',
    bullets: [
      'Access: request a copy of the personal data we hold about you',
      'Correction: update inaccurate data via your Profile settings',
      'Deletion: delete your account and all associated data',
      'Portability: export your decks as JSON at any time from Settings',
      'Objection: contact us to object to specific processing activities',
    ],
  },
  {
    id: 'cookies',
    title: '8. Cookies & Local Storage',
    content: `Drizzlix uses browser localStorage to store your authentication token and user preferences (theme, font settings). We do not use third-party advertising or tracking cookies.`,
  },
  {
    id: 'children',
    title: '9. Children\'s Privacy',
    content: `Drizzlix is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such data, please contact us immediately.`,
  },
  {
    id: 'changes',
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page with an updated date and, where appropriate, by email. Your continued use of Drizzlix after changes constitutes acceptance.`,
  },
  {
    id: 'contact',
    title: '11. Contact Us',
    content: `Questions about this Privacy Policy? Reach us at privacy@drizzlix.app`,
  },
];

function InfoSection({ section }) {
  return (
    <motion.section
      className="info-section"
      id={section.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <h2>{section.title}</h2>
      {typeof section.content === 'string' && (
        <p className="info-para">{section.content}</p>
      )}
      {Array.isArray(section.content) && (
        <dl className="info-dl">
          {section.content.map((item) => (
            <div key={item.sub} className="info-dl-item">
              <dt>{item.sub}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {section.bullets && (
        <ul className="info-bullets">
          {section.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="info-page">
      {/* Glow orbs */}
      <div className="info-orb top" aria-hidden="true" />
      <div className="info-orb bottom" aria-hidden="true" />

      {/* Top nav strip */}
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

      <div className="info-layout">
        {/* Sidebar TOC */}
        <aside className="info-toc" aria-label="Table of contents">
          <p className="info-toc-label">On this page</p>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="info-toc-link">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main content */}
        <main className="info-main">
          <motion.div
            className="info-hero"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="info-page-badge">Legal</span>
            <h1>Privacy Policy</h1>
            <p className="info-updated">Last updated: {LAST_UPDATED}</p>
            <p className="info-lead">
              Your data belongs to you. Here is exactly what we collect, why we
              collect it, and how you can control it.
            </p>
          </motion.div>

          {SECTIONS.map((section) => (
            <InfoSection key={section.id} section={section} />
          ))}
        </main>
      </div>
    </div>
  );
}

