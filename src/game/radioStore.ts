/**
 * Fault-tolerant IndexedDB storage for user-uploaded local audio files.
 * Falls back cleanly to session-only playback if IndexedDB is blocked
 * (e.g. strict browser rules under file:// or private browsing).
 */

const DB_NAME = "cozy-study-radio-v1";
const DB_VERSION = 1;
const STORE = "blobs";

export function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const factory = typeof window !== "undefined" ? window.indexedDB : undefined;
      if (!factory) {
        resolve(null);
        return;
      }
      const req = factory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE);
          }
        } catch {
          /* ignored */
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveTrackBlob(id: string, blob: Blob): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function loadAllTrackBlobs(): Promise<Map<string, Blob> | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const out = new Map<string, Blob>();
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (typeof cursor.key === "string" && cursor.value instanceof Blob) {
          out.set(cursor.key, cursor.value);
        }
        cursor.continue();
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
      tx.oncomplete = () => {
        db.close();
        resolve(out);
      };
      tx.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function deleteTrackBlob(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function clearAllTrackBlobs(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
