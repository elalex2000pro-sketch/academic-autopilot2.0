import localforage from "localforage";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

// El worker se sirve desde /public para que la lectura funcione sin CDN ni
// conexión. La versión debe coincidir con la de pdfjs-dist instalada.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export interface LocalBook {
  id: string;
  title: string;
  author: string;
  fileName: string;
  pages: number;
  size: number;
  cover: string;
  addedAt: number;
  updatedAt: number;
  lastPage: number;
  zoom: number;
  notes: string;
  bookmarks: number[];
}

export type ImportStage = "reading" | "cover" | "saving";

const DB_NAME = "academic-autopilot";
const booksStore = localforage.createInstance({
  name: DB_NAME,
  storeName: "library_books",
});
const filesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: "library_files",
});

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `book-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function titleFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stem || "Documento sin título";
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Porcentaje leído; la primera página todavía no cuenta como progreso. */
export function progressPercent(book: Pick<LocalBook, "lastPage" | "pages">): number {
  if (!book.pages || book.lastPage <= 1) return 0;
  return Math.min(100, Math.max(0, Math.round((book.lastPage / book.pages) * 100)));
}

async function renderCover(pdf: PDFDocumentProxy): Promise<string> {
  const page = await pdf.getPage(1);
  try {
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 320 / Math.max(1, base.width) });
    const dpr =
      typeof window === "undefined"
        ? 1
        : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no permite generar la portada.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: context,
      viewport,
      transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
    }).promise;
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    page.cleanup();
  }
}

/**
 * Lee un PDF local, extrae metadatos, genera su portada y guarda el archivo
 * binario y la ficha en IndexedDB. No se envía nada fuera del navegador.
 */
export async function importPdf(
  file: File,
  onStage?: (stage: ImportStage) => void,
): Promise<LocalBook> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new Error("El archivo seleccionado no es un PDF.");
  }

  onStage?.("reading");
  const data = new Uint8Array(await file.arrayBuffer());
  // pdf.js transfiere el ArrayBuffer al worker y lo deja detached. Guardamos
  // una copia en un Blob antes de entregarle otra copia al documento.
  const storedFile = new Blob([data], { type: "application/pdf" });
  if (storedFile.size === 0) {
    throw new Error("El PDF está vacío o no se pudo leer.");
  }
  const loadingTask = pdfjs.getDocument({ data: data.slice() });
  const pdf = await loadingTask.promise;

  try {
    const metadata = await pdf.getMetadata().catch(() => null);
    const info = (metadata?.info ?? {}) as { Title?: unknown; Author?: unknown };
    const metaTitle = typeof info.Title === "string" ? info.Title.trim() : "";
    const metaAuthor = typeof info.Author === "string" ? info.Author.trim() : "";

    onStage?.("cover");
    const cover = await renderCover(pdf);
    const now = Date.now();
    const book: LocalBook = {
      id: newId(),
      title: metaTitle || titleFromFileName(file.name),
      author: metaAuthor || "Autor desconocido",
      fileName: file.name || "documento.pdf",
      pages: pdf.numPages,
      size: file.size,
      cover,
      addedAt: now,
      updatedAt: now,
      lastPage: 1,
      zoom: 100,
      notes: "",
      bookmarks: [],
    };

    onStage?.("saving");
    await booksStore.setItem(book.id, book);
    try {
      await filesStore.setItem(book.id, storedFile);
    } catch (error) {
      await booksStore.removeItem(book.id);
      throw error;
    }
    return book;
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}

export async function listBooks(): Promise<LocalBook[]> {
  const books: LocalBook[] = [];
  await booksStore.iterate<LocalBook, void>((value) => {
    if (value) books.push(value);
  });
  return books.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getBook(id: string): Promise<LocalBook | null> {
  return booksStore.getItem<LocalBook>(id);
}

export async function getBookFile(id: string): Promise<Blob | null> {
  const value = await filesStore.getItem<Blob>(id);
  return value instanceof Blob ? value : null;
}

export async function updateBook(
  id: string,
  patch: Partial<Omit<LocalBook, "id" | "updatedAt">>,
): Promise<LocalBook | null> {
  const current = await getBook(id);
  if (!current) return null;
  const next: LocalBook = {
    ...current,
    ...patch,
    id,
    updatedAt: Date.now(),
  };
  await booksStore.setItem(id, next);
  return next;
}

export async function deleteBook(id: string): Promise<void> {
  await Promise.all([booksStore.removeItem(id), filesStore.removeItem(id)]);
}
