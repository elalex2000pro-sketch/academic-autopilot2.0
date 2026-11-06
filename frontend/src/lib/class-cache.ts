// Persistencia de clases eliminadas o abandonadas.
//
// El listado de clases se guarda en la cache local (IndexedDB) para poder
// consultarlo sin conexión. Si una clase se borra y esa copia sigue viva, al
// refrescar volvía a aparecer. Aquí guardamos los IDs borrados en
// localStorage y limpiamos las respuestas cacheadas relacionadas.

import {
  deleteCachedApiResponse,
  deleteCachedApiResponsesByPrefix,
} from "@/lib/local-cache";

const DELETED_CLASSES_KEY = "autopilot_deleted_class_ids_v1";

export const CLASS_DELETED_EVENT = "autopilot-class-deleted";

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELETED_CLASSES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function writeIds(ids: Iterable<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DELETED_CLASSES_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Sin localStorage la app sigue funcionando; solo se pierde la marca.
  }
}

export function getDeletedClassIds(): Set<string> {
  return new Set(readIds());
}

/** Quita de una lista las clases que ya se borraron o abandonaron. */
export function filterDeletedClasses<T extends { id: string }>(items: T[]): T[] {
  const deleted = getDeletedClassIds();
  if (deleted.size === 0) return items;
  return items.filter((item) => !deleted.has(item.id));
}

export function markClassDeleted(id: string): void {
  const ids = new Set(readIds());
  ids.add(id);
  writeIds(ids);
}

/** Se usa al volver a crear/unirse a una clase para que deje de estar oculta. */
export function unmarkClassDeleted(id: string): void {
  const ids = new Set(readIds());
  if (!ids.delete(id)) return;
  writeIds(ids);
}

/**
 * Borra las copias locales del listado y del detalle de la clase. Así el
 * siguiente listado no puede resucitar la clase desde IndexedDB.
 */
export async function clearClassLocalCache(id: string): Promise<void> {
  await Promise.all([
    deleteCachedApiResponse("/api/v1/classes"),
    deleteCachedApiResponse(`/api/v1/classes/${id}`),
    deleteCachedApiResponsesByPrefix(`/api/v1/classes/${id}`),
    deleteCachedApiResponsesByPrefix("/api/v1/files"),
  ]);
}

/** Avisa a las vistas montadas (lista de clases, cuadernos...) del borrado. */
export function notifyClassDeleted(id: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CLASS_DELETED_EVENT, { detail: { id } }),
  );
}
