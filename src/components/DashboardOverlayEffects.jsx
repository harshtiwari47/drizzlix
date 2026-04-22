import React from 'react';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildItems(count, config) {
  return Array.from({ length: count }, (_, index) => {
    const left = Math.round((index / count) * 100 + Math.random() * 8);
    return {
      id: `${config.prefix}-${index}`,
      left: `${Math.min(left, 99)}%`,
      delay: `${(Math.random() * config.maxDelay).toFixed(2)}s`,
      duration: `${(config.minDuration + Math.random() * config.durationVariance).toFixed(2)}s`,
      opacity: (config.minOpacity + Math.random() * config.opacityVariance).toFixed(2),
      scale: (config.minScale + Math.random() * config.scaleVariance).toFixed(2),
      top: `${Math.round(Math.random() * 95)}%`,
    };
  });
}

function buildCodeStream(length) {
  const chars = '01{}[]<>/$#@+*=-:;';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
}

const DashboardOverlayEffects = React.memo(function DashboardOverlayEffects({ effect = 'none', intensity = 1, speed = 1 }) {
  const normalizedIntensity = clamp(Number(intensity) || 1, 0.5, 2);
  const normalizedSpeed = clamp(Number(speed) || 1, 0.5, 2);
  const [viewportWidth, setViewportWidth] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setViewportWidth(window.innerWidth);
      setPrefersReducedMotion(mediaQuery.matches);
    };

    update();
    window.addEventListener('resize', update);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update);
    } else {
      mediaQuery.addListener(update);
    }

    return () => {
      window.removeEventListener('resize', update);
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', update);
      } else {
        mediaQuery.removeListener(update);
      }
    };
  }, []);

  const isCompactDevice = viewportWidth <= 760;
  const lowCapabilityMode = typeof document !== 'undefined' && document.documentElement.classList.contains('low-end-device-ui');
  const performanceScale = React.useMemo(() => {
    let scale = isCompactDevice ? 0.62 : 1;
    if (typeof navigator !== 'undefined') {
      const cores = Number(navigator.hardwareConcurrency || 8);
      if (cores <= 4) scale *= 0.75;
      if (cores <= 2) scale *= 0.7;
    }
    return clamp(scale, 0.25, 1);
  }, [isCompactDevice]);

  const meteorItems = React.useMemo(
    () => buildItems(16, { prefix: 'm', maxDelay: 6, minDuration: 2.6, durationVariance: 2.2, minOpacity: 0.28, opacityVariance: 0.52, minScale: 0.8, scaleVariance: 0.9 }),
    []
  );

  const rainItems = React.useMemo(
    () => buildItems(52, { prefix: 'r', maxDelay: 2.3, minDuration: 0.85, durationVariance: 0.8, minOpacity: 0.14, opacityVariance: 0.45, minScale: 0.75, scaleVariance: 0.7 }),
    []
  );

  const windItems = React.useMemo(
    () => buildItems(34, { prefix: 'w', maxDelay: 2.4, minDuration: 2.2, durationVariance: 1.5, minOpacity: 0.34, opacityVariance: 0.5, minScale: 0.8, scaleVariance: 0.9 }),
    []
  );

  const windDebrisItems = React.useMemo(
    () => buildItems(26, { prefix: 'wd', maxDelay: 1.9, minDuration: 2.4, durationVariance: 1.9, minOpacity: 0.3, opacityVariance: 0.55, minScale: 0.7, scaleVariance: 1.25 }),
    []
  );

  const windHazeItems = React.useMemo(
    () =>
      Array.from({ length: 3 }, (_, index) => ({
        id: `wh-${index}`,
        top: `${18 + index * 24}%`,
        delay: `${(index * 0.9).toFixed(2)}s`,
        duration: `${(4.8 + index * 1.1).toFixed(2)}s`,
        opacity: (0.16 + index * 0.05).toFixed(2),
        scale: (1 + index * 0.1).toFixed(2),
      })),
    []
  );

  const snowItems = React.useMemo(
    () => buildItems(44, { prefix: 's', maxDelay: 5.2, minDuration: 4.4, durationVariance: 3.4, minOpacity: 0.25, opacityVariance: 0.45, minScale: 0.5, scaleVariance: 1.1 }),
    []
  );

  const auroraItems = React.useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => ({
        id: `a-${index}`,
        top: `${3 + index * 10}%`,
        delay: `${(index * 1.1).toFixed(2)}s`,
        duration: `${(9.5 + index * 2.2).toFixed(2)}s`,
        opacity: (0.22 + index * 0.05).toFixed(2),
        scale: (1 + index * 0.08).toFixed(2),
      })),
    []
  );

  const lightningItems = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        id: `l-${index}`,
        top: `${(2 + seededRandom(index + 1) * 16).toFixed(2)}%`,
        left: `${(8 + seededRandom(index + 9) * 80).toFixed(2)}%`,
        delay: `${(seededRandom(index + 17) * 5 + index * 0.18).toFixed(2)}s`,
        duration: `${(0.55 + seededRandom(index + 25) * 0.55).toFixed(2)}s`,
        opacity: (0.55 + seededRandom(index + 33) * 0.35).toFixed(2),
        scale: (0.9 + seededRandom(index + 41) * 0.45).toFixed(2),
        height: `${(28 + seededRandom(index + 49) * 26).toFixed(2)}vh`,
        tilt: `${(-13 + seededRandom(index + 57) * 26).toFixed(2)}deg`,
      })),
    []
  );

  const emberItems = React.useMemo(
    () => buildItems(36, { prefix: 'e', maxDelay: 4.5, minDuration: 3.1, durationVariance: 2.8, minOpacity: 0.22, opacityVariance: 0.5, minScale: 0.55, scaleVariance: 1.15 }),
    []
  );

  const fireflyItems = React.useMemo(
    () => buildItems(24, { prefix: 'f', maxDelay: 3.6, minDuration: 4.5, durationVariance: 3.2, minOpacity: 0.25, opacityVariance: 0.5, minScale: 0.7, scaleVariance: 1.05 }),
    []
  );

  const nebulaCloudItems = React.useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => ({
        id: `n-${index}`,
        top: `${8 + index * 14}%`,
        delay: `${(index * 1.25).toFixed(2)}s`,
        duration: `${(10.5 + index * 1.7).toFixed(2)}s`,
        opacity: (0.2 + index * 0.08).toFixed(2),
        scale: (0.92 + index * 0.09).toFixed(2),
      })),
    []
  );

  const matrixRainItems = React.useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        id: `mr-${index}`,
        left: `${Math.round((index / 34) * 100)}%`,
        delay: `${(seededRandom(index + 101) * 2.8).toFixed(2)}s`,
        duration: `${(1.6 + seededRandom(index + 137) * 2.2).toFixed(2)}s`,
        opacity: (0.25 + seededRandom(index + 173) * 0.55).toFixed(2),
        scale: (0.7 + seededRandom(index + 209) * 0.6).toFixed(2),
        head: buildCodeStream(1),
        trail: buildCodeStream(4 + Math.floor(seededRandom(index + 241) * 8)).split('').join('\n'),
      })),
    []
  );

  if (effect === 'none' || prefersReducedMotion || lowCapabilityMode) return null;

  const getVisibleCount = (items, baseMin = 1) => {
    const minCount = Math.max(1, Math.min(baseMin, items.length));
    const intensityTarget = Math.max(minCount, Math.floor(items.length * normalizedIntensity));
    const scaledTarget = Math.max(minCount, Math.floor(intensityTarget * performanceScale));
    return items.slice(0, Math.min(items.length, scaledTarget));
  };

  const durationBySpeed = (durationText) => {
    const numeric = Number.parseFloat(String(durationText).replace('s', ''));
    const speedAdjusted = Number.isFinite(numeric) ? numeric / normalizedSpeed : 1;
    const compactAdjusted = speedAdjusted * (isCompactDevice ? 1.12 : 1);
    const adjusted = Math.max(0.7, compactAdjusted);
    return `${adjusted.toFixed(2)}s`;
  };

  const boostedOpacity = (opacityValue) => {
    const numeric = Number.parseFloat(String(opacityValue));
    const adjusted = Number.isFinite(numeric) ? numeric * (0.8 + normalizedIntensity * 0.3) : 0.5;
    return Math.min(1, adjusted).toFixed(2);
  };

  return (
    <div className={`dashboard-overlay-effects dashboard-overlay-${effect}`} aria-hidden="true">
      {effect === 'meteors' &&
        getVisibleCount(meteorItems, 8).map((item) => (
          <span
            key={item.id}
            className="overlay-meteor"
            style={{
              left: item.left,
              '--overlay-delay': item.delay,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(item.opacity),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'rain' &&
        getVisibleCount(rainItems, 20).map((item) => (
          <span
            key={item.id}
            className="overlay-rain-drop"
            style={{
              left: item.left,
              '--overlay-delay': item.delay,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(item.opacity),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'wind' &&
        getVisibleCount(windItems, 16).map((item) => (
          <span
            key={item.id}
            className="overlay-wind-streak"
            style={{
              top: item.top,
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(Math.max(Number(item.opacity), 0.65)),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'wind' &&
        getVisibleCount(windDebrisItems, 12).map((item) => (
          <span
            key={item.id}
            className="overlay-wind-debris"
            style={{
              top: item.top,
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(Math.max(Number(item.opacity), 0.7)),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'wind' &&
        windHazeItems.map((item) => (
          <span
            key={item.id}
            className="overlay-wind-haze"
            style={{
              top: item.top,
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(item.opacity),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'snow' &&
        getVisibleCount(snowItems, 18).map((item) => (
          <span
            key={item.id}
            className="overlay-snowflake"
            style={{
              left: item.left,
              '--overlay-delay': item.delay,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(item.opacity),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'aurora' &&
        getVisibleCount(auroraItems, 2).map((item) => (
          <span
            key={item.id}
            className="overlay-aurora-ribbon"
            style={{
              top: item.top,
              '--overlay-delay': item.delay,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(item.opacity),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'lightning' &&
        getVisibleCount(lightningItems, 4).map((item) => (
          <span
            key={item.id}
            className="overlay-lightning"
            style={{
              top: item.top,
              left: item.left,
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(Math.max(Number(item.opacity), 0.72)),
              '--overlay-scale': item.scale,
              '--overlay-height': item.height,
              '--overlay-tilt': item.tilt,
            }}
          />
        ))}

      {effect === 'lightning' &&
        getVisibleCount(lightningItems, 2).map((item) => (
          <span
            key={`flash-${item.id}`}
            className="overlay-lightning-flash"
            style={{
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(Math.max(Number(item.opacity), 0.68)),
            }}
          />
        ))}

      {effect === 'embers' &&
        getVisibleCount(emberItems, 16).map((item) => (
          <span
            key={item.id}
            className="overlay-ember"
            style={{
              left: item.left,
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(Math.max(Number(item.opacity), 0.62)),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'fireflies' &&
        getVisibleCount(fireflyItems, 10).map((item) => (
          <span
            key={item.id}
            className="overlay-firefly"
            style={{
              left: item.left,
              top: item.top,
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(item.opacity),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'nebula' &&
        getVisibleCount(nebulaCloudItems, 3).map((item) => (
          <span
            key={item.id}
            className="overlay-nebula-cloud"
            style={{
              top: item.top,
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(item.opacity),
              '--overlay-scale': item.scale,
            }}
          />
        ))}

      {effect === 'matrixrain' &&
        getVisibleCount(matrixRainItems, 12).map((item) => (
          <span
            key={item.id}
            className="overlay-matrix-stream"
            style={{
              left: item.left,
              '--overlay-delay': `-${item.delay}`,
              '--overlay-duration': durationBySpeed(item.duration),
              '--overlay-opacity': boostedOpacity(item.opacity),
              '--overlay-scale': item.scale,
            }}
          >
            <span className="overlay-matrix-head">{item.head}</span>
            <span className="overlay-matrix-tail">{item.trail}</span>
          </span>
        ))}
    </div>
  );
});

export default DashboardOverlayEffects;

