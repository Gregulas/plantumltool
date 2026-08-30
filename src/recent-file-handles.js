const DATABASE_NAME = 'plantuml-local-studio';
const DATABASE_VERSION = 1;
const STORE_NAME = 'recent-file-handles';

function openDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb?.open) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open recent-file storage.'));
  });
}

function completeTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Recent-file storage failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Recent-file storage was aborted.'));
  });
}

export async function storeRecentFileHandle(filename, handle, indexedDb = globalThis.indexedDB) {
  if (!filename || !handle) return false;
  const database = await openDatabase(indexedDb);
  if (!database) return false;
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(handle, String(filename));
    await completeTransaction(transaction);
    return true;
  } finally {
    database.close();
  }
}

export async function loadRecentFileHandle(filename, indexedDb = globalThis.indexedDB) {
  if (!filename) return null;
  const database = await openDatabase(indexedDb);
  if (!database) return null;
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(String(filename));
    const handle = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Unable to read the recent file handle.'));
    });
    await completeTransaction(transaction);
    return handle;
  } finally {
    database.close();
  }
}

export async function clearRecentFileHandles(indexedDb = globalThis.indexedDB) {
  const database = await openDatabase(indexedDb);
  if (!database) return false;
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    await completeTransaction(transaction);
    return true;
  } finally {
    database.close();
  }
}

export async function ensureFileHandlePermission(handle, mode = 'readwrite') {
  if (!handle) return false;
  if (typeof handle.queryPermission !== 'function') return true;
  const options = { mode };
  if (await handle.queryPermission(options) === 'granted') return true;
  if (typeof handle.requestPermission !== 'function') return false;
  return await handle.requestPermission(options) === 'granted';
}
