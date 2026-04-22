const STORAGE_KEYS = {
  reduceMotion: 'settings.reduceMotion',
  fontScale: 'settings.fontScale',
  dyslexiaFont: 'settings.dyslexiaFont',
  highContrast: 'settings.highContrast',
};

const FONT_SCALE_VALUES = {
  compact: 0.9,
  default: 1,
  comfortable: 1.1,
  large: 1.2,
};

const FONT_SCALE_CLASS_MAP = {
  compact: 'a11y-font-scale-compact',
  default: 'a11y-font-scale-default',
  comfortable: 'a11y-font-scale-comfortable',
  large: 'a11y-font-scale-large',
};

const FONT_SCALE_CLASSES = Object.values(FONT_SCALE_CLASS_MAP);
const LOW_CAPABILITY_CLASS = 'low-end-device-ui';

const DEFAULT_SETTINGS = {
  reduceMotion: false,
  fontScale: 'default',
  dyslexiaFont: false,
  highContrast: false,
};

function readFromStorage(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeToStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures (private mode/quota/blocked storage).
  }
}

function parseBoolean(key, fallback = false) {
  const value = readFromStorage(key);
  if (value == null) return fallback;
  return value === 'true';
}

function parseFontScale(value) {
  return Object.prototype.hasOwnProperty.call(FONT_SCALE_VALUES, value) ? value : DEFAULT_SETTINGS.fontScale;
}

export function isLowCapabilityDevice() {
  if (typeof window === 'undefined') return false;

  const width = Number(window.innerWidth || 0);
  const coarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const reducedMotionPreference = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const cores = typeof navigator !== 'undefined' ? Number(navigator.hardwareConcurrency || 8) : 8;
  const memory = typeof navigator !== 'undefined' ? Number(navigator.deviceMemory || 8) : 8;

  return reducedMotionPreference || width <= 900 || coarsePointer || cores <= 4 || memory <= 4;
}

export function getAccessibilitySettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };

  return {
    reduceMotion: parseBoolean(STORAGE_KEYS.reduceMotion, DEFAULT_SETTINGS.reduceMotion),
    fontScale: parseFontScale(readFromStorage(STORAGE_KEYS.fontScale) || DEFAULT_SETTINGS.fontScale),
    dyslexiaFont: parseBoolean(STORAGE_KEYS.dyslexiaFont, DEFAULT_SETTINGS.dyslexiaFont),
    highContrast: parseBoolean(STORAGE_KEYS.highContrast, DEFAULT_SETTINGS.highContrast),
  };
}

export function applyAccessibilitySettings(settings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const lowCapabilityMode = isLowCapabilityDevice();
  const shouldReduceMotion = Boolean(settings.reduceMotion || lowCapabilityMode);

  root.classList.toggle('prefers-reduced-motion-ui', shouldReduceMotion);
  root.classList.toggle(LOW_CAPABILITY_CLASS, lowCapabilityMode);
  root.classList.toggle('a11y-dyslexia-font', Boolean(settings.dyslexiaFont));
  root.classList.toggle('a11y-high-contrast', Boolean(settings.highContrast));

  FONT_SCALE_CLASSES.forEach((cssClass) => root.classList.remove(cssClass));
  const fontScaleKey = parseFontScale(settings.fontScale);
  root.classList.add(FONT_SCALE_CLASS_MAP[fontScaleKey]);

  const fontScaleValue = FONT_SCALE_VALUES[fontScaleKey] || FONT_SCALE_VALUES.default;
  root.style.setProperty('--app-font-scale', String(fontScaleValue));
}

export function applyAccessibilitySettingsFromStorage() {
  const settings = getAccessibilitySettings();
  applyAccessibilitySettings(settings);
  return settings;
}

export function persistAccessibilitySetting(key, value) {
  writeToStorage(key, value);
}

export { STORAGE_KEYS, DEFAULT_SETTINGS, FONT_SCALE_VALUES };