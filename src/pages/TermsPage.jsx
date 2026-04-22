import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import './InfoPage.css';

const LAST_UPDATED = 'April 2, 2026';

const SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using Drizzlix ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service. We reserve the right to update these Terms at any time; continued use after changes constitutes acceptance.`,
  },
  {
    id: 'account',
    title: '2. Your Account',
    bullets: [
      'You must be at least 13 years old to use Drizzlix.',
      'You are responsible for maintaining the confidentiality of your login credentials.',
      'You must provide accurate, current, and complete information when creating an account.',
      'You are solely responsible for all activity that occurs under your account.',
      'Notify us immediately at security@drizzlix.app of any unauthorised use.',
    ],
  },
  {
    id: 'use',
    title: '3. Acceptable Use',
    content: `You agree not to misuse the Service. Prohibited activities include:`,
    bullets: [
      'Violating any applicable laws or regulations',
      'Uploading malicious code, viruses, or harmful content',
      'Attempting to reverse-engineer, decompile, or scrape the platform',
      'Impersonating another person or entity',
      'Using the AI features to generate deceptive, harmful, or illegal content',
      'Attempting to circumvent our rate limits, authentication, or security controls',
      'Accessing the Service through automated means without prior written consent',
    ],
  },
  {
    id: 'content',
    title: '4. Your Content',
    content: `You retain ownership of all content (flashcards, notes, decks) you create. By using Drizzlix, you grant us a limited, worldwide, non-exclusive, royalty-free licence to store, process, and display your content solely for the purpose of providing and improving the Service. We will never sell your content or use it to train external AI models without explicit written consent.`,
  },
  {
    id: 'ai',
    title: '5. AI-Generated Content',
    content: `Drizzlix uses Google Gemini to generate flashcards, quizzes, and study content. AI-generated content may contain inaccuracies. You are responsible for verifying the accuracy of AI-generated content before relying on it for academic or professional purposes. We make no warranties regarding the accuracy, completeness, or fitness of AI-generated content.`,
  },
  {
    id: 'ip',
    title: '6. Intellectual Property',
    content: `The Drizzlix name, logo, design system, and underlying technology are owned by Drizzlix and protected by applicable intellectual property laws. Nothing in these Terms grants you a right to use our trademarks, service marks, or trade names.`,
  },
  {
    id: 'termination',
    title: '7. Termination',
    content: `We may suspend or terminate your access to Drizzlix at our sole discretion, with or without notice, for conduct that violates these Terms or is otherwise harmful. You may delete your account at any time from Settings → Account. Upon termination, your right to use the Service ceases immediately.`,
  },
  {
    id: 'disclaimers',
    title: '8. Disclaimers',
    content: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.

We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components. Educational outcomes depend on individual effort and are not guaranteed.`,
  },
  {
    id: 'liability',
    title: '9. Limitation of Liability',
    content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, DRIZZLIX AND ITS AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR DATA, ARISING FROM YOUR USE OF THE SERVICE.

Our total liability for any claim arising from or related to the Service shall not exceed the amount you paid us in the twelve (12) months preceding the claim, or USD $10 if you have not made any payments.`,
  },
  {
    id: 'governing',
    title: '10. Governing Law',
    content: `These Terms are governed by the laws of India, without regard to its conflict-of-law principles. Any disputes shall be subject to the exclusive jurisdiction of the courts located in Mumbai, Maharashtra, India.`,
  },
  {
    id: 'contact',
    title: '11. Contact',
    content: `Questions about these Terms? Contact us at legal@drizzlix.app`,
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

export default function TermsPage() {
  return (
    <div className="info-page">
      <div className="info-orb top" aria-hidden="true" />
      <div className="info-orb bottom" aria-hidden="true" />

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

        <main className="info-main">
          <motion.div
            className="info-hero"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="info-page-badge">Legal</span>
            <h1>Terms of Service</h1>
            <p className="info-updated">Last updated: {LAST_UPDATED}</p>
            <p className="info-lead">
              Please read these terms carefully before using Drizzlix. They
              define our mutual obligations and protect both you and us.
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

