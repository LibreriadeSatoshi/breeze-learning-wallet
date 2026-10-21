const DB_NAME = "ismos-wallet";
const LEGACY_DB_NAME = "scholar-wallet";
const DB_VERSION = 1;
const STORE = "vault";
const KEY = "mnemonic-blob";

function openDb(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVault(blob: Uint8Array): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadVault(): Promise<Uint8Array | null> {
  return (await readVault(DB_NAME)) ?? (await migrateLegacyVault());
}

async function legacyDbExists(): Promise<boolean> {
  if (typeof indexedDB.databases !== "function") return true;
  const dbs = await indexedDB.databases();
  return dbs.some((db) => db.name === LEGACY_DB_NAME);
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

// Copies a vault saved under the pre-rebrand database name, then drops the
// old database only once the copy is readable from the new one.
async function migrateLegacyVault(): Promise<Uint8Array | null> {
  if (!(await legacyDbExists())) return null;
  const legacy = await readVault(LEGACY_DB_NAME);
  if (legacy) {
    await saveVault(legacy);
    const copied = await readVault(DB_NAME);
    if (!copied || copied.length !== legacy.length) return legacy;
  }
  await deleteDb(LEGACY_DB_NAME);
  return legacy;
}

async function readVault(name: string): Promise<Uint8Array | null> {
  const db = await openDb(name);
  try {
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!result) return null;
    if (ArrayBuffer.isView(result)) {
      return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
    }
    if (Object.prototype.toString.call(result) === "[object ArrayBuffer]") {
      return new Uint8Array(result as ArrayBuffer);
    }
    return null;
  } finally {
    db.close();
  }
}

export async function clearVault(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
