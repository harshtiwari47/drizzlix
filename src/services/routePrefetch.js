const MODULE_LOADERS = {
  login: () => import('../pages/Login'),
  landing: () => import('../pages/Landing'),
  layout: () => import('../pages/Layout'),
  dashboard: () => import('../pages/Dashboard'),
  discover: () => import('../pages/Discover'),
  decks: () => import('../pages/DeckLibrary'),
  create: () => import('../pages/CreateDeck'),
  mastery: () => import('../pages/Mastery'),
  tasks: () => import('../pages/TasksPage'),
  notes: () => import('../pages/NotesPage'),
  pomodoro: () => import('../pages/Pomodoro'),
  settings: () => import('../pages/Settings'),
  profile: () => import('../pages/Profile'),
  profileEdit: () => import('../pages/ProfileEdit'),
  study: () => import('../pages/StudySession'),
  privacy: () => import('../pages/PrivacyPage'),
  terms: () => import('../pages/TermsPage'),
  about: () => import('../pages/AboutPage'),
};

const NAVIGATION_HISTORY_LIMIT = 12;
const SWITCH_SIGNAL_WINDOW_MS = 45000;
const SWITCH_SIGNAL_THRESHOLD = 2;

const AGGRESSIVE_PAIR_STRATEGIES = {
  '/notes::/pomodoro': {
    routes: ['/notes', '/pomodoro'],
    // Warm frequently shared productivity context routes after repeated tab oscillation.
    sharedModules: ['tasks', 'settings', 'discover'],
  },
};

const ROUTE_MODULES = {
  '/': ['layout', 'dashboard'],
  '/discover': ['discover'],
  '/decks': ['decks'],
  '/create': ['create'],
  '/stats': ['mastery'],
  '/tasks': ['tasks'],
  '/notes': ['notes'],
  '/pomodoro': ['pomodoro'],
  '/settings': ['settings'],
  '/u/me': ['profile'],
  '/profile/edit': ['profileEdit'],
  '/privacy': ['privacy'],
  '/terms': ['terms'],
  '/about': ['about'],
  '/login': ['login'],
  '/landing': ['landing'],
};

const DYNAMIC_ROUTE_MODULES = [
  { test: (path) => path.startsWith('/u/'), modules: ['profile'] },
  { test: (path) => path.startsWith('/deck/'), modules: ['profile'] },
  { test: (path) => path.startsWith('/edit/'), modules: ['create'] },
  { test: (path) => path.startsWith('/study/'), modules: ['study'] },
];

const warmedModules = new Set();
const recentNavigationPaths = [];
const switchSignalsByPair = new Map();

function normalizePath(pathname) {
  if (!pathname) return '/';
  const [base] = String(pathname).split('?');
  if (!base || base === '') return '/';
  return base.endsWith('/') && base.length > 1 ? base.slice(0, -1) : base;
}

function toPairKey(pathA, pathB) {
  return [pathA, pathB].sort().join('::');
}

function getAnalyticsPath(pathname) {
  const normalized = normalizePath(pathname);

  if (normalized.startsWith('/notes')) return '/notes';
  if (normalized.startsWith('/pomodoro')) return '/pomodoro';
  if (normalized.startsWith('/discover')) return '/discover';
  if (normalized.startsWith('/decks')) return '/decks';
  if (normalized.startsWith('/tasks')) return '/tasks';
  if (normalized.startsWith('/settings')) return '/settings';

  return normalized;
}

function rememberNavigation(pathname) {
  const previous = recentNavigationPaths[recentNavigationPaths.length - 1];
  if (previous === pathname) return;

  recentNavigationPaths.push(pathname);
  if (recentNavigationPaths.length > NAVIGATION_HISTORY_LIMIT) {
    recentNavigationPaths.shift();
  }
}

function warmModule(moduleKey) {
  const loader = MODULE_LOADERS[moduleKey];
  if (!loader || warmedModules.has(moduleKey)) return;

  warmedModules.add(moduleKey);
  loader().catch(() => {
    warmedModules.delete(moduleKey);
  });
}

function warmModules(moduleKeys) {
  for (const moduleKey of moduleKeys) {
    warmModule(moduleKey);
  }
}

function getModulesForPath(pathname) {
  const normalizedPath = normalizePath(pathname);
  const staticModules = ROUTE_MODULES[normalizedPath];
  if (staticModules) return staticModules;

  for (const matcher of DYNAMIC_ROUTE_MODULES) {
    if (matcher.test(normalizedPath)) {
      return matcher.modules;
    }
  }

  return null;
}

export function prefetchRoute(pathname) {
  const modules = getModulesForPath(pathname);
  if (!modules) return;
  warmModules(modules);
}

function aggressivePrefetchPair(pairKey) {
  const strategy = AGGRESSIVE_PAIR_STRATEGIES[pairKey];
  if (!strategy) return;

  for (const route of strategy.routes) {
    prefetchRoute(route);
  }

  warmModules(strategy.sharedModules);
}

function signalRouteSwitch(previousPath, currentPath) {
  if (!previousPath || previousPath === currentPath) return;

  const pairKey = toPairKey(previousPath, currentPath);
  const now = Date.now();
  const previousSignal = switchSignalsByPair.get(pairKey);

  const count = previousSignal && now - previousSignal.lastAt <= SWITCH_SIGNAL_WINDOW_MS
    ? previousSignal.count + 1
    : 1;

  switchSignalsByPair.set(pairKey, { count, lastAt: now });

  if (count >= SWITCH_SIGNAL_THRESHOLD) {
    aggressivePrefetchPair(pairKey);
  }
}

export function prefetchFromNavigationHistory(pathname) {
  const currentPath = getAnalyticsPath(pathname);
  const previousPath = recentNavigationPaths[recentNavigationPaths.length - 1] || null;

  rememberNavigation(currentPath);
  prefetchRoute(currentPath);
  signalRouteSwitch(previousPath, currentPath);

  // If user often bounces between routes, warm the immediate previous route too.
  if (previousPath && previousPath !== currentPath) {
    prefetchRoute(previousPath);
  }
}

export function prefetchInitialRoutes(isAuthenticated) {
  if (isAuthenticated) {
    prefetchRoute('/');
    prefetchRoute('/discover');
    prefetchRoute('/decks');
    prefetchRoute('/tasks');
    prefetchRoute('/notes');
    prefetchRoute('/pomodoro');
    return;
  }

  prefetchRoute('/login');
  prefetchRoute('/');
  prefetchRoute('/landing');
}
