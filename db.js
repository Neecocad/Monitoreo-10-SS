const DB_NAME = 'monitoreo10ss';
const DB_VERSION = 1;
const STORE_NAME = 'registros';

let _db = null;

function _openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ({ target: { result: db } }) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('idx_fecha',          'header.fecha',          { unique: false });
        store.createIndex('idx_codigo_parcela', 'header.codigo_parcela', { unique: false });
        store.createIndex('idx_created_at',     'created_at',            { unique: false });
      }
    };
    req.onsuccess  = ({ target: { result } }) => { _db = result; resolve(_db); };
    req.onerror    = ({ target: { error  } }) => reject(error);
    req.onblocked  = () => reject(new Error('IndexedDB bloqueado por otra pestaña.'));
  });
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

async function dbSave(registro) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    tx.onerror = ({ target: { error } }) => reject(error);
    const req  = tx.objectStore(STORE_NAME).put(registro);
    req.onsuccess = () => resolve(registro.id);
    req.onerror   = ({ target: { error } }) => reject(error);
  });
}

async function dbGet(id) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly')
                  .objectStore(STORE_NAME).get(id);
    req.onsuccess = ({ target: { result } }) => resolve(result ?? null);
    req.onerror   = ({ target: { error  } }) => reject(error);
  });
}

async function dbGetAll() {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly')
                  .objectStore(STORE_NAME).getAll();
    req.onsuccess = ({ target: { result } }) => resolve(result);
    req.onerror   = ({ target: { error  } }) => reject(error);
  });
}

async function dbDelete(id) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite')
                  .objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = ({ target: { error } }) => reject(error);
  });
}
