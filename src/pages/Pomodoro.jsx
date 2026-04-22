import React, { useEffect, useState, useReducer, useRef, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  Play, Square, Plus, Check, Trash2, History, Timer as TimerIcon, CircleDot, Coffee
} from 'lucide-react';

import DashboardOverlayEffects from '../components/DashboardOverlayEffects';
import { useAuth } from '../context/AuthContext';
import {
  OVERLAY_EFFECT_KEY, OVERLAY_INTENSITY_KEY, OVERLAY_SPEED_KEY,
  getDashboardOverlayEffectFromStorage, parseDashboardOverlayEffect,
  parseDashboardOverlayIntensity, parseDashboardOverlaySpeed,
} from '../services/globalSettings';

import { getPomodoroState, savePomodoroState } from '../services/db';

// Extract Engine, Hooks, Sync
import {
  reducer, initialState, normalizePomodoroState,
  SESSION_STATUS, SESSION_MODE, MIN_FOCUS_MINUTES, MAX_FOCUS_MINUTES
} from './Pomodoro/pomodoroEngine';
import { usePomodoroTimer } from './Pomodoro/usePomodoroTimer';
import { performCloudPush, pullAndReconcileCloudState, setupBeforeUnloadSync } from './Pomodoro/sync';

import './Pomodoro.css';

const CLOUD_SYNC_DEBOUNCE_MS = 900;

// ---------------------------------------------------------------------
// Utility formatting
// ---------------------------------------------------------------------
const formatClock = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------
// Clock Display Component (Isolates Re-renders via Hook)
// ---------------------------------------------------------------------
const ClockDisplay = memo(function ClockDisplay({ session, dispatch }) {
  const remaining = usePomodoroTimer(session, dispatch);

  const percent = session.plannedDuration > 0
    ? Math.min(100, Math.max(0, ((session.plannedDuration - remaining) / session.plannedDuration) * 100))
    : 0;

  const isBreak = session.mode !== SESSION_MODE.FOCUS;

  return (
    <div className={`clock clock-focus ${isBreak ? 'clock-break' : ''}`} style={{ '--clock-progress': `${percent}%` }}>
      {isBreak && <Coffee className="clock-break-icon" size={28} strokeWidth={1.5} />}
      <span className="clock-time-text">{formatClock(remaining)}</span>
    </div>
  );
});

// ---------------------------------------------------------------------
// Task List Component
// ---------------------------------------------------------------------
const TaskList = memo(function TaskList({
  tasks, selectedTaskId, sessionStatus, onSelectTask, onToggleTaskDone, onDeleteTask,
}) {
  return (
    <ul className="task-list app-content-visibility-list">
      {tasks.length === 0 && <li className="task-empty">No tasks yet. Add one to begin focus.</li>}
      {tasks.map((task) => {
        const active = task.id === selectedTaskId;
        const blockedByRunning = sessionStatus === SESSION_STATUS.RUNNING && !active;

        return (
          <li key={task.id} className={`${active ? 'active' : ''} ${task.status === 'done' ? 'is-done' : ''}`}>
            <button
              type="button"
              className="task-main"
              onClick={() => onSelectTask(task.id)}
              disabled={blockedByRunning}
            >
              <span>{task.title}</span>
              <small className="task-state">{task.status}</small>
            </button>

            <div className="task-actions">
              <button
                type="button"
                aria-label={task.status === 'done' ? 'Reopen task' : 'Mark task done'}
                onClick={() => onToggleTaskDone(task.id)}
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                className="danger"
                aria-label="Delete task"
                onClick={() => onDeleteTask(task.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
});

// ---------------------------------------------------------------------
// History Modal Component
// ---------------------------------------------------------------------
const HistoryModal = memo(function HistoryModal({ isOpen, rows, onClose, onClear }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="pomodoro-modal-overlay" role="presentation" onClick={onClose}>
      <div className="pomodoro-modal card" role="dialog" aria-modal="true" aria-label="History and rules" onClick={(event) => event.stopPropagation()}>
        <div className="pomodoro-modal-header">
          <h2>History Records</h2>
          <div className="pomodoro-modal-actions">
            {rows.length > 0 && (
              <button type="button" className="danger mode-button" onClick={onClear} style={{ marginRight: '8px' }}>
                Clear History
              </button>
            )}
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Mode</th>
                <th>Task</th>
                <th>Duration</th>
                <th>Reason</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6}>No finished sessions yet.</td></tr>
              )}
              {rows.map((record) => (
                <tr key={record.id}>
                  <td>{record.status}</td>
                  <td>{record.mode}</td>
                  <td>{record.taskSnapshotTitle}</td>
                  <td>{record.plannedLabel}</td>
                  <td>{record.spoilReason || '-'}</td>
                  <td>{record.endedLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="rules-title">Rules</h3>
        <ul className="rules-list">
          <li>Task is required before a focus session starts.</li>
          <li>Strict Pomodoro mode: Pauses are not allowed. Interruption spoils the focus.</li>
          <li>System auto-transitions focus → short/long break → focus continuously.</li>
        </ul>
      </div>
    </div>,
    document.body
  );
});

// ---------------------------------------------------------------------
// Main Pomodoro Component
// ---------------------------------------------------------------------
export default function Pomodoro() {
  const { token, user } = useAuth();

  const [isLoaded, setIsLoaded] = useState(false);
  const [state, dispatch] = useReducer(reducer, initialState);

  const [taskInput, setTaskInput] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [dashboardOverlayEffect, setDashboardOverlayEffect] = useState(() => getDashboardOverlayEffectFromStorage());
  const [dashboardOverlayIntensity, setDashboardOverlayIntensity] = useState(() => parseDashboardOverlayIntensity(localStorage.getItem(OVERLAY_INTENSITY_KEY)));
  const [dashboardOverlaySpeed, setDashboardOverlaySpeed] = useState(() => parseDashboardOverlaySpeed(localStorage.getItem(OVERLAY_SPEED_KEY)));

  const ownerKey = useMemo(() => user?.userId || user?._id || user?.id || user?.email || user?.username || null, [user]);
  const stateRef = useRef(state);
  const cloudSyncDebounceTimerRef = useRef(null);
  const lastLocalVersionRef = useRef(0);

  const safeDispatch = (action) => {
    console.log('[POMODORO] safeDispatch triggered:', action.type);
    dispatch(action);
  };

  // 1. Initial Load & Synchronization Pipeline
  useEffect(() => {
    let active = true;
    const initializeEcosystem = async () => {
      // Step A: Load locally backed state instantly
      const localState = await getPomodoroState(ownerKey || 'default');
      if (active) {
        if (localState) dispatch({ type: 'LOAD_STATE', payload: normalizePomodoroState(localState) });
        setIsLoaded(true);
      }

      // Step B: Connect to cloud asynchronously and perform timestamp reconciliation
      if (token && active) {
        // Will dispatch inside if Cloud gives a newer payload
        await pullAndReconcileCloudState(token, ownerKey, dispatch);
      }
    };

    initializeEcosystem();
    return () => { active = false; };
  }, [ownerKey, token]);

  // 2. Synchronize to IDB & Cloud upon Mutation
  const previousUpdatedAtRef = useRef(0);

  useEffect(() => {
    if (isLoaded) {
      stateRef.current = state;

      // Correct version tracking
      lastLocalVersionRef.current = state.updatedAt || 0;

      if (state.updatedAt === previousUpdatedAtRef.current) return;
      previousUpdatedAtRef.current = state.updatedAt;

      // Floating timeout ensures IDB writes don't get magically destroyed unmounting
      setTimeout(() => {
        savePomodoroState(state, ownerKey || 'default').catch(console.error);
      }, 300);
    }
  }, [state, isLoaded, ownerKey]);

  useEffect(() => {
    if (!token || !isLoaded) return undefined;
    if (typeof cloudSyncDebounceTimerRef.current === 'number') {
      window.clearTimeout(cloudSyncDebounceTimerRef.current);
    }

    // [ANTI PING-PONG] Do not echo network loads back to the network.
    if (state.__localMutation === false) {
      console.log('[POMODORO] Skipping push because state was a pure network load.');
      return;
    }

    // Cloud Debounce Write
    cloudSyncDebounceTimerRef.current = window.setTimeout(() => {
      console.log('[POMODORO] Debounce timer firing performCloudPush. Current Local State UpdatedAt:', state.updatedAt);
      performCloudPush(state, token, ownerKey, dispatch);
    }, CLOUD_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(cloudSyncDebounceTimerRef.current);
  }, [state, isLoaded, ownerKey, token]);

  // 3. Bind rapid termination syncs on Tab Close
  useEffect(() => {
    return setupBeforeUnloadSync(stateRef, token);
  }, [token]);

  // 4. Client Polling (SMART POLLING)
  const isPollingRef = useRef(false);
  const pollIdRef = useRef(0);

  useEffect(() => {
    if (!token || !isLoaded) return undefined;

    let pollingTimerId = null;

    const performPoll = async () => {
      if (document.hidden) {
        if (!isPollingRef.current) {
          scheduleNextPoll(15000);
        }
        return;
      }

      if (isPollingRef.current) return;
      isPollingRef.current = true;
      const pollId = ++pollIdRef.current;
      
      console.log("Polling...");

      try {
        const url = `${import.meta.env.VITE_API_URL || '/api'}/pomodoro-state`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          const serverState = data?.state;

          if (serverState && serverState.updatedAt != null) {
            const serverUpAt = Number(serverState.updatedAt);
            const localUpAt = Number(stateRef.current.updatedAt || 0);

            console.log("LOCAL:", localUpAt);
            console.log("SERVER:", serverUpAt);

            if (serverUpAt > localUpAt) {
              console.log("[POLL] Server state is technically newer. Checking local version bounds...");
              // BLOCK stale server overwrite
              if (serverUpAt <= lastLocalVersionRef.current) {
                console.warn("[POLL] Rejecting overwrite because serverUpAt is within locally tracked version limit.");
                return;
              }

              if (pollId !== pollIdRef.current) return;
              console.log("[POLL] dispatching LOAD_STATE from polling loop.");
              dispatch({ type: 'LOAD_STATE', payload: normalizePomodoroState(serverState) });
            }
          }
        }
      } catch (err) {
        // Silent catch for background polling
      } finally {
        isPollingRef.current = false;
        const isRunningNow = stateRef.current.session.status === SESSION_STATUS.RUNNING;
        const nextInterval = isRunningNow ? 3000 : 12000;
        scheduleNextPoll(nextInterval);
      }
    };

    const scheduleNextPoll = (ms) => {
      pollingTimerId = window.setTimeout(performPoll, ms);
    };

    // Initial scheduling
    scheduleNextPoll(stateRef.current.session.status === SESSION_STATUS.RUNNING ? 3000 : 12000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (pollingTimerId !== null) window.clearTimeout(pollingTimerId);
        performPoll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', performPoll);

    return () => {
      if (pollingTimerId !== null) window.clearTimeout(pollingTimerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', performPoll);
    };
  }, [token, isLoaded]);

  // ---------------------------------------------------------------------
  // Presentation
  // ---------------------------------------------------------------------
  useEffect(() => {
    const syncOverlayEffect = () => {
      setDashboardOverlayEffect(getDashboardOverlayEffectFromStorage());
      setDashboardOverlayIntensity(parseDashboardOverlayIntensity(localStorage.getItem(OVERLAY_INTENSITY_KEY)));
      setDashboardOverlaySpeed(parseDashboardOverlaySpeed(localStorage.getItem(OVERLAY_SPEED_KEY)));
    };
    const handleStorage = (event) => {
      if (!event.key || event.key.startsWith('settings.dashboardOverlay')) syncOverlayEffect();
    };
    const handleSettingsUpdated = (event) => {
      if (event?.detail?.key === OVERLAY_EFFECT_KEY) setDashboardOverlayEffect(parseDashboardOverlayEffect(event.detail.value));
      if (event?.detail?.key === OVERLAY_INTENSITY_KEY) setDashboardOverlayIntensity(parseDashboardOverlayIntensity(event.detail.value));
      if (event?.detail?.key === OVERLAY_SPEED_KEY) setDashboardOverlaySpeed(parseDashboardOverlaySpeed(event.detail.value));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('app-settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('app-settings-updated', handleSettingsUpdated);
    };
  }, []);

  const selectedTask = useMemo(() => state.tasks.find((t) => t.id === state.selectedTaskId) || null, [state.tasks, state.selectedTaskId]);
  const tasksForDisplay = useMemo(() => {
    const activeList = state.tasks.filter(t => !t.deleted);
    if (!state.selectedTaskId || !selectedTask || selectedTask.deleted) return activeList;
    return [selectedTask, ...activeList.filter((t) => t.id !== state.selectedTaskId)];
  }, [state.tasks, state.selectedTaskId, selectedTask]);

  const { completedCount, abortedCount, completionRate } = useMemo(() => {
    let completed = 0;
    let aborted = 0;
    for (const item of state.history) {
      if (item.mode !== SESSION_MODE.FOCUS) continue;
      if (item.status === SESSION_STATUS.COMPLETED) completed += 1;
      if (item.status === SESSION_STATUS.ABORTED || item.status === SESSION_STATUS.SPOILED) aborted += 1;
    }
    const total = completed + aborted;
    return {
      completedCount: completed,
      abortedCount: aborted,
      completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }, [state.history]);

  const historyRows = useMemo(() => state.history.map((record) => ({
    ...record,
    taskSnapshotTitle: record.taskSnapshotTitle || 'Unknown task',
    plannedLabel: formatClock(record.plannedDuration),
    endedLabel: record.endedAt ? new Date(record.endedAt).toLocaleString() : '-',
  })), [state.history]);

  const isRunning = state.session.status === SESSION_STATUS.RUNNING;
  const isFocusMode = state.session.mode === SESSION_MODE.FOCUS;

  if (!isLoaded) {
    return <div className="pomodoro-page card" style={{ padding: '2rem', textAlign: 'center' }}>Loading Pomodoro Engine...</div>;
  }

  return (
    <>
      <section className="pomodoro-page">
        <header className="pomodoro-header">
          <h1>Pomodoro</h1>
        </header>

        <div className="pomodoro-grid">
          <aside className="pomodoro-tasks card app-content-visibility-section">
            <div className="controls">
              <button type="button" aria-label="Open history and rules" onClick={() => setIsHistoryOpen(true)}>
                <History size={16} />
              </button>
            </div>

            <div className="task-title-row">
              <h2>Task Selection</h2>
              <span className="task-count">{state.tasks.length}</span>
            </div>

            <form className="task-form" onSubmit={(e) => { e.preventDefault(); safeDispatch({ type: 'ADD_TASK', title: taskInput }); setTaskInput(''); }}>
              <input type="text" placeholder="Add one task to focus" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} maxLength={120} />
              <button type="submit" className="task-add-button" aria-label="Add task">
                <Plus size={18} className="task-add-icon" />
              </button>
            </form>

            <div className="focus-duration-control">
              <label htmlFor="focus-duration">Focus duration</label>
              <div className="focus-duration-input">
                <input
                  id="focus-duration"
                  type="number"
                  min={MIN_FOCUS_MINUTES}
                  max={MAX_FOCUS_MINUTES}
                  step={1}
                  value={state.focusDurationMinutes}
                  onChange={(e) => safeDispatch({ type: 'SET_FOCUS_DURATION', minutes: e.target.value })}
                  disabled={isRunning}
                />
                <span>min</span>
              </div>
            </div>

            <TaskList
              tasks={tasksForDisplay}
              selectedTaskId={state.selectedTaskId}
              sessionStatus={state.session.status}
              onSelectTask={(id) => safeDispatch({ type: 'SELECT_TASK', taskId: id })}
              onToggleTaskDone={(id) => safeDispatch({ type: 'TOGGLE_TASK_DONE', taskId: id })}
              onDeleteTask={(id) => safeDispatch({ type: 'DELETE_TASK', taskId: id })}
            />
          </aside>

          <main className="pomodoro-session card app-content-visibility-section">
            <div className="session-meta-row">
              <p className="session-meta">
                <span className="session-pill"><TimerIcon size={14} /> Mode: <strong>{state.session.mode}</strong></span>
              </p>
              <p className="session-meta">
                <span className="session-pill"><CircleDot size={14} /> Status: <strong>{state.session.status}</strong></span>
              </p>
            </div>

            <ClockDisplay key={`${state.session.id}-${state.session.status}-${state.session.plannedDuration}`} session={state.session} dispatch={dispatch} />
            <p className="clock-caption">
              {state.session.mode === SESSION_MODE.FOCUS ? 'Focus Time' : 'Break Time'}
            </p>

            <div className="quick-controls" role="group" aria-label="Quick session controls">
              {!isRunning && (
                <button
                  type="button"
                  className="icon-control"
                  onClick={() => safeDispatch({ type: 'START_FOCUS' })}
                  disabled={!selectedTask}
                  aria-label="Start Cycle"
                >
                  <Play size={20} />
                </button>
              )}

              {isRunning && (
                <button
                  type="button"
                  className="icon-control danger"
                  onClick={() => safeDispatch({ type: 'ABORT_SESSION', reason: 'User deliberately squashed session.' })}
                  aria-label="Abort session"
                >
                  <Square size={20} />
                </button>
              )}
            </div>
          </main>
        </div>

        <section className="pomodoro-footer-info card app-content-visibility-section">
          <p className="pomodoro-eyebrow">Strict System</p>
          <p className="pomodoro-subtitle">
            Continuous auto-cycling focus loops. No pauses allowed. Aborts spoil tracking.
          </p>
          <div className="pomodoro-stats">
            <div>
              <span>Completed</span>
              <strong>{completedCount}</strong>
            </div>
            <div>
              <span>Aborted</span>
              <strong>{abortedCount}</strong>
            </div>
            <div>
              <span>Completion Rate</span>
              <strong>{completionRate}%</strong>
            </div>
          </div>
        </section>

        {!isLoaded && <p className="warning">Loading database state...</p>}
        {isLoaded && isFocusMode && isRunning && !state.session.taskId && (
          <p className="warning">Warning: Running session has lost its task reference.</p>
        )}

        <HistoryModal isOpen={isHistoryOpen} rows={historyRows} onClose={() => setIsHistoryOpen(false)} onClear={() => safeDispatch({ type: 'CLEAR_HISTORY' })} />
      </section>
      <DashboardOverlayEffects effect={dashboardOverlayEffect} intensity={dashboardOverlayIntensity} speed={dashboardOverlaySpeed} />
    </>
  );
}
