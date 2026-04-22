import React from 'react';
import { subscribeToRouteTransitionLoader } from '../services/routeTransitionLoader';

const SHOW_DELAY_MS = 140;

export default function SingletonRouteLoader() {
  const [isVisible, setIsVisible] = React.useState(false);
  const isVisibleRef = React.useRef(false);
  const lockCountRef = React.useRef(0);
  const pulseTimerRef = React.useRef(null);
  const lockSafetyTimerRef = React.useRef(null);
  const showDelayTimerRef = React.useRef(null);

  React.useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  React.useEffect(() => {
    const clearPulseTimer = () => {
      if (typeof pulseTimerRef.current === 'number') {
        window.clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    };

    const clearLockSafetyTimer = () => {
      if (typeof lockSafetyTimerRef.current === 'number') {
        window.clearTimeout(lockSafetyTimerRef.current);
        lockSafetyTimerRef.current = null;
      }
    };

    const clearShowDelayTimer = () => {
      if (typeof showDelayTimerRef.current === 'number') {
        window.clearTimeout(showDelayTimerRef.current);
        showDelayTimerRef.current = null;
      }
    };

    const showWithDelay = () => {
      if (isVisibleRef.current || typeof showDelayTimerRef.current === 'number') {
        return;
      }
      showDelayTimerRef.current = window.setTimeout(() => {
        showDelayTimerRef.current = null;
        setIsVisible(true);
      }, SHOW_DELAY_MS);
    };

    const armLockSafetyTimer = () => {
      clearLockSafetyTimer();
      lockSafetyTimerRef.current = window.setTimeout(() => {
        lockSafetyTimerRef.current = null;
        lockCountRef.current = 0;
        clearPulseTimer();
        clearShowDelayTimer();
        setIsVisible(false);
      }, 4500);
    };

    const syncVisibility = () => {
      if (lockCountRef.current > 0) {
        setIsVisible(true);
      }
    };

    const unsubscribe = subscribeToRouteTransitionLoader(({ action, duration }) => {
      if (action === 'start') {
        lockCountRef.current += 1;
        showWithDelay();
        armLockSafetyTimer();
        return;
      }

      if (action === 'stop') {
        lockCountRef.current = Math.max(0, lockCountRef.current - 1);
        if (lockCountRef.current === 0) {
          clearLockSafetyTimer();
          clearPulseTimer();
          clearShowDelayTimer();
          setIsVisible(false);
        } else {
          armLockSafetyTimer();
        }
        return;
      }

      if (action === 'pulse') {
        const pulseDuration = Math.max(120, Number(duration) || 260);
        if (pulseDuration > SHOW_DELAY_MS) {
          showWithDelay();
        }
        clearPulseTimer();
        pulseTimerRef.current = window.setTimeout(() => {
          pulseTimerRef.current = null;
          if (lockCountRef.current === 0) {
            clearShowDelayTimer();
            setIsVisible(false);
          }
        }, pulseDuration);
      }
    });

    syncVisibility();

    return () => {
      clearLockSafetyTimer();
      clearPulseTimer();
      clearShowDelayTimer();
      unsubscribe();
    };
  }, []);

  return (
    <div
      className={`singleton-route-loader ${isVisible ? 'is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={!isVisible}
      aria-label={isVisible ? 'Loading next view' : undefined}
    >
      <div className="singleton-route-loader-track">
        <span className="singleton-route-loader-bar singleton-route-loader-bar-primary" />
        <span className="singleton-route-loader-bar singleton-route-loader-bar-secondary" />
      </div>
    </div>
  );
}
