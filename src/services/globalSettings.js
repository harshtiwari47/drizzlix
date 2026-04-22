export const OVERLAY_EFFECT_KEY = 'settings.dashboardOverlayEffect';
export const OVERLAY_INTENSITY_KEY = 'settings.dashboardOverlayIntensity';
export const OVERLAY_SPEED_KEY = 'settings.dashboardOverlaySpeed';
export const OVERLAY_EFFECT_USER_SET_KEY = 'settings.dashboardOverlayEffectUserSet';
export const AVATAR_EFFECT_KEY = 'settings.profileAvatarEffect';

export const OVERLAY_EFFECT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'meteors', label: 'Meteors' },
  { value: 'rain', label: 'Rain' },
  { value: 'wind', label: 'Wind' },
  { value: 'snow', label: 'Snow' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'lightning', label: 'Lightning' },
  { value: 'embers', label: 'Embers' },
  { value: 'fireflies', label: 'Fireflies' },
  { value: 'nebula', label: 'Nebula' },
  { value: 'matrixrain', label: 'Matrix Rain' },
];

const VALID_OVERLAYS = new Set(OVERLAY_EFFECT_OPTIONS.map((option) => option.value));

export const AVATAR_EFFECT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'angel', label: 'Angel Halo' },
  { value: 'flame', label: 'Flame Crown' },
  { value: 'lightning', label: 'Lightning Rift' },
  { value: 'vortex', label: 'Nebula Vortex' },
  { value: 'glitch', label: 'Glitch Orbit' },
  { value: 'solarstorm', label: 'Solar Storm' },
];

const VALID_AVATAR_EFFECTS = new Set(AVATAR_EFFECT_OPTIONS.map((option) => option.value));

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isLowCapabilityDevice() {
  if (typeof window === 'undefined') return false;

  const width = window.innerWidth || 0;
  const coarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

  const cores = typeof navigator !== 'undefined' ? Number(navigator.hardwareConcurrency || 0) : 0;
  const memory = typeof navigator !== 'undefined' ? Number(navigator.deviceMemory || 0) : 0;

  return width <= 760 || coarsePointer || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);
}

function hasUserSetOverlayPreference() {
  if (typeof window === 'undefined') return false;
  return readFromStorage(OVERLAY_EFFECT_USER_SET_KEY) === 'true';
}

export function parseDashboardOverlayEffect(value) {
  if (typeof value !== 'string') return 'none';
  const normalized = value.trim().toLowerCase();
  return VALID_OVERLAYS.has(normalized) ? normalized : 'none';
}

export function markDashboardOverlayEffectAsUserSet() {
  writeToStorage(OVERLAY_EFFECT_USER_SET_KEY, 'true');
}

export function parseProfileAvatarEffect(value) {
  if (typeof value !== 'string') return 'none';
  const normalized = value.trim().toLowerCase();
  return VALID_AVATAR_EFFECTS.has(normalized) ? normalized : 'none';
}

export function getDashboardOverlayEffectFromStorage() {
  if (typeof window === 'undefined') return 'none';

  const stored = parseDashboardOverlayEffect(readFromStorage(OVERLAY_EFFECT_KEY));
  if (!hasUserSetOverlayPreference() && isLowCapabilityDevice()) {
    return 'none';
  }

  return stored;
}

export function parseDashboardOverlayIntensity(value) {
  if (value === null || value === undefined) return 1;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return clamp(numeric, 0.5, 2);
}

export function parseDashboardOverlaySpeed(value) {
  if (value === null || value === undefined) return 1;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return clamp(numeric, 0.5, 2);
}

export function getDashboardOverlayControlsFromStorage() {
  if (typeof window === 'undefined') {
    return { effect: 'none', intensity: 1, speed: 1 };
  }

  return {
    effect: getDashboardOverlayEffectFromStorage(),
    intensity: parseDashboardOverlayIntensity(readFromStorage(OVERLAY_INTENSITY_KEY)),
    speed: parseDashboardOverlaySpeed(readFromStorage(OVERLAY_SPEED_KEY)),
  };
}
