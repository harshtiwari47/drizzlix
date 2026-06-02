// ── Theme Service ─────────────────────────────────────────────────────────────
// Modular theme engine: defines themes as CSS variable maps, applies them to
// documentElement, persists selection in localStorage, and handles cross-tab sync.

const STORAGE_KEY = 'settings.theme';
const ACCENT_STORAGE_KEY = 'settings.accentColor';
const DATA_ATTR = 'data-theme';

// ── Theme Definitions ─────────────────────────────────────────────────────────

const THEMES = {
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    emoji: '🌙',
    colorScheme: 'dark',
    metaThemeColor: '#000000',
    preview: ['#000000', '#111111', '#a78bfa', '#7dd3fc'],
    vars: {
      '--bg-color': '#000000',
      '--bg-secondary': '#0a0a14',
      '--glass-surface': 'rgba(20, 20, 20, 0.6)',
      '--glass-surface-solid': '#111111',
      '--glass-border': 'rgba(255, 255, 255, 0.1)',
      '--primary': '#e5e7eb',
      '--secondary': '#9ca3af',
      '--text-primary': '#ffffff',
      '--text-inverse': '#000000',
      '--text-secondary': '#9ca3af',
      '--accent-primary': '#a78bfa',
      '--accent-secondary': '#7dd3fc',
      '--outline': 'rgba(255, 255, 255, 0.15)',
      '--outline-inverse': 'rgba(0, 0, 0, 0.8)',
      '--shadow-color': 'rgba(0, 0, 0, 0.5)',
      '--danger': '#f87171',
      '--success': '#4ade80',
      '--warning': '#fbbf24',
      '--bg-gradient': 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #000000 75%)',
      '--starfield-opacity': '0.08',
      '--scrollbar-track': 'rgba(10, 10, 10, 0.92)',
      '--scrollbar-thumb': 'rgba(120, 120, 120, 0.62)',
      '--scrollbar-thumb-hover': 'rgba(160, 160, 160, 0.78)',
      '--card-bg': 'rgba(255, 255, 255, 0.03)',
      '--card-border': 'rgba(255, 255, 255, 0.06)',
      '--card-hover': 'rgba(255, 255, 255, 0.06)',
      '--input-bg': 'rgba(255, 255, 255, 0.04)',
      '--input-border': 'rgba(255, 255, 255, 0.1)',
      '--badge-bg': 'rgba(167, 139, 250, 0.15)',
      '--badge-text': '#c4b5fd',
      '--focus-ring': 'rgba(125, 211, 252, 0.95)',
    },
  },

  light: {
    id: 'light',
    label: 'Light',
    emoji: '☀️',
    colorScheme: 'light',
    metaThemeColor: '#f8f9fb',
    preview: ['#f8f9fb', '#ffffff', '#6366f1', '#06b6d4'],
    vars: {
      '--bg-color': '#f4f5f7',
      '--bg-secondary': '#ffffff',
      '--glass-surface': 'rgba(255, 255, 255, 0.75)',
      '--glass-surface-solid': '#ffffff',
      '--glass-border': 'rgba(0, 0, 0, 0.08)',
      '--primary': '#1e293b',
      '--secondary': '#64748b',
      '--text-primary': '#1e293b',
      '--text-inverse': '#ffffff',
      '--text-secondary': '#64748b',
      '--accent-primary': '#6366f1',
      '--accent-secondary': '#06b6d4',
      '--outline': 'rgba(0, 0, 0, 0.1)',
      '--outline-inverse': 'rgba(255, 255, 255, 0.9)',
      '--shadow-color': 'rgba(0, 0, 0, 0.08)',
      '--danger': '#ef4444',
      '--success': '#22c55e',
      '--warning': '#f59e0b',
      '--bg-gradient': 'linear-gradient(180deg, #f8f9fb 0%, #eef0f4 100%)',
      '--starfield-opacity': '0',
      '--scrollbar-track': 'rgba(240, 240, 240, 0.95)',
      '--scrollbar-thumb': 'rgba(180, 180, 180, 0.5)',
      '--scrollbar-thumb-hover': 'rgba(150, 150, 150, 0.7)',
      '--card-bg': 'rgba(255, 255, 255, 0.6)',
      '--card-border': 'rgba(0, 0, 0, 0.06)',
      '--card-hover': 'rgba(99, 102, 241, 0.04)',
      '--input-bg': 'rgba(0, 0, 0, 0.03)',
      '--input-border': 'rgba(0, 0, 0, 0.12)',
      '--badge-bg': 'rgba(99, 102, 241, 0.1)',
      '--badge-text': '#4f46e5',
      '--focus-ring': 'rgba(99, 102, 241, 0.7)',
    },
  },

  pastel: {
    id: 'pastel',
    label: 'Pastel',
    emoji: '🌸',
    colorScheme: 'light',
    metaThemeColor: '#fdf6f0',
    preview: ['#fdf6f0', '#fef0e6', '#e8a0bf', '#a0d2db'],
    vars: {
      '--bg-color': '#fdf6f0',
      '--bg-secondary': '#fef5ed',
      '--glass-surface': 'rgba(255, 240, 230, 0.65)',
      '--glass-surface-solid': '#fdf0e8',
      '--glass-border': 'rgba(180, 120, 80, 0.1)',
      '--primary': '#5c4356',
      '--secondary': '#755f7a',
      '--text-primary': '#3d2c3e',
      '--text-inverse': '#fdf6f0',
      '--text-secondary': '#8a7190',
      '--accent-primary': '#e8a0bf',
      '--accent-secondary': '#a0d2db',
      '--outline': 'rgba(180, 120, 80, 0.12)',
      '--outline-inverse': 'rgba(255, 240, 230, 0.9)',
      '--shadow-color': 'rgba(140, 100, 80, 0.1)',
      '--danger': '#e57373',
      '--success': '#81c784',
      '--warning': '#ffb74d',
      '--bg-gradient': 'linear-gradient(160deg, #fdf6f0 0%, #fce8db 50%, #f5dde4 100%)',
      '--starfield-opacity': '0',
      '--scrollbar-track': 'rgba(253, 240, 232, 0.95)',
      '--scrollbar-thumb': 'rgba(200, 160, 140, 0.4)',
      '--scrollbar-thumb-hover': 'rgba(180, 140, 120, 0.6)',
      '--card-bg': 'rgba(255, 255, 255, 0.35)',
      '--card-border': 'rgba(180, 120, 80, 0.08)',
      '--card-hover': 'rgba(232, 160, 191, 0.08)',
      '--input-bg': 'rgba(255, 255, 255, 0.25)',
      '--input-border': 'rgba(180, 120, 80, 0.15)',
      '--badge-bg': 'rgba(232, 160, 191, 0.2)',
      '--badge-text': '#c47a9a',
      '--focus-ring': 'rgba(232, 160, 191, 0.7)',
    },
  },

  neon: {
    id: 'neon',
    label: 'Neon',
    emoji: '⚡',
    colorScheme: 'dark',
    metaThemeColor: '#0a0a12',
    preview: ['#0a0a12', '#161625', '#ff2d95', '#00ffc8'],
    vars: {
      '--bg-color': '#0a0a12',
      '--bg-secondary': '#12121e',
      '--glass-surface': 'rgba(15, 15, 30, 0.75)',
      '--glass-surface-solid': '#161625',
      '--glass-border': 'rgba(0, 255, 200, 0.12)',
      '--primary': '#e0ffe8',
      '--secondary': '#7ae8c0',
      '--text-primary': '#e0ffe8',
      '--text-inverse': '#0a0a12',
      '--text-secondary': '#7ae8c0',
      '--accent-primary': '#ff2d95',
      '--accent-secondary': '#00ffc8',
      '--outline': 'rgba(0, 255, 200, 0.18)',
      '--outline-inverse': 'rgba(10, 10, 18, 0.9)',
      '--shadow-color': 'rgba(0, 0, 0, 0.6)',
      '--danger': '#ff4757',
      '--success': '#00ffc8',
      '--warning': '#ffdd59',
      '--bg-gradient': 'radial-gradient(ellipse at 30% 0%, rgba(255,45,149,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(0,255,200,0.06) 0%, #0a0a12 70%)',
      '--starfield-opacity': '0.14',
      '--scrollbar-track': 'rgba(10, 10, 18, 0.95)',
      '--scrollbar-thumb': 'rgba(0, 255, 200, 0.25)',
      '--scrollbar-thumb-hover': 'rgba(0, 255, 200, 0.45)',
      '--card-bg': 'rgba(255, 255, 255, 0.03)',
      '--card-border': 'rgba(0, 255, 200, 0.08)',
      '--card-hover': 'rgba(255, 45, 149, 0.06)',
      '--input-bg': 'rgba(0, 255, 200, 0.04)',
      '--input-border': 'rgba(0, 255, 200, 0.15)',
      '--badge-bg': 'rgba(255, 45, 149, 0.15)',
      '--badge-text': '#ff6fb0',
      '--focus-ring': 'rgba(0, 255, 200, 0.7)',
    },
  },
};

const DEFAULT_THEME = 'midnight';
const THEME_IDS = Object.keys(THEMES);

// ── Helpers ───────────────────────────────────────────────────────────────────

function readStorage(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore (incognito / quota).
  }
}

function isValidThemeId(id) {
  return typeof id === 'string' && THEME_IDS.includes(id);
}

// ── Core API ──────────────────────────────────────────────────────────────────

/** Detect user's system preference and return appropriate theme. */
export function detectSystemTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  return prefersDark ? 'midnight' : 'light';
}

/** Read stored theme, falling back to system or default. */
export function getStoredTheme() {
  const stored = readStorage(STORAGE_KEY);
  if (isValidThemeId(stored)) return stored;
  return detectSystemTheme();
}

/** Persist theme choice to localStorage. */
export function persistTheme(themeId) {
  writeStorage(STORAGE_KEY, themeId);
}

/** Read the stored custom accent color (or null). */
export function getStoredAccentColor() {
  return readStorage(ACCENT_STORAGE_KEY);
}

/** Persist a custom accent color override (or clear it with null). */
export function persistAccentColor(color) {
  if (color == null) {
    try { window.localStorage.removeItem(ACCENT_STORAGE_KEY); } catch { /* ok */ }
    return;
  }
  writeStorage(ACCENT_STORAGE_KEY, color);
}

/** Apply a theme by ID. Sets CSS custom properties on <html>. */
export function applyTheme(themeId) {
  if (typeof document === 'undefined') return;

  const safe = isValidThemeId(themeId) ? themeId : DEFAULT_THEME;
  const theme = THEMES[safe];
  const root = document.documentElement;

  // Set all CSS variables
  const vars = theme.vars;
  const keys = Object.keys(vars);
  for (let i = 0; i < keys.length; i++) {
    root.style.setProperty(keys[i], vars[keys[i]]);
  }

  // Apply custom accent override if set
  const customAccent = getStoredAccentColor();
  if (customAccent) {
    root.style.setProperty('--accent-primary', customAccent);
  }

  // Set data attribute for potential CSS hooks
  root.setAttribute(DATA_ATTR, safe);

  // Update color-scheme for native form controls
  root.style.setProperty('color-scheme', theme.colorScheme);

  // Update <meta name="theme-color">
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) {
    meta.setAttribute('content', theme.metaThemeColor);
  }
}

/** Apply a custom accent color on top of the current theme. */
export function applyAccentColor(color) {
  if (typeof document === 'undefined') return;
  if (color) {
    document.documentElement.style.setProperty('--accent-primary', color);
  } else {
    // Revert to theme default
    const themeId = getStoredTheme();
    const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
    document.documentElement.style.setProperty('--accent-primary', theme.vars['--accent-primary']);
  }
}

/** Boot function: read stored theme and apply immediately. */
export function applyThemeFromStorage() {
  const themeId = getStoredTheme();
  applyTheme(themeId);
  return themeId;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export { THEMES, THEME_IDS, DEFAULT_THEME, STORAGE_KEY, ACCENT_STORAGE_KEY };
