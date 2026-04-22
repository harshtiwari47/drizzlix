export const FOCUS_DURATION = 25 * 60;
export const SHORT_BREAK_DURATION = 5 * 60;
export const LONG_BREAK_DURATION = 15 * 60;
export const MIN_FOCUS_MINUTES = 5;
export const MAX_FOCUS_MINUTES = 120;

export const SESSION_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ABORTED: 'aborted',
  SPOILED: 'spoiled',
};

export const SESSION_MODE = {
  FOCUS: 'focus',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK: 'longBreak',
};

const ALLOWED_TRANSITIONS = {
  idle: ['running'],
  running: ['completed', 'aborted', 'spoiled'],
  completed: [],
  aborted: [],
  spoiled: [],
};

const uid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const terminalRecord = (session) => ({
  id: session.id,
  taskId: session.taskId,
  taskSnapshotTitle: session.taskSnapshotTitle,
  mode: session.mode,
  status: session.status,
  plannedDuration: session.plannedDuration,
  startedAt: session.startedAt,
  endedAt: session.endedAt,
  spoilReason: session.spoilReason,
});

export const createIdleSession = (focusDurationSeconds = FOCUS_DURATION) => ({
  id: null,
  taskId: null,
  taskSnapshotTitle: null,
  mode: SESSION_MODE.FOCUS,
  status: SESSION_STATUS.IDLE,
  plannedDuration: focusDurationSeconds,
  startedAt: null,
  endedAt: null,
  spoilReason: '',
});

const getOrGenerateClientId = () => {
  if (typeof localStorage === 'undefined') return uid();
  let cid = localStorage.getItem('pomodoro_client_id');
  if (!cid) {
    cid = uid();
    localStorage.setItem('pomodoro_client_id', cid);
  }
  return cid;
};

export const initialState = {
  tasks: [],
  selectedTaskId: null,
  session: createIdleSession(),
  history: [],
  completedFocusCount: 0,
  focusDurationMinutes: FOCUS_DURATION / 60,
  updatedAt: Date.now(),
  seq: 1,
  clientId: getOrGenerateClientId(),
};

function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

function addHistoryRecord(state, session) {
  const newRecord = terminalRecord(session);
  const seen = new Set();
  const dedupedHistory = [newRecord, ...state.history].filter(h => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
  return {
    ...state,
    history: dedupedHistory.slice(0, 120),
  };
}

export function reducer(state, action) {
  const reducedState = _reducer(state, action);
  if (reducedState !== state) {
    // If the authoritative state is being loaded from the server, 
    // strictly preserve its payload timestamps and sequence!
    if (action.type === 'LOAD_STATE') {
      return { ...reducedState, __localMutation: false };
    }

    return { ...reducedState, updatedAt: Date.now(), seq: (state.seq || 0) + 1, __localMutation: true, __optimistic: true };
  }
  return reducedState;
}

function _reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE': {
      console.log('[REDUCER] LOAD_STATE Payload:', action.payload?.session?.status, 'UpdatedAt:', action.payload?.updatedAt);
      if (!action.payload) return state;
      
      const incomingSeq = Number(action.payload.seq || 0);
      const localSeq = Number(state.seq || 0);
      
      if (incomingSeq < localSeq) {
        console.warn(`[REDUCER] BLOCKING stale network payload overwrite. Payload Seq: ${incomingSeq} < Local Seq: ${localSeq}`);
        return state;
      }
      
      return action.payload;
    }

    case 'ADD_TASK': {
      const title = String(action.title || '').trim();
      if (!title) return state;

      const task = {
        id: uid(),
        title,
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      return {
        ...state,
        tasks: [task, ...state.tasks],
        selectedTaskId: state.selectedTaskId || task.id,
      };
    }

    case 'TOGGLE_TASK_DONE': {
      const tasks = state.tasks.map((task) => {
        if (task.id !== action.taskId) return task;
        return {
          ...task,
          status: task.status === 'done' ? 'open' : 'done',
          updatedAt: Date.now(),
        };
      });
      return { ...state, tasks };
    }

    case 'DELETE_TASK': {
      if (state.session.status === SESSION_STATUS.RUNNING && state.session.taskId === action.taskId) {
        console.warn('Cannot delete the currently active running task.');
        return state;
      }

      const tasks = state.tasks.map((task) => {
        if (task.id !== action.taskId) return task;
        return { ...task, deleted: true, updatedAt: Date.now(), deletedAt: Date.now() };
      });

      const openTasks = tasks.filter(t => !t.deleted);
      const selectedTaskId = state.selectedTaskId === action.taskId ? (openTasks[0]?.id || null) : state.selectedTaskId;
      return { ...state, tasks, selectedTaskId };
    }

    case 'SELECT_TASK': {
      const exists = state.tasks.some((task) => task.id === action.taskId);
      if (!exists) return state;
      return { ...state, selectedTaskId: action.taskId };
    }

    case 'START_FOCUS': {
      console.log('[REDUCER] START_FOCUS triggered');
      const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId);
      if (!selectedTask) {
        console.warn('Cannot start focus without a selected task.');
        return state;
      }
      if (!canTransition(state.session.status, SESSION_STATUS.RUNNING)) {
        console.warn(`Invalid transition from ${state.session.status} to RUNNING`);
        return state;
      }

      const focusDurationSeconds = clamp(state.focusDurationMinutes, MIN_FOCUS_MINUTES, MAX_FOCUS_MINUTES) * 60;

      return {
        ...state,
        session: {
          id: uid(),
          taskId: selectedTask.id,
          taskSnapshotTitle: selectedTask.title,
          mode: SESSION_MODE.FOCUS,
          status: SESSION_STATUS.RUNNING,
          plannedDuration: focusDurationSeconds,
          startedAt: Date.now(),
          endedAt: null,
          spoilReason: '',
        },
      };
    }

    case 'AUTO_COMPLETE': {
      if (state.session.status !== SESSION_STATUS.RUNNING) return state;

      let currentState = state;
      let session = currentState.session;
      let elapsedSeconds = (Date.now() - session.startedAt) / 1000;

      // Point 4: Catch-up loop for multiple cycles if system slept
      while (elapsedSeconds >= session.plannedDuration) {
        const completedSession = {
          ...session,
          status: SESSION_STATUS.COMPLETED,
          endedAt: session.startedAt + (session.plannedDuration * 1000),
        };

        currentState = addHistoryRecord(currentState, completedSession);

        elapsedSeconds -= session.plannedDuration; // strip cycle time

        // Auto cycle engine forward
        if (session.mode === SESSION_MODE.FOCUS) {
          // Fix Point 2: Immutable increment
          currentState = {
            ...currentState,
            completedFocusCount: currentState.completedFocusCount + 1,
          };

          const nextMode = (currentState.completedFocusCount % 4 === 0) ? SESSION_MODE.LONG_BREAK : SESSION_MODE.SHORT_BREAK;
          const nextDuration = nextMode === SESSION_MODE.LONG_BREAK ? LONG_BREAK_DURATION : SHORT_BREAK_DURATION;

          session = {
            id: uid(),
            taskId: session.taskId,
            taskSnapshotTitle: session.taskSnapshotTitle,
            mode: nextMode,
            status: SESSION_STATUS.RUNNING,
            plannedDuration: nextDuration,
            startedAt: completedSession.endedAt, // seamless chaining
            endedAt: null,
            spoilReason: '',
          };
        } else {
          // Break finished, auto start focus
          session = {
            id: uid(),
            taskId: session.taskId,
            taskSnapshotTitle: session.taskSnapshotTitle,
            mode: SESSION_MODE.FOCUS,
            status: SESSION_STATUS.RUNNING,
            plannedDuration: currentState.focusDurationMinutes * 60,
            startedAt: completedSession.endedAt, // seamless chaining
            endedAt: null,
            spoilReason: '',
          };
        }
      }

      // Update session onto state after processing catching-up
      // To realign to actual physical time, let's reset startedAt to now - remaining elapsed
      // Wait: actually session.startedAt is exactly correct from the loop (completedSession.endedAt).
      // Example: slept for 60m. Passed 2x focus(25) + 2x short break(5). 
      return {
        ...currentState,
        session,
      };
    }

    case 'ABORT_SESSION': {
      if (!canTransition(state.session.status, SESSION_STATUS.ABORTED)) {
        console.warn(`Invalid transition from ${state.session.status} to ABORTED`);
        return state;
      }

      const abortedSession = {
        ...state.session,
        status: SESSION_STATUS.ABORTED,
        endedAt: Date.now(),
        spoilReason: action.reason || 'Manually aborted',
      };

      const newState = addHistoryRecord(state, abortedSession);
      newState.session = createIdleSession(newState.focusDurationMinutes * 60);
      return newState;
    }

    case 'SET_FOCUS_DURATION': {
      let parsed = Number(action.minutes);
      if (!Number.isFinite(parsed) || parsed < 0) parsed = 0;

      // Allow typing numbers smaller than MIN_FOCUS_MINUTES without auto-clamping,
      // so users can type "1" and then "0" for "10". It gets clamped on START_FOCUS.
      const nextMinutes = Math.min(Math.round(parsed), MAX_FOCUS_MINUTES);
      const isIdlePreview = state.session.status === SESSION_STATUS.IDLE && state.session.mode === SESSION_MODE.FOCUS;

      return {
        ...state,
        focusDurationMinutes: action.minutes === '' ? '' : nextMinutes,
        session: isIdlePreview
          ? { ...state.session, plannedDuration: Math.max(MIN_FOCUS_MINUTES, nextMinutes) * 60 }
          : state.session,
      };
    }

    case 'CLEAR_HISTORY': {
      return {
        ...state,
        history: [],
        historyClearedAt: Date.now(),
      };
    }

    default:
      return state;
  }
}

export function normalizePomodoroState(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  const persistedFocusMinutes = clamp(
    Number(parsed.focusDurationMinutes || FOCUS_DURATION / 60),
    MIN_FOCUS_MINUTES,
    MAX_FOCUS_MINUTES
  );

  const persistedSession = parsed.session || createIdleSession(persistedFocusMinutes * 60);
  const normalizedSession =
    persistedSession.mode === SESSION_MODE.FOCUS && persistedSession.status === SESSION_STATUS.IDLE
      ? {
        ...persistedSession,
        plannedDuration: persistedFocusMinutes * 60,
      }
      : persistedSession;

  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    selectedTaskId: parsed.selectedTaskId || null,
    session: normalizedSession,
    history: Array.isArray(parsed.history) ? parsed.history : [],
    historyClearedAt: Number(parsed.historyClearedAt || 0),
    completedFocusCount: Number(parsed.completedFocusCount || 0),
    focusDurationMinutes: persistedFocusMinutes,
    updatedAt: Number(parsed.updatedAt) || Date.now(),
    seq: Number(parsed.seq) || Number(parsed.version) || 1,
    clientId: parsed.clientId || getOrGenerateClientId(),
  };
}
