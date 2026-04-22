import { enqueueOfflineSyncRequest, flushOfflineSyncQueue } from '../../services/offlineSyncQueue';
import { getPomodoroState, savePomodoroState } from '../../services/db';
import { normalizePomodoroState } from './pomodoroEngine';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineSyncQueue().catch(() => undefined);
  });
  window.addEventListener('app-auth-refresh-success', () => {
    flushOfflineSyncQueue().catch(() => undefined);
  });
  flushOfflineSyncQueue().catch(() => undefined);
}

const compareClocks = (a, b) => {
  const tA = Number(a?.updatedAt || 0);
  const tB = Number(b?.updatedAt || 0);
  if (tA !== tB) return tA > tB ? 1 : -1;

  const cA = String(a?.clientId || '');
  const cB = String(b?.clientId || '');
  if (cA !== cB) return cA > cB ? 1 : -1;

  const sA = Number(a?.seq || 0);
  const sB = Number(b?.seq || 0);
  if (sA !== sB) return sA > sB ? 1 : -1;
  
  return 0;
};

const mergeArrays = (arr1, arr2) => {
  const map = new Map();
  const process = (arr) => {
    (arr || []).forEach(item => {
      if (map.has(item.id)) {
        if (compareClocks(item, map.get(item.id)) === 1) map.set(item.id, item);
      } else {
        map.set(item.id, item);
      }
    });
  };
  process(arr1);
  process(arr2);
  return Array.from(map.values()).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export async function pullAndReconcileCloudState(token, ownerKey, dispatch) {
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/pomodoro-state`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) return;

    const data = await res.json();
    const serverState = normalizePomodoroState(data?.state);
    if (!serverState) return;

    console.log('[SYNC] pullAndReconcileCloudState received ServerState. UpdatedAt:', serverState.updatedAt);

    const localState = await getPomodoroState(ownerKey || 'default');
    if (!localState) {
      dispatch({ type: 'LOAD_STATE', payload: serverState });
      await savePomodoroState(serverState, ownerKey || 'default');
      return;
    }

    const mergedHistory = mergeArrays(localState.history, serverState.history);
    const mergedTasks = mergeArrays(localState.tasks, serverState.tasks);

    const winningState = compareClocks(localState, serverState) >= 0 ? localState : serverState;

    const reconciledState = {
      ...winningState,
      history: mergedHistory,
      tasks: mergedTasks
    };

    dispatch({ type: 'LOAD_STATE', payload: reconciledState });
    await savePomodoroState(reconciledState, ownerKey || 'default');

    const historyChanged = JSON.stringify(serverState.history) !== JSON.stringify(mergedHistory);
    const tasksChanged = JSON.stringify(serverState.tasks) !== JSON.stringify(mergedTasks);

    if (compareClocks(localState, serverState) > 0 || historyChanged || tasksChanged) {
      await performCloudPush(reconciledState, token, ownerKey, dispatch);
    }
  } catch {
    console.warn('[sync] Unable to contact cloud server for reconciliation.');
  }
}

export async function performCloudPush(state, token, ownerKey, dispatch) {
  if (!token) return;

  const requestBody = JSON.stringify({ 
    state, 
    requestId: crypto.randomUUID() 
  });
  
  try {
    const response = await fetch(`${API_BASE}/pomodoro-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error('Unable to sync pomodoro state');
    }

    const data = await response.json().catch(() => null);
    if (data?.state && dispatch) {
      const authoritativeState = normalizePomodoroState(data.state);
      console.log('[SYNC] performCloudPush Success. Authoritative Server UpdatedAt:', authoritativeState?.updatedAt);
      if (authoritativeState) {
        dispatch({ type: 'LOAD_STATE', payload: authoritativeState });
        await savePomodoroState(authoritativeState, ownerKey || 'default');
      }
    }
  } catch (err) {
    console.error('[SYNC] performCloudPush Failed, enqueuing offline request:', err);
    enqueueOfflineSyncRequest({
      url: `${API_BASE}/pomodoro-state`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      authMode: 'bearer',
      dedupeKey: `pomodoro-state:${ownerKey || 'anonymous'}`,
      ownerKey,
    });
  }
}

export function setupBeforeUnloadSync(stateRef, token) {
  const handler = () => {
    if (token && stateRef.current) {
      const payload = JSON.stringify({ 
        state: stateRef.current, 
        requestId: crypto.randomUUID() 
      });
      if (new Blob([payload]).size > 60000) return;

      fetch(`${API_BASE}/pomodoro-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }
  };

  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}
