import { useState, useEffect, useRef } from 'react';
import { SESSION_STATUS } from './pomodoroEngine';

export function usePomodoroTimer(session, dispatch) {
  const [remaining, setRemaining] = useState(() =>
    session.status === SESSION_STATUS.RUNNING
      ? Math.max(0, session.plannedDuration - Math.floor((Date.now() - session.startedAt) / 1000))
      : session.plannedDuration
  );

  const activeSessionIdRef = useRef(null);
  const sessionRef = useRef(session);
  const dispatchRef = useRef(dispatch);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
  }, [session.id]);

  useEffect(() => {
    sessionRef.current = session;
    dispatchRef.current = dispatch;
  }, [session, dispatch]);

  useEffect(() => {
    if (session.status !== SESSION_STATUS.RUNNING) {
      activeSessionIdRef.current = null;
      return undefined;
    }

    let rafId = null;
    let fallbackTimeoutId = null;
    activeSessionIdRef.current = session.id;

    const updateUi = () => {
      if (!activeSessionIdRef.current || sessionRef.current.status !== SESSION_STATUS.RUNNING || sessionRef.current.id !== activeSessionIdRef.current) {
        return;
      }

      const currentSession = sessionRef.current;
      const elapsedSecs = Math.floor((Date.now() - currentSession.startedAt) / 1000);
      const r = Math.max(0, currentSession.plannedDuration - elapsedSecs);

      setRemaining(r);

      if (r <= 0) {
        if (activeSessionIdRef.current === currentSession.id) {
          activeSessionIdRef.current = null;
          if (fallbackTimeoutId !== null) clearTimeout(fallbackTimeoutId);
          if (!completedRef.current) {
            completedRef.current = true;
            dispatchRef.current({ type: 'AUTO_COMPLETE' });
          }
        }
        return;
      }

      rafId = requestAnimationFrame(updateUi);
    };

    const checkBackgroundTimer = () => {
      if (completedRef.current) return;
      if (!activeSessionIdRef.current || sessionRef.current.status !== SESSION_STATUS.RUNNING || sessionRef.current.id !== activeSessionIdRef.current) {
        return;
      }

      const currentSession = sessionRef.current;
      const elapsedSecs = Math.floor((Date.now() - currentSession.startedAt) / 1000);
      if (elapsedSecs >= currentSession.plannedDuration) {
        if (activeSessionIdRef.current === currentSession.id) {
          activeSessionIdRef.current = null;
          if (fallbackTimeoutId !== null) clearTimeout(fallbackTimeoutId);
          setRemaining(0);
          if (!completedRef.current) {
            completedRef.current = true;
            dispatchRef.current({ type: 'AUTO_COMPLETE' });
          }
        }
      } else {
        fallbackTimeoutId = setTimeout(checkBackgroundTimer, 1000);
      }
    };

    rafId = requestAnimationFrame(updateUi);
    fallbackTimeoutId = setTimeout(checkBackgroundTimer, 1000);

    return () => {
      activeSessionIdRef.current = null;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (fallbackTimeoutId !== null) clearTimeout(fallbackTimeoutId);
    };
  }, [session.status, session.startedAt, session.plannedDuration, session.id]);

  return remaining;
}
