// Cache local (IndexedDB) para que la app instalada siga teniendo tus datos a mano.
//
// No sustituye al servidor: guarda una copia de las respuestas que ya has
// consultado y de los borradores de cuaderno. Al volver la conexion, la app
// vuelve a sincronizar. La copia se borra al cerrar sesion o desde Ajustes.

const DB_NAME = "academic-autopilot-local";
const DB_VERSION = 1;
const RESPONSES = "responses";
const DRAFTS = "drafts";
const BACKUP_AT_KEY = "autopilot_local_backup_at";

export const LOCAL_CACHE_EVENT = "autopilot-local-cache";

export interface CachedResponse<T = unknown> {
  path: string;
  data: T;
  savedAt: string;
}

export interface NotebookDraft {
  id: string;
  title: string;
  color: string;
  content: string;
  savedAt: string;
}

export interface LocalCacheStats {
  entries: number;
  drafts: number;
  lastSavedAt: string | null;
  usageBytes: number | null;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RESPONSES)) {
          db.createObjectStore(RESPONSES, { keyPath: "path" });
        }
        if (!db.objectStoreNames.contains(DRAFTS)) {
          db.createObjectStore(DRAFTS, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function cacheApiResponse<T>(path: string, data: T): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(RESPONSES, "readwrite");
    tx.objectStore(RESPONSES).put({
      path,
      data,
      savedAt: new Date().toISOString(),
    } satisfies CachedResponse<T>);
    await transactionDone(tx);
    markLocalBackupNow();
  } catch {
    // La app sigue funcionando aunque el navegador no permita IndexedDB.
  }
}

export async function readCachedApiResponse<T>(
  path: string,
): Promise<CachedResponse<T> | null> {
  const db = await openDatabase();
  if (!db) return null;
  try {
    const tx = db.transaction(RESPONSES, "readonly");
    const request = tx.objectStore(RESPONSES).get(path);
    const value = await new Promise<CachedResponse<T> | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as CachedResponse<T> | undefined);
      request.onerror = () => reject(request.error);
    });
    return value ?? null;
  } catch {
    return null;
  }
}

export async function saveNotebookDraft(
  id: string,
  draft: Pick<NotebookDraft, "title" | "color" | "content">,
): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(DRAFTS, "readwrite");
    tx.objectStore(DRAFTS).put({
      id,
      ...draft,
      savedAt: new Date().toISOString(),
    } satisfies NotebookDraft);
    await transactionDone(tx);
    markLocalBackupNow();
  } catch {
    // Sin almacenamiento local disponible: el guardado del servidor sigue igual.
  }
}

export async function getNotebookDraft(id: string): Promise<NotebookDraft | null> {
  const db = await openDatabase();
  if (!db) return null;
  try {
    const tx = db.transaction(DRAFTS, "readonly");
    const request = tx.objectStore(DRAFTS).get(id);
    const value = await new Promise<NotebookDraft | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as NotebookDraft | undefined);
      request.onerror = () => reject(request.error);
    });
    return value ?? null;
  } catch {
    return null;
  }
}

export async function deleteNotebookDraft(id: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(DRAFTS, "readwrite");
    tx.objectStore(DRAFTS).delete(id);
    await transactionDone(tx);
  } catch {
    // Nada que limpiar.
  }
}

export async function clearLocalAppData(): Promise<void> {
  try {
    const db = await openDatabase();
    if (db) {
      const tx = db.transaction([RESPONSES, DRAFTS], "readwrite");
      tx.objectStore(RESPONSES).clear();
      tx.objectStore(DRAFTS).clear();
      await transactionDone(tx);
    }
  } catch {
    // La sesion se cierra igualmente.
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BACKUP_AT_KEY);
  }
}

export function markLocalBackupNow(): string {
  const now = new Date().toISOString();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(BACKUP_AT_KEY, now);
  }
  return now;
}

export function getLastLocalBackup(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BACKUP_AT_KEY);
}

export async function getLocalCacheStats(): Promise<LocalCacheStats> {
  const empty: LocalCacheStats = {
    entries: 0,
    drafts: 0,
    lastSavedAt: getLastLocalBackup(),
    usageBytes: null,
  };
  const db = await openDatabase();
  if (!db) return empty;

  try {
    const tx = db.transaction([RESPONSES, DRAFTS], "readonly");
    const responses = tx.objectStore(RESPONSES);
    const drafts = tx.objectStore(DRAFTS);
    // Se lanzan las dos peticiones antes de esperar para que la transacción
    // siga activa hasta que ambas terminen.
    const entriesPromise = new Promise<number>((resolve, reject) => {
      const request = responses.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const draftsPromise = new Promise<number>((resolve, reject) => {
      const request = drafts.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const [entries, draftCount] = await Promise.all([entriesPromise, draftsPromise]);

    let usageBytes: number | null = null;
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage ?? null;
    }
    return {
      entries,
      drafts: draftCount,
      lastSavedAt: getLastLocalBackup(),
      usageBytes,
    };
  } catch {
    return empty;
  }
}

// Pide al navegador que no borre estos datos automaticamente cuando el disco
// esta lleno. Es especialmente util en la app instalada.
export async function requestPersistentLocalStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
