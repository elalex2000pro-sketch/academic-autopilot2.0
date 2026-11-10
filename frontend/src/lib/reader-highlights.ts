/**
 * Subrayados del lector de PDF.
 *
 * Cada subrayado guarda rectángulos normalizados (0-1) respecto a la caja de
 * su página, así el resaltado se dibuja igual con cualquier zoom o ancho. Se
 * guardan en `localStorage` por libro: los PDF viven en IndexedDB y sus
 * anotaciones no necesitan tocar el backend.
 */
export interface ReaderHighlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReaderHighlight {
  id: string;
  page: number;
  rects: ReaderHighlightRect[];
  createdAt: number;
}

const STORAGE_KEY = "autopilot_reader_highlights_v1";

type HighlightStore = Record<string, ReaderHighlight[]>;

function readStore(): HighlightStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as HighlightStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: HighlightStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Sin espacio o en modo privado: el subrayado sigue visible en memoria.
  }
}

export function loadHighlights(bookId: string): ReaderHighlight[] {
  const stored = readStore()[bookId];
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (mark) =>
      mark &&
      typeof mark.id === "string" &&
      Number.isFinite(mark.page) &&
      Array.isArray(mark.rects) &&
      mark.rects.length > 0,
  );
}

export function saveHighlights(bookId: string, highlights: ReaderHighlight[]): void {
  const store = readStore();
  if (highlights.length > 0) store[bookId] = highlights;
  else delete store[bookId];
  writeStore(store);
}
