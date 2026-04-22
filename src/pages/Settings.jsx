import React from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  Accessibility,
  Type,
} from 'lucide-react';
import {
  STORAGE_KEYS,
  getAccessibilitySettings,
  applyAccessibilitySettings,
  persistAccessibilitySetting,
} from '../services/accessibilitySettings';
import {
  OVERLAY_EFFECT_KEY,
  OVERLAY_INTENSITY_KEY,
  OVERLAY_SPEED_KEY,
  OVERLAY_EFFECT_OPTIONS,
  parseDashboardOverlayEffect,
  getDashboardOverlayEffectFromStorage,
  markDashboardOverlayEffectAsUserSet,
  parseDashboardOverlayIntensity,
  parseDashboardOverlaySpeed,
} from '../services/globalSettings';
import './Settings.css';

const SHOW_HINTS_KEY = 'settings.showHints';

const EFFECT_PREVIEW_IMAGES = {
  none: '/effects/none.svg',
  meteors: '/effects/meteors.svg',
  rain: '/effects/rain.svg',
  wind: '/effects/wind.svg',
  snow: '/effects/snow.svg',
  aurora: '/effects/aurora.svg',
  lightning: '/effects/lightning.svg',
  embers: '/effects/embers.svg',
  fireflies: '/effects/fireflies.svg',
  nebula: '/effects/nebula.svg',
  matrixrain: '/effects/matrixrain.svg',
};

function safeReadLocalStorage(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key, value) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function SettingSwitchRow({ title, description, checked, onChange }) {
  const switchId = React.useId();
  const headingId = `${switchId}-label`;
  const descriptionId = `${switchId}-description`;

  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <h4 id={headingId}>{title}</h4>
        <p id={descriptionId}>{description}</p>
      </div>
      <label className="settings-switch" htmlFor={switchId}>
        <input
          id={switchId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
        />
        <span className="settings-switch-track" />
      </label>
    </div>
  );
}

function SegmentedOption({ value, currentValue, onChange, label, previewType }) {
  const previewImage = previewType ? EFFECT_PREVIEW_IMAGES[previewType] : null;
  const isSelected = currentValue === value;

  return (
    <button
      type="button"
      className={`settings-segment-button ${currentValue === value ? 'is-active' : ''}`}
      onClick={() => onChange(value)}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
    >
      {previewType ? (
        <span
          className={`settings-effect-preview effect-${previewType}`}
          style={previewImage ? { backgroundImage: `url(${previewImage})` } : undefined}
          aria-hidden="true"
        />
      ) : null}
      {label}
    </button>
  );
}

function SliderRow({ title, description, value, onChange, min, max, step }) {
  const sliderId = React.useId();
  const titleId = `${sliderId}-label`;
  const descriptionId = `${sliderId}-description`;
  const valueId = `${sliderId}-value`;

  return (
    <div className="settings-row settings-row-column">
      <div className="settings-row-copy">
        <h4 id={titleId}>{title}</h4>
        <p id={descriptionId}>{description}</p>
      </div>
      <div className="settings-slider-group">
        <input
          id={sliderId}
          className="settings-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-labelledby={titleId}
          aria-describedby={`${descriptionId} ${valueId}`}
        />
        <output id={valueId} className="settings-slider-value" htmlFor={sliderId}>
          {value.toFixed(1)}x
        </output>
      </div>
    </div>
  );
}

export default function Settings() {
  const initialA11y = React.useMemo(() => getAccessibilitySettings(), []);

  const [reduceMotion, setReduceMotion] = React.useState(initialA11y.reduceMotion);
  const [fontScale, setFontScale] = React.useState(initialA11y.fontScale);
  const [dyslexiaFont, setDyslexiaFont] = React.useState(initialA11y.dyslexiaFont);
  const [highContrast, setHighContrast] = React.useState(initialA11y.highContrast);
  const [showHints, setShowHints] = React.useState(() => {
    const stored = safeReadLocalStorage(SHOW_HINTS_KEY);
    return stored == null ? true : stored === 'true';
  });
  const [dashboardOverlayEffect, setDashboardOverlayEffect] = React.useState(() =>
    getDashboardOverlayEffectFromStorage()
  );
  const [dashboardOverlayIntensity, setDashboardOverlayIntensity] = React.useState(() =>
    parseDashboardOverlayIntensity(safeReadLocalStorage(OVERLAY_INTENSITY_KEY))
  );
  const [dashboardOverlaySpeed, setDashboardOverlaySpeed] = React.useState(() =>
    parseDashboardOverlaySpeed(safeReadLocalStorage(OVERLAY_SPEED_KEY))
  );

  const handleOverlayEffectChange = React.useCallback((effect) => {
    const safeEffect = parseDashboardOverlayEffect(effect);
    markDashboardOverlayEffectAsUserSet();
    setDashboardOverlayEffect(safeEffect);
  }, []);

  const dispatchSettingUpdate = React.useCallback((key, value) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('app-settings-updated', {
        detail: { key, value },
      })
    );
  }, []);

  React.useEffect(() => {
    persistAccessibilitySetting(STORAGE_KEYS.reduceMotion, reduceMotion);
  }, [reduceMotion]);

  React.useEffect(() => {
    persistAccessibilitySetting(STORAGE_KEYS.fontScale, fontScale);
  }, [fontScale]);

  React.useEffect(() => {
    persistAccessibilitySetting(STORAGE_KEYS.dyslexiaFont, dyslexiaFont);
  }, [dyslexiaFont]);

  React.useEffect(() => {
    persistAccessibilitySetting(STORAGE_KEYS.highContrast, highContrast);
  }, [highContrast]);

  React.useEffect(() => {
    applyAccessibilitySettings({ reduceMotion, fontScale, dyslexiaFont, highContrast });
  }, [reduceMotion, fontScale, dyslexiaFont, highContrast]);

  React.useEffect(() => {
    safeWriteLocalStorage(SHOW_HINTS_KEY, String(showHints));
  }, [showHints]);

  React.useEffect(() => {
    safeWriteLocalStorage(OVERLAY_EFFECT_KEY, dashboardOverlayEffect);
    dispatchSettingUpdate(OVERLAY_EFFECT_KEY, dashboardOverlayEffect);
  }, [dashboardOverlayEffect, dispatchSettingUpdate]);

  React.useEffect(() => {
    const sanitizedIntensity = parseDashboardOverlayIntensity(dashboardOverlayIntensity);
    if (sanitizedIntensity !== dashboardOverlayIntensity) {
      setDashboardOverlayIntensity(sanitizedIntensity);
      return;
    }
    safeWriteLocalStorage(OVERLAY_INTENSITY_KEY, String(sanitizedIntensity));
    dispatchSettingUpdate(OVERLAY_INTENSITY_KEY, sanitizedIntensity);
  }, [dashboardOverlayIntensity, dispatchSettingUpdate]);

  React.useEffect(() => {
    const sanitizedSpeed = parseDashboardOverlaySpeed(dashboardOverlaySpeed);
    if (sanitizedSpeed !== dashboardOverlaySpeed) {
      setDashboardOverlaySpeed(sanitizedSpeed);
      return;
    }
    safeWriteLocalStorage(OVERLAY_SPEED_KEY, String(sanitizedSpeed));
    dispatchSettingUpdate(OVERLAY_SPEED_KEY, sanitizedSpeed);
  }, [dashboardOverlaySpeed, dispatchSettingUpdate]);

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h2 className="settings-title title-sparkle-effect">
          <SlidersHorizontal size={26} className="settings-title-icon" />
          Global Settings
        </h2>
        <p className="settings-subtitle">Control app-wide behavior and preferences for your entire workspace.</p>
      </header>

      <section className="settings-card">
        <div className="settings-card-head">
          <Accessibility size={16} />
          <h3>Accessibility</h3>
        </div>

        <div className="settings-row settings-row-column">
          <div className="settings-row-copy">
            <h4>
              <Type size={15} /> Font Size Scale
            </h4>
            <p>Change reading density app-wide without zooming your browser manually.</p>
          </div>
          <div className="settings-segment-group" role="radiogroup" aria-label="Font size scale">
            <SegmentedOption value="compact" currentValue={fontScale} onChange={setFontScale} label="Compact" />
            <SegmentedOption value="default" currentValue={fontScale} onChange={setFontScale} label="Default" />
            <SegmentedOption value="comfortable" currentValue={fontScale} onChange={setFontScale} label="Comfortable" />
            <SegmentedOption value="large" currentValue={fontScale} onChange={setFontScale} label="Large" />
          </div>
        </div>

        <SettingSwitchRow
          title="Dyslexia-Friendly Font"
          description="Switch body text to a high-legibility typeface with friendlier spacing."
          checked={dyslexiaFont}
          onChange={setDyslexiaFont}
        />
        <SettingSwitchRow
          title="High Contrast Mode"
          description="Increase text and UI boundary contrast for easier visual parsing."
          checked={highContrast}
          onChange={setHighContrast}
        />
        <SettingSwitchRow
          title="Reduce Motion"
          description="Minimize animation and transition intensity across the interface."
          checked={reduceMotion}
          onChange={setReduceMotion}
        />
      </section>

      <section className="settings-card">
        <div className="settings-card-head">
          <Sparkles size={16} />
          <h3>Experience</h3>
        </div>
        <div className="settings-row settings-row-column">
          <div className="settings-row-copy">
            <h4>Dashboard Overlay Effect</h4>
            <p>Apply an ambient visual effect behind the Dashboard workspace.</p>
          </div>
          <div className="settings-segment-group" role="radiogroup" aria-label="Dashboard overlay effect">
            {OVERLAY_EFFECT_OPTIONS.map((option) => (
              <SegmentedOption
                key={option.value}
                value={option.value}
                currentValue={dashboardOverlayEffect}
                onChange={handleOverlayEffectChange}
                label={option.label}
                previewType={option.value}
              />
            ))}
          </div>
        </div>
        <SliderRow
          title="Overlay Intensity"
          description="Control density and visual strength of ambient effects."
          value={dashboardOverlayIntensity}
          onChange={setDashboardOverlayIntensity}
          min={0.5}
          max={2}
          step={0.1}
        />
        <SliderRow
          title="Overlay Speed"
          description="Control animation speed for selected overlay effect."
          value={dashboardOverlaySpeed}
          onChange={setDashboardOverlaySpeed}
          min={0.5}
          max={2}
          step={0.1}
        />
        <SettingSwitchRow
          title="Show Learning Hints"
          description="Keep helper hints visible in study and authoring flows."
          checked={showHints}
          onChange={setShowHints}
        />
      </section>
    </div>
  );
}

