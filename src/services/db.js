import { openDB } from 'idb';

const DB_NAME = 'drizzlix-db';
const DB_VERSION = 1;

let idbInstance = null;
let useFallback = false;

const memoryStore = {
  pomodoro_state: new Map(),
  session_history: new Map(),
  sync_queue: new Map()
};

export async function getDb() {
  if (useFallback) return null;
  if (idbInstance) return idbInstance;

  try {
    idbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pomodoro_state')) {
          db.createObjectStore('pomodoro_state');
        }
        if (!db.objectStoreNames.contains('session_history')) {
          const store = db.createObjectStore('session_history', { keyPath: 'id' });
          store.createIndex('startedAt', 'startedAt');
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('createdAt', 'createdAt');
        }
      },
    });
    return idbInstance;
  } catch (err) {
    console.warn('[db] IndexedDB initialization failed. Falling back to in-memory store.', err);
    useFallback = true;
    return null;
  }
}

// ----------------------------------------
// POMODORO STATE
// ----------------------------------------
export async function getPomodoroState(key = 'default') {
  const db = await getDb();
  if (!db) {
    return memoryStore.pomodoro_state.get(key) || null;
  }
  try {
    return await db.get('pomodoro_state', key);
  } catch (err) {
    console.error('[db] getPomodoroState failed:', err);
    return memoryStore.pomodoro_state.get(key) || null;
  }
}

export async function savePomodoroState(state, key = 'default') {
  const db = await getDb();
  if (!db) {
    memoryStore.pomodoro_state.set(key, state);
    return;
  }
  try {
    // Also save to memory as a hot fallback if IDB crashes later
    memoryStore.pomodoro_state.set(key, state);
    await db.put('pomodoro_state', state, key);
  } catch (err) {
    console.error('[db] savePomodoroState failed:', err);
    memoryStore.pomodoro_state.set(key, state);
  }
}

// ----------------------------------------
// SYNC QUEUE
// ----------------------------------------
export async function getSyncQueue() {
  const db = await getDb();
  if (!db) {
    const list = Array.from(memoryStore.sync_queue.values());
    return list.sort((a, b) => a.createdAt - b.createdAt);
  }
  try {
    return await db.getAllFromIndex('sync_queue', 'createdAt');
  } catch (err) {
    console.error('[db] getSyncQueue failed:', err);
    return Array.from(memoryStore.sync_queue.values()).sort((a, b) => a.createdAt - b.createdAt);
  }
}

export async function enqueueSync(item) {
  const db = await getDb();
  
  if (item.dedupeKey) {
    if (!db) {
      for (const [k, v] of memoryStore.sync_queue.entries()) {
        if (v.dedupeKey === item.dedupeKey) memoryStore.sync_queue.delete(k);
      }
    } else {
      try {
        const all = await db.getAllFromIndex('sync_queue', 'createdAt');
        const existing = all.find(q => q.dedupeKey === item.dedupeKey);
        if (existing) await db.delete('sync_queue', existing.id);
      } catch {
         // ignore
      }
    }
  }

  if (!db) {
    memoryStore.sync_queue.set(item.id, item);
    return;
  }

  try {
    memoryStore.sync_queue.set(item.id, item);
    await db.put('sync_queue', item);
  } catch (err) {
    console.error('[db] enqueueSync failed:', err);
  }
}

export async function removeSyncItem(id) {
  memoryStore.sync_queue.delete(id);
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete('sync_queue', id);
  } catch (err) {
    console.error('[db] removeSyncItem failed:', err);
  }
}

export async function putSyncQueue(queue) {
  memoryStore.sync_queue.clear();
  for (const item of queue) {
    memoryStore.sync_queue.set(item.id, item);
  }

  const db = await getDb();
  if (!db) return;

  try {
    const tx = db.transaction('sync_queue', 'readwrite');
    await tx.store.clear();
    for (const item of queue) {
      await tx.store.put(item);
    }
    await tx.done;
  } catch (err) {
    console.error('[db] putSyncQueue failed:', err);
  }
}
