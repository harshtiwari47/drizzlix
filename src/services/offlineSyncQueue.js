import { getSyncQueue, enqueueSync, removeSyncItem, putSyncQueue } from './db';

const OFFLINE_SYNC_QUEUE_UPDATED_EVENT = 'app-offline-sync-queue-updated';
const OFFLINE_SYNC_CONFLICT_EVENT = 'app-offline-sync-conflict';
const MAX_QUEUE_ITEMS = 40;

function getCurrentOwnerKey() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || typeof user !== 'object') return null;
    return user.userId || user._id || user.id || user.email || user.username || null;
  } catch {
    return null;
  }
}

function getTokenFromStorage() {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem('token') || null;
  } catch {
    return null;
  }
}

async function dispatchQueueUpdated() {
  if (typeof window === 'undefined') return;
  const queue = await getSyncQueue();
  window.dispatchEvent(
    new CustomEvent(OFFLINE_SYNC_QUEUE_UPDATED_EVENT, {
      detail: { pendingCount: queue.length },
    })
  );
}

function normalizeQueueItem(item) {
  const method = String(item.method || 'POST').toUpperCase();
  const normalizedBody = item.body === undefined
    ? null
    : (typeof item.body === 'string' ? item.body : JSON.stringify(item.body));

  const normalizedConflictGuard = item?.conflictGuard && typeof item.conflictGuard === 'object'
    ? {
      strategy: String(item.conflictGuard.strategy || ''),
      resourceUrl: String(item.conflictGuard.resourceUrl || ''),
      baseUpdatedAt: item.conflictGuard.baseUpdatedAt || null,
    }
    : null;

  return {
    id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    url: String(item.url || ''),
    method,
    headers: item.headers && typeof item.headers === 'object' ? item.headers : {},
    body: normalizedBody,
    createdAt: item.createdAt || Date.now(),
    attempts: Number(item.attempts || 0),
    lastAttemptAt: Number(item.lastAttemptAt || 0),
    dedupeKey: item.dedupeKey || null,
    authMode: item.authMode || null,
    ownerKey: item.ownerKey || null,
    conflictGuard: normalizedConflictGuard,
  };
}

function toEpochMs(value) {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function extractUpdatedAt(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.updatedAt === 'string') return payload.updatedAt;

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const candidate = extractUpdatedAt(entry);
      if (candidate) return candidate;
    }
    return null;
  }

  const prioritizedKeys = ['note', 'task', 'deck', 'data', 'item'];
  for (const key of prioritizedKeys) {
    const nested = payload[key];
    const candidate = extractUpdatedAt(nested);
    if (candidate) return candidate;
  }

  return null;
}

function dispatchQueueConflict(item, reason, details = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(OFFLINE_SYNC_CONFLICT_EVENT, {
        detail: {
          reason,
          dedupeKey: item?.dedupeKey || null,
          url: item?.url || null,
          ...details,
        },
      })
    );
  }
}

async function evaluateConflictGuard(item, method, headers) {
  const guard = item?.conflictGuard;
  if (!guard || guard.strategy !== 'skip-if-remote-newer') {
    return { action: 'proceed' };
  }

  if (!guard.resourceUrl || !['PATCH', 'PUT', 'DELETE'].includes(method)) {
    return { action: 'proceed' };
  }

  const baseEpoch = toEpochMs(guard.baseUpdatedAt);
  if (!Number.isFinite(baseEpoch)) {
    return { action: 'proceed' };
  }

  try {
    const probeResponse = await fetch(guard.resourceUrl, { method: 'GET', headers });

    if (probeResponse.status === 404) {
      dispatchQueueConflict(item, 'resource-missing', { resourceUrl: guard.resourceUrl });
      return { action: 'drop' };
    }

    if (!probeResponse.ok) return { action: 'retry' };

    let probePayload = null;
    try {
      probePayload = await probeResponse.json();
    } catch {
      return { action: 'proceed' };
    }

    const remoteUpdatedAt = extractUpdatedAt(probePayload);
    const remoteEpoch = toEpochMs(remoteUpdatedAt);

    if (!Number.isFinite(remoteEpoch)) {
      return { action: 'proceed' };
    }

    if (remoteEpoch > baseEpoch + 1000) {
      dispatchQueueConflict(item, 'remote-newer', {
        resourceUrl: guard.resourceUrl,
        baseUpdatedAt: guard.baseUpdatedAt,
        remoteUpdatedAt,
      });
      return { action: 'drop' };
    }

    return { action: 'proceed' };
  } catch {
    return { action: 'retry' };
  }
}

function shouldDropFailedResponse(statusCode) {
  if (statusCode === 408 || statusCode === 425 || statusCode === 429) return false;
  if (statusCode >= 500) return false;
  if (statusCode === 401) return false; // Retain exactly to allow later auth refresh logic
  if (statusCode >= 400) return true;
  return false;
}

// These state reads may be better off async now, but to avoid breaking all callers right away if they rely on synchronous behavior (though they shouldn't generally),
// we will expose the async version. In most places we can adjust or just let it return a Promise if not strictly expected to be sync primitive.
export async function getOfflineSyncPendingCount() {
  const queue = await getSyncQueue();
  return queue.length;
}

export async function getOfflineSyncPendingCountByDedupePrefix(prefixes) {
  const normalizedPrefixes = (Array.isArray(prefixes) ? prefixes : [prefixes])
    .map(p => String(p || '').trim()).filter(Boolean);
  if (normalizedPrefixes.length === 0) return 0;
  const queue = await getSyncQueue();
  return queue.filter(item => {
    const dedupeKey = String(item?.dedupeKey || '');
    if (!dedupeKey) return false;
    return normalizedPrefixes.some(prefix => dedupeKey.startsWith(prefix));
  }).length;
}

export function subscribeToOfflineSyncQueue(listener) {
  if (typeof window === 'undefined' || typeof listener !== 'function') {
    return () => {};
  }
  const wrappedListener = (event) => {
    listener(Number(event?.detail?.pendingCount ?? 0));
  };
  window.addEventListener(OFFLINE_SYNC_QUEUE_UPDATED_EVENT, wrappedListener);
  // Initially fetch and notify
  getOfflineSyncPendingCount().then(c => listener(c));
  return () => {
    window.removeEventListener(OFFLINE_SYNC_QUEUE_UPDATED_EVENT, wrappedListener);
  };
}

export async function enqueueOfflineSyncRequest(item) {
  const normalizedItem = normalizeQueueItem(item);
  if (!normalizedItem.url) return;
  
  if (normalizedItem.dedupeKey) {
    await removeOfflineSyncRequestByDedupeKey(normalizedItem.dedupeKey);
  }
  
  await enqueueSync(normalizedItem);
  
  // ensure we don't exceed max items (by culling oldest if we want, or taking a pass)
  const queue = await getSyncQueue();
  if (queue.length > MAX_QUEUE_ITEMS) {
      const sortedQueue = queue.sort((a,b) => a.createdAt - b.createdAt);
      await putSyncQueue(sortedQueue.slice(-MAX_QUEUE_ITEMS));
  }
  
  await dispatchQueueUpdated();
}

export async function hasOfflineSyncRequestWithDedupeKey(dedupeKey) {
  if (!dedupeKey) return false;
  const queue = await getSyncQueue();
  return queue.some((item) => item?.dedupeKey === dedupeKey);
}

export async function removeOfflineSyncRequestByDedupeKey(dedupeKey) {
  if (!dedupeKey) return;
  const queue = await getSyncQueue();
  const existing = queue.find(q => q.dedupeKey === dedupeKey);
  if (existing) {
    await removeSyncItem(existing.id);
    await dispatchQueueUpdated();
  }
}

let isFlushing = false;

export async function flushOfflineSyncQueue({ maxItems = 8 } = {}) {
  if (isFlushing) return { flushed: 0, pending: 0 };
  isFlushing = true;

  try {
    if (typeof fetch === 'undefined') return { flushed: 0, pending: 0 }; // Should actually be length of queue but we can skip
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const q = await getSyncQueue();
    return { flushed: 0, pending: q.length };
  }

  const queue = await getSyncQueue();
  if (queue.length === 0) return { flushed: 0, pending: 0 };

  // sort by id or created_at
  queue.sort((a,b) => a.createdAt - b.createdAt);

  const maxFlushCount = Math.max(1, Number(maxItems) || 1);
  const currentOwnerKey = getCurrentOwnerKey();
  const remainingQueue = [];
  let flushed = 0;
  const now = Date.now();

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];

    const attempts = Number(item.attempts || 0);
    if (attempts > 0) {
      const backoffMs = Math.min(Math.pow(2, attempts) * 1000, 1000 * 60 * 60); // Cap at 1hr
      const lastAttempt = Number(item.lastAttemptAt || item.createdAt);
      if (now < lastAttempt + backoffMs) {
        remainingQueue.push(item);
        continue;
      }
    }

    if (item.ownerKey && currentOwnerKey && item.ownerKey !== currentOwnerKey) {
        remainingQueue.push(item);
        continue;
    }

    if (flushed >= maxFlushCount) {
      remainingQueue.push(item);
      continue;
    }

    try {
      const headers = new Headers(item.headers || {});
      if (item.authMode === 'bearer') {
        const token = getTokenFromStorage();
        if (!token) {
          remainingQueue.push(item);
          continue;
        }
        headers.set('Authorization', `Bearer ${token}`);
      }

      const method = String(item.method || 'POST').toUpperCase();
      const conflictResult = await evaluateConflictGuard(item, method, headers);
      if (conflictResult.action === 'retry') {
        remainingQueue.push({ ...item, attempts: attempts + 1, lastAttemptAt: now });
        continue;
      }
      if (conflictResult.action === 'drop') {
        flushed += 1;
        continue;
      }

      const requestInit = { method, headers };
      if (item.body !== null && method !== 'GET' && method !== 'HEAD') {
        requestInit.body = item.body;
      }

      const response = await fetch(item.url, requestInit);
      
      if (response.status === 401) {
        remainingQueue.push(item); // Retain original explicitly
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-auth-refresh-needed'));
        break; // Hard circuit break to halt infinite queue fetching
      }
      
      if (response.ok || shouldDropFailedResponse(response.status)) {
        flushed += 1;
        continue;
      }

      remainingQueue.push({ ...item, attempts: attempts + 1, lastAttemptAt: now });
    } catch {
      remainingQueue.push({ ...item, attempts: attempts + 1, lastAttemptAt: now });
    }
  }

    await putSyncQueue(remainingQueue);
    await dispatchQueueUpdated();

    return { flushed, pending: remainingQueue.length };
  } finally {
    isFlushing = false;
  }
}
