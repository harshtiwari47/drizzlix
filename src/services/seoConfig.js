const SITE_NAME = 'Drizzlix';
const normalizeSiteUrl = (value) => String(value || '').trim().replace(/\/+$/, '');
const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_SITE_URL || 'https://drizzlix.vercel.app');
const DEFAULT_IMAGE = '/assets/hero.png';

const baseKeywords = [
  'AI flashcards', 'AI flashcard generator', 'AI study app', 'spaced repetition app',
  'spaced repetition software', 'active recall app', 'online flashcard app',
  'study app for students', 'exam prep flashcards', 'exam prep app',
  'smart revision tool', 'memory retention app', 'adaptive learning app',
  'Anki alternative', 'Drizzlix', 'Drizzlix AI flashcards'
];

const landingTitle = 'Drizzlix | AI Flashcards That Actually Stick';
const landingDescription = 'Build exam-ready flashcards in seconds, study with adaptive spaced repetition, and improve long-term memory with Drizzlix.';

export const organizationSchema = {
  '@type': 'Organization',
  '@id': `${SITE_URL}#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`
};

export const websiteSchema = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}#organization` }
};

const getPageSchema = (title, urlPath) => ({
  '@type': 'WebPage',
  '@id': `${SITE_URL}${urlPath}#webpage`,
  name: title,
  url: `${SITE_URL}${urlPath}`,
  isPartOf: { '@id': `${SITE_URL}#website` }
});

export const softwareSchema = {
  '@type': 'SoftwareApplication',
  name: 'Drizzlix',
  applicationCategory: 'EducationalApplication',
  applicationSubCategory: 'Flashcard Learning Software',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: landingDescription,
  featureList: [
    'AI flashcard generation',
    'Spaced repetition',
    'Pomodoro timer',
    'Smart study tasks'
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  }
};

const faqPomodoroSchema = {
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does the Pomodoro Timer integrate with active recall?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The timer communicates directly with the Drizzlix SM-2 spaced repetition engine. During a 25-minute focus session, you are presented with high-priority flashcards. When the timer hits a 5-minute break, the study session safely pauses without losing progress.'
      }
    },
    {
      '@type': 'Question',
      name: 'Can I configure the Pomodoro intervals?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Drizzlix allows you to customize focus durations from 15 to 60 minutes, short breaks from 3 to 15 minutes, and long breaks from 15 to 30 minutes, adapting to your specific cognitive load threshold and attention span.'
      }
    },
    {
      '@type': 'Question',
      name: 'Is the Pomodoro feature free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, the core timer and its synchronization with your flashcard study queues are entirely free. Advanced historical analytics tracking study efficiency across months may be part of premium tiers.'
      }
    }
  ]
};

const faqNotesSchema = {
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Can I use Drizzlix Notes offline?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Drizzlix Notes uses an offline-first workflow, so your notes can be created and edited without an internet connection and synced later when you reconnect.'
      }
    },
    {
      '@type': 'Question',
      name: 'Does Drizzlix support Markdown notes with live preview?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Drizzlix Notes includes a Markdown editor with real-time preview, support for GitHub-Flavored Markdown, code blocks, lists, tables, and structured formatting for study and technical notes.'
      }
    },
    {
      '@type': 'Question',
      name: 'Can I organize notes by category and pin them?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Drizzlix Notes includes categories, pinning, and search so you can keep important notes visible and find the rest quickly.'
      }
    }
  ]
};

const routeSeoMap = {
  '/': {
    public: { title: landingTitle, description: landingDescription, path: '/', type: 'website', keywords: baseKeywords, schema: [organizationSchema, websiteSchema, softwareSchema, getPageSchema(landingTitle, '/')] },
    private: { title: 'Dashboard | Drizzlix', description: 'Track progress, review flashcards, and continue your study sessions from your dashboard.', path: '/', type: 'website', keywords: ['study dashboard', 'flashcard progress', 'Drizzlix'], robots: 'noindex,follow' }
  },
  '/login': { title: 'Login | Drizzlix', description: 'Sign in to create AI flashcards and start your smart revision sessions.', path: '/login', type: 'website', keywords: ['login', 'AI study app', 'Drizzlix'], robots: 'noindex,follow' },
  '/features/pomodoro': { title: 'Pomodoro Focus Timer | Drizzlix', description: 'Run focused study sprints with Drizzlix Pomodoro sessions integrated directly into spaced repetition.', path: '/features/pomodoro', type: 'website', schema: [organizationSchema, getPageSchema('Pomodoro Focus Timer | Drizzlix', '/features/pomodoro'), faqPomodoroSchema] },
  '/features/notes': {
    title: 'Markdown Notes App with Live Preview | Drizzlix',
    description: 'Write Markdown notes, preview them live, organize them with categories, pin important notes, and keep working offline with Drizzlix.',
    path: '/features/notes',
    type: 'website',
    keywords: [
      ...baseKeywords,
      'markdown notes app',
      'study notes app',
      'markdown editor with live preview',
      'offline notes app',
      'notes app with categories',
      'searchable notes app',
      'online notes for students'
    ],
    schema: [
      organizationSchema,
      getPageSchema('Markdown Notes App with Live Preview | Drizzlix', '/features/notes'),
      faqNotesSchema
    ]
  },
  '/features/tasks': { title: 'Smart Study Tasks | Drizzlix', description: 'Organize priorities and track due dates inside your AI flashcard dashboard.', path: '/features/tasks', type: 'website', schema: [organizationSchema, getPageSchema('Smart Study Tasks | Drizzlix', '/features/tasks')] },
  '/discover': { title: 'Discover Decks | Drizzlix', description: 'Explore curated decks and discover high-quality flashcards for faster learning.', path: '/discover', type: 'website', robots: 'noindex,follow' },
  '/decks': { title: 'Deck Library | Drizzlix', description: 'Browse and organize your flashcard decks in one focused library.', path: '/decks', type: 'website', robots: 'noindex,follow' },
  '/create': { title: 'Create Deck | Drizzlix', description: 'Generate and edit AI flashcards in minutes with advanced deck controls.', path: '/create', type: 'website', robots: 'noindex,follow' },
  '/stats': { title: 'Mastery Analytics | Drizzlix', description: 'Track retention and mastery trends to optimize your study plan.', path: '/stats', type: 'website', robots: 'noindex,follow' },
  '/tasks': { title: 'Tasks | Drizzlix', description: 'Manage study tasks, priorities, and due dates in your Drizzlix workspace.', path: '/tasks', type: 'website', robots: 'noindex,follow' },
  '/notes': { title: 'Notes | Drizzlix', description: 'Capture and organize your study notes inside Drizzlix.', path: '/notes', type: 'website', robots: 'noindex,follow' },
  '/pomodoro': { title: 'Pomodoro Focus Timer | Drizzlix', description: 'Run focused study sprints with Drizzlix Pomodoro sessions.', path: '/pomodoro', type: 'website', robots: 'noindex,follow' },
  '/settings': { title: 'Settings | Drizzlix', description: 'Customize your Drizzlix experience and accessibility settings.', path: '/settings', type: 'website', robots: 'noindex,follow' },
  '/study': { title: 'Study Session | Drizzlix', description: 'Practice with adaptive spaced repetition and reinforce long-term memory.', path: '/study', type: 'website', robots: 'noindex,follow' },
  '/about': { title: 'About Drizzlix | Modern AI Study Tools', description: 'Learn about Drizzlix, our mission to optimize learning, and the team building future flashcards.', path: '/about', type: 'website', schema: [organizationSchema, getPageSchema('About Drizzlix | Modern AI Study Tools', '/about')] },
  '/privacy': { title: 'Privacy Policy | Drizzlix', description: 'Our commitment to protecting your data and your learning progression privacy.', path: '/privacy', type: 'website', schema: [organizationSchema, getPageSchema('Privacy Policy | Drizzlix', '/privacy')] },
  '/terms': { title: 'Terms of Service | Drizzlix', description: 'The terms of service and usage rules for the Drizzlix platform.', path: '/terms', type: 'website', schema: [organizationSchema, getPageSchema('Terms of Service | Drizzlix', '/terms')] }
};

const fallbackSeo = {
  title: 'Drizzlix | AI Flashcards and Smart Revision',
  description: 'Create AI-powered flashcards and study with adaptive repetition to improve memory and exam performance.',
  path: '/',
  type: 'website',
  keywords: baseKeywords,
  robots: 'noindex,follow'
};

const resolveByPrefix = (pathname) => {
  if (pathname.startsWith('/study/')) return routeSeoMap['/study'];
  if (pathname.startsWith('/edit/')) return { ...routeSeoMap['/create'], path: pathname };
  if (pathname.startsWith('/profile/')) return { title: 'Profile Settings | Drizzlix', description: 'Manage profile preferences.', path: pathname, type: 'website', robots: 'noindex,follow' };
  if (pathname.startsWith('/u/') || pathname.startsWith('/deck/')) return { title: 'Profile | Drizzlix', description: 'View profile stats on Drizzlix.', path: pathname, type: 'profile', robots: 'noindex,follow' };
  return null;
};

const ensureSchema = (seoObject) => {
  if (!seoObject) return seoObject;
  const isNoIndex = typeof seoObject.robots === 'string' && seoObject.robots.includes('noindex');
  if (!isNoIndex && !seoObject.schema) {
    return {
      ...seoObject,
      schema: [organizationSchema, getPageSchema(seoObject.title, seoObject.path)]
    };
  }
  return seoObject;
};

export const getSeoForPath = (pathname, isAuthenticated = false) => {
  if (pathname === '/') return ensureSchema(isAuthenticated ? routeSeoMap['/'].private : routeSeoMap['/'].public);

  const exact = routeSeoMap[pathname];
  if (exact) return ensureSchema(exact);

  const prefix = resolveByPrefix(pathname);
  if (prefix) return ensureSchema(prefix);

  return ensureSchema({ ...fallbackSeo, path: pathname || '/' });
};

export const seoGlobals = {
  siteName: SITE_NAME,
  siteUrl: SITE_URL,
  defaultImage: DEFAULT_IMAGE
};
