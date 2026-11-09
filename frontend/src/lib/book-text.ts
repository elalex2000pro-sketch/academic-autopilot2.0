// Extrae el texto del PDF que el estudiante tiene abierto en la Biblioteca.
//
// Todo ocurre en el navegador y en el worker de pdf.js: la interfaz no se
// bloquea. La lectura se limita en páginas y caracteres, se puede cancelar y se
// reutiliza la última extracción para no repetir trabajo al insistir en la
// misma página.

import { getBookFile } from "@/lib/local-library";
import type { PDFDocumentProxy } from "pdfjs-dist";

import type { OpenBookContext } from "@/lib/book-context";

export const MAX_BOOK_CONTEXT_CHARS = 24_000;
export const MAX_BOOK_CONTEXT_PAGES = 8;
const MIN_USEFUL_CHARS = 40;
const CACHE_LIMIT = 6;

export interface BookTextResult {
  text: string;
  bookTitle: string;
  chapterTitle: string | null;
  startPage: number;
  endPage: number;
  pagesRead: number;
  truncated: boolean;
  hasText: boolean;
}

export interface ExtractBookOptions {
  signal?: AbortSignal;
  maxChars?: number;
  maxPages?: number;
}

const cache = new Map<string, BookTextResult>();

function abortError(): Error {
  const error = new Error("Lectura del PDF cancelada.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** Cede el hilo principal entre páginas para que la interfaz siga fluida. */
async function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) {
    await scheduler.yield();
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function clampPage(value: number, total: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value), 1), Math.max(1, total));
}

function layoutText(items: Array<{ str?: unknown; hasEOL?: unknown }>): string {
  let output = "";
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    output += item.str;
    output += item.hasEOL ? "\n" : " ";
  }
  return output
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface RawOutlineItem {
  title?: unknown;
  dest?: unknown;
  items?: RawOutlineItem[];
}

interface BookChapter {
  title: string;
  page: number;
}

async function resolveDestinationPage(
  pdf: PDFDocumentProxy,
  dest: unknown,
): Promise<number | null> {
  try {
    const explicit = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const reference = explicit[0];
    if (typeof reference === "number") return clampPage(reference + 1, pdf.numPages);
    const index = await pdf.getPageIndex(
      reference as Parameters<PDFDocumentProxy["getPageIndex"]>[0],
    );
    return clampPage(index + 1, pdf.numPages);
  } catch {
    return null;
  }
}

/** Índice del PDF convertido en capítulos con su página de inicio. */
async function loadChapters(pdf: PDFDocumentProxy): Promise<BookChapter[]> {
  const outline = (await pdf.getOutline().catch(() => null)) as RawOutlineItem[] | null;
  if (!outline || outline.length === 0) return [];

  const flat: Array<{ title: string; dest: unknown }> = [];
  const walk = (items: RawOutlineItem[], depth: number) => {
    for (const item of items) {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (title && depth < 4) flat.push({ title, dest: item.dest });
      if (item.items?.length) walk(item.items, depth + 1);
    }
  };
  walk(outline, 0);

  const chapters: BookChapter[] = [];
  for (const item of flat.slice(0, 80)) {
    const page = await resolveDestinationPage(pdf, item.dest);
    if (page !== null) chapters.push({ title: item.title, page });
  }
  return chapters.sort((a, b) => a.page - b.page);
}

/** Devuelve el capítulo que contiene la página actual, si el PDF tiene índice. */
function chapterForPage(
  chapters: BookChapter[],
  page: number,
): { current: BookChapter; next: BookChapter | null } | null {
  let current: BookChapter | null = null;
  let next: BookChapter | null = null;
  for (const chapter of chapters) {
    if (chapter.page <= page) current = chapter;
    else {
      next = chapter;
      break;
    }
  }
  return current ? { current, next } : null;
}

/**
 * Lee la página actual (o el capítulo completo si es corto) del PDF local.
 * Devuelve `hasText: false` en libros escaneados sin capa de texto.
 */
export async function extractBookText(
  book: Pick<OpenBookContext, "bookId" | "title" | "page">,
  options: ExtractBookOptions = {},
): Promise<BookTextResult> {
  const maxChars = Math.max(2000, options.maxChars ?? MAX_BOOK_CONTEXT_CHARS);
  const maxPages = Math.max(1, options.maxPages ?? MAX_BOOK_CONTEXT_PAGES);
  const cacheKey = `${book.bookId}|${book.page}|${maxPages}|${maxChars}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  throwIfAborted(options.signal);

  const blob = await getBookFile(book.bookId);
  if (!blob) throw new Error("El archivo PDF no está disponible en este dispositivo.");

  const data = new Uint8Array(await blob.arrayBuffer());
  throwIfAborted(options.signal);

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data }).promise;

  try {
    throwIfAborted(options.signal);
    const totalPages = pdf.numPages;
    const currentPage = clampPage(book.page, totalPages);
    const chapters = await loadChapters(pdf).catch(() => []);
    throwIfAborted(options.signal);

    let chapterTitle: string | null = null;
    let startPage = currentPage;
    let endPage = Math.min(totalPages, currentPage + maxPages - 1);

    const chapter = chapterForPage(chapters, currentPage);
    if (chapter) {
      const chapterStart = chapter.current.page;
      const chapterEnd = Math.min(
        totalPages,
        (chapter.next?.page ?? totalPages + 1) - 1,
      );
      chapterTitle = chapter.current.title;
      // Un capítulo corto se envía entero; uno largo, desde la página actual.
      startPage =
        chapterEnd - chapterStart + 1 <= maxPages ? chapterStart : currentPage;
      endPage = Math.min(chapterEnd, startPage + maxPages - 1);
    }

    const blocks: string[] = [];
    let length = 0;
    let truncated = false;
    let pagesRead = 0;

    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
      throwIfAborted(options.signal);
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = layoutText(
          content.items as Array<{ str?: unknown; hasEOL?: unknown }>,
        );
        if (text) {
          const block = `[Página ${pageNumber}]\n${text}`;
          blocks.push(block);
          length += block.length + 2;
        }
      } finally {
        page.cleanup();
      }
      pagesRead += 1;
      if (length >= maxChars) {
        truncated = true;
        break;
      }
      await yieldToBrowser();
    }

    throwIfAborted(options.signal);
    let text = blocks.join("\n\n");
    if (text.length > maxChars) {
      text = text.slice(0, maxChars).trimEnd();
      truncated = true;
    }

    const result: BookTextResult = {
      text,
      bookTitle: book.title,
      chapterTitle,
      startPage,
      endPage: Math.max(startPage, startPage + Math.max(0, pagesRead - 1)),
      pagesRead,
      truncated,
      hasText: text.trim().length >= MIN_USEFUL_CHARS,
    };

    if (result.hasText) {
      if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(cacheKey, result);
    }
    return result;
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}
