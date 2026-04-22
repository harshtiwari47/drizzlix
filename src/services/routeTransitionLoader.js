const ROUTE_TRANSITION_LOADER_EVENT = 'app-route-transition-loader';

function dispatchRouteTransitionLoader(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ROUTE_TRANSITION_LOADER_EVENT, { detail }));
}

export function startRouteTransitionLoader() {
  dispatchRouteTransitionLoader({ action: 'start' });
}

export function stopRouteTransitionLoader() {
  dispatchRouteTransitionLoader({ action: 'stop' });
}

export function pulseRouteTransitionLoader(durationMs = 260) {
  const duration = Math.max(120, Number(durationMs) || 260);
  dispatchRouteTransitionLoader({ action: 'pulse', duration });
}

export function subscribeToRouteTransitionLoader(listener) {
  if (typeof window === 'undefined' || typeof listener !== 'function') {
    return () => {};
  }

  const handleEvent = (event) => {
    listener(event?.detail || {});
  };

  window.addEventListener(ROUTE_TRANSITION_LOADER_EVENT, handleEvent);
  return () => {
    window.removeEventListener(ROUTE_TRANSITION_LOADER_EVENT, handleEvent);
  };
}
