// Puente entre el lector de la Biblioteca y IA Studio.
//
// El lector y el panel de IA viven en árboles distintos (el panel es global),
// así que comparten el libro abierto mediante este pequeño store en memoria:
// sin dependencias de pdf.js para que IA Studio no cargue el lector entero.

export interface OpenBookContext {
  bookId: string;
  title: string;
  author: string;
  page: number;
  pages: number;
}

type Listener = (book: OpenBookContext | null) => void;

let current: OpenBookContext | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(current);
}

/** Registra (o actualiza) el PDF que el estudiante está leyendo. */
export function publishOpenBook(book: OpenBookContext): void {
  current = { ...book };
  emit();
}

/** Lo retira al cerrar el lector, solo si sigue siendo ese libro. */
export function clearOpenBook(bookId?: string): void {
  if (bookId && current?.bookId !== bookId) return;
  current = null;
  emit();
}

export function getOpenBook(): OpenBookContext | null {
  return current;
}

export function subscribeOpenBook(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
