import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DeckProvider } from './context/DeckContext';
import { useAuth } from './context/AuthContext';
import SEOMeta from './components/SEOMeta';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import SingletonRouteLoader from './components/SingletonRouteLoader';
import { applyAccessibilitySettingsFromStorage } from './services/accessibilitySettings';
import { prefetchFromNavigationHistory, prefetchInitialRoutes } from './services/routePrefetch';
import {
  flushOfflineSyncQueue,
  getOfflineSyncPendingCount,
  subscribeToOfflineSyncQueue,
} from './services/offlineSyncQueue';
import {
  startRouteTransitionLoader,
  stopRouteTransitionLoader,
} from './services/routeTransitionLoader';
import './App.css';

const Login = React.lazy(() => import('./pages/Login'));
const Landing = React.lazy(() => import('./pages/Landing'));
const Layout = React.lazy(() => import('./pages/Layout'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const StudySession = React.lazy(() => import('./pages/StudySession'));
const DeckLibrary = React.lazy(() => import('./pages/DeckLibrary'));
const Discover = React.lazy(() => import('./pages/Discover'));
const Mastery = React.lazy(() => import('./pages/Mastery'));
const CreateDeck = React.lazy(() => import('./pages/CreateDeck'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Profile = React.lazy(() => import('./pages/Profile'));
const ProfileEdit = React.lazy(() => import('./pages/ProfileEdit'));
const TasksPage = React.lazy(() => import('./pages/TasksPage'));
const NotesPage = React.lazy(() => import('./pages/NotesPage'));
const Pomodoro = React.lazy(() => import('./pages/Pomodoro'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const PublicPomodoro = React.lazy(() => import('./pages/PublicPomodoro'));
const PublicNotes = React.lazy(() => import('./pages/PublicNotes'));
const PublicTasks = React.lazy(() => import('./pages/PublicTasks'));
const Starfield = React.lazy(() => import('./components/Starfield'));
const SW_UPDATE_READY_EVENT = 'app-sw-update-ready';
const IS_DEV = import.meta.env.DEV;
const PERF_WARN_COOLDOWN_MS = 10000;
const perfWarningLogRegistry = new Map();

const ROUTE_PERF_BUDGET_MS = {
  mount: 280,
  paint: 360,
  tabSwitch: 340,
};

const normalizeRoutePath = (pathname) => {
  if (!pathname) return '/';
  return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
};

const roundPerf = (value) => Number(value.toFixed(1));

const getPerfWarningKey = (metric, details = {}) => {
  const route = details.route || 'unknown';
  const from = details.from || 'unknown';
  return `${metric}:${from}->${route}`;
};

const logDevPerfBudget = (metric, elapsed, budget, details = {}) => {
  if (!IS_DEV || typeof console === 'undefined' || !Number.isFinite(elapsed)) return;

  const payload = {
    elapsedMs: roundPerf(elapsed),
    budgetMs: budget,
    ...details,
  };

  if (elapsed > budget) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const warningKey = getPerfWarningKey(metric, details);
    const lastWarningAt = perfWarningLogRegistry.get(warningKey) || 0;

    if (now - lastWarningAt < PERF_WARN_COOLDOWN_MS) {
      return;
    }

    perfWarningLogRegistry.set(warningKey, now);
    console.warn(`[perf][${metric}] budget exceeded`, payload);
    return;
  }

  console.debug(`[perf][${metric}]`, payload);
};

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const SuspenseLoaderBridge = React.memo(function SuspenseLoaderBridge() {
  React.useEffect(() => {
    startRouteTransitionLoader();
    return () => {
      stopRouteTransitionLoader();
    };
  }, []);

  return null;
});

function App() {
  const { token } = useAuth();
  const location = useLocation();
  const [zoomedImage, setZoomedImage] = React.useState(null);
  const [isOffline, setIsOffline] = React.useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [isUpdateReady, setIsUpdateReady] = React.useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = React.useState(false);
  const [isSyncingPending, setIsSyncingPending] = React.useState(false);
  const [pendingSyncCount, setPendingSyncCount] = React.useState(0);
  React.useEffect(() => {
    getOfflineSyncPendingCount().then(setPendingSyncCount);
  }, []);
  const tabSwitchIntentRef = React.useRef(null);
  const routeTransitionStartRef = React.useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const previousRoutePathRef = React.useRef(normalizeRoutePath(location.pathname));
  const pendingFlushInFlightRef = React.useRef(false);
  const pendingFlushLastStartRef = React.useRef(0);
  const pendingSyncHideTimerRef = React.useRef(null);

  const runPendingSyncFlush = React.useCallback(async ({ maxItems = 10, minIntervalMs = 1200 } = {}) => {
    if (!token) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const count = await getOfflineSyncPendingCount();
    if (count === 0) return;

    const now = Date.now();
    if (minIntervalMs > 0 && now - pendingFlushLastStartRef.current < minIntervalMs) {
      return;
    }

    if (pendingFlushInFlightRef.current) {
      return;
    }

    pendingFlushInFlightRef.current = true;
    pendingFlushLastStartRef.current = now;

    if (pendingSyncHideTimerRef.current) {
      window.clearTimeout(pendingSyncHideTimerRef.current);
      pendingSyncHideTimerRef.current = null;
    }

    setIsSyncingPending(true);
    const startedAt = Date.now();

    try {
      await flushOfflineSyncQueue({ maxItems });
    } finally {
      getOfflineSyncPendingCount().then(setPendingSyncCount);
      pendingFlushInFlightRef.current = false;

      // Keep sync feedback visible briefly to avoid rapid on/off flicker.
      const remainingVisibleMs = Math.max(0, 450 - (Date.now() - startedAt));
      pendingSyncHideTimerRef.current = window.setTimeout(() => {
        setIsSyncingPending(false);
        pendingSyncHideTimerRef.current = null;
      }, remainingVisibleMs);
    }
  }, [token]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const ensureFallbackThemeMeta = () => {
      let meta = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      return meta;
    };

    const applyThemeColor = () => {
      const fallbackMeta = ensureFallbackThemeMeta();
      fallbackMeta.setAttribute('content', mediaQuery.matches ? '#000000' : '#f3f4f6');
    };

    applyThemeColor();

    const onSchemeChange = () => applyThemeColor();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onSchemeChange);
      return () => mediaQuery.removeEventListener('change', onSchemeChange);
    }

    mediaQuery.addListener(onSchemeChange);
    return () => mediaQuery.removeListener(onSchemeChange);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const runPrefetch = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      prefetchInitialRoutes(Boolean(token));
    };

    let timeoutId;
    let idleId;

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(runPrefetch, { timeout: 2200 });
    } else {
      timeoutId = window.setTimeout(runPrefetch, 900);
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) runPrefetch();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (typeof idleId === 'number' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  React.useEffect(() => {
    if (!token) return;
    prefetchFromNavigationHistory(location.pathname);
  }, [location.pathname, token]);

  React.useEffect(() => {
    if (!IS_DEV || typeof window === 'undefined' || typeof document === 'undefined' || typeof performance === 'undefined') {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      let nextUrl;
      try {
        nextUrl = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const nextPath = normalizeRoutePath(nextUrl.pathname);
      const currentPath = normalizeRoutePath(window.location.pathname);
      if (nextPath === currentPath) return;

      const startedAt = performance.now();
      tabSwitchIntentRef.current = {
        path: nextPath,
        startedAt,
      };
      routeTransitionStartRef.current = startedAt;
    };

    const handlePopState = () => {
      routeTransitionStartRef.current = performance.now();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  React.useEffect(() => {
    const currentPath = normalizeRoutePath(location.pathname);

    if (!IS_DEV || typeof window === 'undefined' || typeof performance === 'undefined') {
      previousRoutePathRef.current = currentPath;
      return undefined;
    }

    const previousPath = previousRoutePathRef.current;
    previousRoutePathRef.current = currentPath;

    const mountedAt = performance.now();
    const mountElapsed = mountedAt - routeTransitionStartRef.current;

    logDevPerfBudget('route-mount', mountElapsed, ROUTE_PERF_BUDGET_MS.mount, {
      route: currentPath,
      from: previousPath,
    });

    const pendingIntent = tabSwitchIntentRef.current;
    if (pendingIntent && pendingIntent.path === currentPath) {
      const tabSwitchElapsed = mountedAt - pendingIntent.startedAt;
      logDevPerfBudget('tab-switch-latency', tabSwitchElapsed, ROUTE_PERF_BUDGET_MS.tabSwitch, {
        route: currentPath,
        from: previousPath,
      });
      tabSwitchIntentRef.current = null;
    }

    routeTransitionStartRef.current = mountedAt;

    const paintStart = mountedAt;
    let rafPrimary = 0;
    let rafSecondary = 0;

    rafPrimary = window.requestAnimationFrame(() => {
      rafSecondary = window.requestAnimationFrame(() => {
        const paintElapsed = performance.now() - paintStart;
        logDevPerfBudget('route-first-content-paint', paintElapsed, ROUTE_PERF_BUDGET_MS.paint, {
          route: currentPath,
        });
      });
    });

    return () => {
      if (rafPrimary) window.cancelAnimationFrame(rafPrimary);
      if (rafSecondary) window.cancelAnimationFrame(rafSecondary);
    };
  }, [location.pathname]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    return subscribeToOfflineSyncQueue((nextCount) => {
      setPendingSyncCount(nextCount);
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const flushQueueIfPossible = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      await runPendingSyncFlush({ maxItems: 10, minIntervalMs: 1200 });
    };

    const intervalId = window.setInterval(() => {
      flushQueueIfPossible().catch(() => undefined);
    }, 15000);

    const handleOnline = () => {
      flushQueueIfPossible().catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        flushQueueIfPossible().catch(() => undefined);
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    flushQueueIfPossible().catch(() => undefined);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [runPendingSyncFlush]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    return () => {
      if (pendingSyncHideTimerRef.current) {
        window.clearTimeout(pendingSyncHideTimerRef.current);
        pendingSyncHideTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleSwUpdateReady = () => {
      setIsApplyingUpdate(false);
      setIsUpdateReady(true);
    };

    window.addEventListener(SW_UPDATE_READY_EVENT, handleSwUpdateReady);
    return () => {
      window.removeEventListener(SW_UPDATE_READY_EVENT, handleSwUpdateReady);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    applyAccessibilitySettingsFromStorage();

    const onStorage = (event) => {
      if (!event.key || event.key.startsWith('settings.')) {
        applyAccessibilitySettingsFromStorage();
      }
    };

    const onViewportChange = () => {
      applyAccessibilitySettingsFromStorage();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', onViewportChange, { passive: true });

    // Signal Puppeteer that React has fully mounted and is ready for snapshot
    const tm = setTimeout(() => {
      document.dispatchEvent(new Event('prerender-ready'));
    }, 1500);

    return () => {
      clearTimeout(tm);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
    };
  }, []);

  const applyServiceWorkerUpdate = React.useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    setIsApplyingUpdate(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }

      if (navigator.onLine) {
        window.location.reload();
        return;
      }

      setIsApplyingUpdate(false);
    } catch {
      setIsApplyingUpdate(false);
    }
  }, []);

  const dismissUpdateNotice = React.useCallback(() => {
    setIsUpdateReady(false);
  }, []);

  const syncPendingQueueNow = React.useCallback(async () => {
    await runPendingSyncFlush({ maxItems: 20, minIntervalMs: 0 });
  }, [runPendingSyncFlush]);

  React.useEffect(() => {
    const markdownScopeSelector =
      '.markdown-answer, .markdown-preview, .markdown-card-content, .live-preview-mini, .markdown-hint';

    const handleImageError = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.closest(markdownScopeSelector)) return;
      target.classList.add('markdown-image-load-failed');
    };

    const handleImageLoad = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.closest(markdownScopeSelector)) return;
      target.classList.remove('markdown-image-load-failed');
    };

    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;

      const inMarkdownScope = target.closest(markdownScopeSelector);
      if (!inMarkdownScope) return;
      if (target.classList.contains('markdown-image-load-failed')) return;

      setZoomedImage({
        src: target.currentSrc || target.src,
        alt: target.alt || 'Expanded image',
      });
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setZoomedImage(null);
    };

    document.addEventListener('error', handleImageError, true);
    document.addEventListener('load', handleImageLoad, true);
    document.addEventListener('click', handleDocumentClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('error', handleImageError, true);
      document.removeEventListener('load', handleImageLoad, true);
      document.removeEventListener('click', handleDocumentClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <DeckProvider>
      <SEOMeta isAuthenticated={Boolean(token)} />
      <SingletonRouteLoader />
      <React.Suspense fallback={<SuspenseLoaderBridge />}>
        <Starfield />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={token ? <RouteErrorBoundary><Layout /></RouteErrorBoundary> : <Landing />}>
            <Route index element={<Dashboard />} />
            <Route path="decks" element={<DeckLibrary />} />
            <Route path="discover" element={<Discover />} />
            <Route path="create" element={<CreateDeck />} />
            <Route path="edit/:deckId" element={<CreateDeck />} />
            <Route path="stats" element={<Mastery />} />
            <Route path="u/:username" element={<Profile />} />
            <Route path="deck/:username/:deckId" element={<Profile />} />
            <Route path="u/me" element={<Profile />} />
            <Route path="profile/edit" element={<ProfileEdit />} />
            <Route path="settings" element={<Settings />} />
            {/* pomodoro, notes, and tasks extracted from here */}
          </Route>

          {/* Extracted protected routes to prevent unauthenticated Landing duplication */}
          <Route element={<RouteErrorBoundary><Layout /></RouteErrorBoundary>}>
            <Route path="/pomodoro" element={token ? <Pomodoro /> : <Navigate to="/" replace />} />
            <Route path="/notes" element={token ? <NotesPage /> : <Navigate to="/" replace />} />
            <Route path="/tasks" element={token ? <TasksPage /> : <Navigate to="/" replace />} />
          </Route>

          {/* Public info & feature pages */}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/about" element={<AboutPage />} />
          
          <Route path="/features/pomodoro" element={<PublicPomodoro />} />
          <Route path="/features/notes" element={<PublicNotes />} />
          <Route path="/features/tasks" element={<PublicTasks />} />

          {/* Study Session uses full screen isolation outside of main Nav layout */}
          <Route path="/study/:deckId" element={<ProtectedRoute><StudySession /></ProtectedRoute>} />
        </Routes>
      </React.Suspense>

      {(isOffline || isUpdateReady || pendingSyncCount > 0) && (
        <div className="app-runtime-banner" role="status" aria-live="polite">
          <div className="app-runtime-banner-text">
            {isOffline && (
              <p>
                You are offline. Drizzlix is running from local cache; cloud sync and remote saves will resume when your connection returns.
              </p>
            )}
            {pendingSyncCount > 0 && (
              <p>
                {pendingSyncCount} pending sync {pendingSyncCount === 1 ? 'update' : 'updates'} waiting to reach cloud storage.
              </p>
            )}
            {isUpdateReady && (
              <p>
                A new version is ready. Update now for the latest fixes and performance improvements.
              </p>
            )}
          </div>

          <div className="app-runtime-banner-actions">
            {isUpdateReady && (
              <button
                type="button"
                className="app-runtime-banner-action"
                onClick={applyServiceWorkerUpdate}
                disabled={isApplyingUpdate}
              >
                {isApplyingUpdate ? 'Updating...' : 'Update now'}
              </button>
            )}

            {pendingSyncCount > 0 && (
              <button
                type="button"
                className="app-runtime-banner-action"
                onClick={syncPendingQueueNow}
                disabled={isSyncingPending || isOffline || !token}
                title={isOffline ? 'Reconnect to sync queued updates' : 'Sync pending updates now'}
              >
                {isSyncingPending ? 'Syncing...' : 'Sync now'}
              </button>
            )}

            {isUpdateReady && (
              <button type="button" className="app-runtime-banner-dismiss" onClick={dismissUpdateNotice}>
                Later
              </button>
            )}
          </div>
        </div>
      )}

      {zoomedImage && (
        <div className="image-zoom-overlay" onClick={() => setZoomedImage(null)}>
          <button
            type="button"
            className="image-zoom-close"
            onClick={() => setZoomedImage(null)}
            aria-label="Close expanded image"
          >
            x
          </button>
          <img
            className="image-zoom-modal-image"
            src={zoomedImage.src}
            alt={zoomedImage.alt}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </DeckProvider>
  );
}

export default App;

