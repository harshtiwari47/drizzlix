import { Fragment, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import { applyAccessibilitySettingsFromStorage } from './services/accessibilitySettings'
import './index.css'
import App from './App.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE";
const API_URL = import.meta.env.VITE_API_URL;
const SW_UPDATE_READY_EVENT = 'app-sw-update-ready';
const DEV_SW_CLEANUP_KEY = 'drizzlix.dev-sw-cleanup';

const warmConnectionToOrigin = (origin) => {
  if (typeof document === 'undefined' || !origin) return;

  const hasPreconnect = document.querySelector(`link[rel="preconnect"][href="${origin}"]`);
  if (!hasPreconnect) {
    const preconnectLink = document.createElement('link');
    preconnectLink.rel = 'preconnect';
    preconnectLink.href = origin;
    preconnectLink.crossOrigin = 'anonymous';
    document.head.appendChild(preconnectLink);
  }

  const hasDnsPrefetch = document.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`);
  if (!hasDnsPrefetch) {
    const dnsPrefetchLink = document.createElement('link');
    dnsPrefetchLink.rel = 'dns-prefetch';
    dnsPrefetchLink.href = origin;
    document.head.appendChild(dnsPrefetchLink);
  }
};

const notifyServiceWorkerUpdateReady = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SW_UPDATE_READY_EVENT));
};

if (typeof window !== 'undefined') {
  applyAccessibilitySettingsFromStorage();

  if (API_URL) {
    try {
      const resolvedApiUrl = new URL(API_URL, window.location.origin);
      if (resolvedApiUrl.origin !== window.location.origin) {
        warmConnectionToOrigin(resolvedApiUrl.origin);
      }
    } catch {
      // Ignore malformed API URL and continue without preconnect hints.
    }
  }
}

createRoot(document.getElementById('root')).render(
  import.meta.env.DEV ? (
    <Fragment>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </GoogleOAuthProvider>
    </Fragment>
  ) : (
    <StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </GoogleOAuthProvider>
    </StrictMode>
  ),
)

if ('serviceWorker' in navigator) {
  const cleanupAllServiceWorkers = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister().catch(() => false)),
      );

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        const appCacheKeys = cacheKeys.filter((key) => key.startsWith('neurodeck-shell-v'));
        await Promise.all(appCacheKeys.map((cacheKey) => caches.delete(cacheKey)));
      }
    } catch (error) {
      console.warn('Failed to cleanup service worker:', error);
    }
  };

  cleanupAllServiceWorkers();
}

