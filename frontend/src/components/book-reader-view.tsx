"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Download,
  LayoutGrid,
  ListTree,
  Loader2,
  Minus,
  MoveHorizontal,
  MoveVertical,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import { openAiDrawer } from "@/lib/ai-drawer";
import { clearOpenBook, publishOpenBook } from "@/lib/book-context";
import {
  getBook,
  getBookFile,
  progressPercent,
  updateBook,
  type LocalBook,
} from "@/lib/local-library";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type ReaderTab = "outline" | "pages" | "bookmarks" | "notes" | "search";
type FitMode = "custom" | "width" | "height";

interface OutlineNode {
  title: string;
  page: number | null;
  children: OutlineNode[];
}

interface SearchHit {
  page: number;
  snippet: string;
  count: number;
}

interface SearchToken {
  cancelled: boolean;
}

const PAGE_ASPECT = 1.414;

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value), 1), Math.max(1, max));
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function highlightText(text: string, query: string): string {
  const term = query.trim();
  if (!term) return escapeHtml(text);
  const safeTerm = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escapeHtml(text).replace(
    new RegExp(`(${safeTerm})`, "gi"),
    '<mark class="pdf-search-hit">$1</mark>',
  );
}

function safeDownloadName(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "libro"
  );
}

async function resolveDestPage(
  pdf: PDFDocumentProxy,
  dest: unknown,
): Promise<number | null> {
  try {
    const explicit =
      typeof dest === "string" ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const reference = explicit[0];
    if (typeof reference === "number") {
      return clamp(reference + 1, pdf.numPages);
    }
    const index = await pdf.getPageIndex(
      reference as Parameters<PDFDocumentProxy["getPageIndex"]>[0],
    );
    return clamp(index + 1, pdf.numPages);
  } catch {
    return null;
  }
}

interface RawOutlineItem {
  title: string;
  dest?: unknown;
  items?: RawOutlineItem[];
}

async function mapOutline(
  pdf: PDFDocumentProxy,
  items: RawOutlineItem[],
): Promise<OutlineNode[]> {
  return Promise.all(
    items.map(async (item) => ({
      title: item.title,
      page: await resolveDestPage(pdf, item.dest),
      children: item.items?.length ? await mapOutline(pdf, item.items) : [],
    })),
  );
}

async function buildOutline(pdf: PDFDocumentProxy): Promise<OutlineNode[]> {
  const outline = await pdf.getOutline();
  if (!outline || outline.length === 0) return [];
  return mapOutline(pdf, outline as RawOutlineItem[]);
}

async function searchDocument(
  pdf: PDFDocumentProxy,
  rawQuery: string,
  token: SearchToken,
  onProgress: (searched: number) => void,
): Promise<SearchHit[]> {
  const query = rawQuery.trim().toLocaleLowerCase("es");
  if (!query) return [];

  const hits: SearchHit[] = [];
  const batchSize = 6;

  for (let start = 1; start <= pdf.numPages && hits.length < 120; start += batchSize) {
    if (token.cancelled) break;
    const pageNumbers = Array.from(
      { length: Math.min(batchSize, pdf.numPages - start + 1) },
      (_, index) => start + index,
    );
    const batch = await Promise.all(
      pageNumbers.map(async (pageNumber) => {
        const page = await pdf.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          const text = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          const lower = text.toLocaleLowerCase("es");
          let index = lower.indexOf(query);
          if (index < 0) return null;
          let count = 0;
          while (index >= 0) {
            count += 1;
            index = lower.indexOf(query, index + query.length);
          }
          const first = lower.indexOf(query);
          return {
            page: pageNumber,
            snippet: text.slice(
              Math.max(0, first - 55),
              Math.min(text.length, first + query.length + 95),
            ),
            count,
          } satisfies SearchHit;
        } finally {
          page.cleanup();
        }
      }),
    );
    for (const hit of batch) {
      if (hit) hits.push(hit);
      if (hits.length >= 120) break;
    }
    onProgress(Math.min(pdf.numPages, start + batchSize - 1));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return hits;
}

function PdfThumbnail({
  pdfDocument,
  pageNumber,
  active,
  onSelect,
}: {
  pdfDocument: PDFDocumentProxy | null;
  pageNumber: number;
  active: boolean;
  onSelect: (page: number) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible) return;
    const element = buttonRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: "360px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!pdfDocument || !visible) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    let page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>> | null = null;

    const render = async () => {
      try {
        page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 112 / base.width });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        const context = canvas.getContext("2d");
        if (!context) return;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        task = page.render({ canvasContext: context, viewport });
        await task.promise;
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void render();
    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {
        /* La tarea ya terminó o pdf.js la canceló. */
      }
      page?.cleanup();
    };
  }, [pageNumber, pdfDocument, visible]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-label={`Ir a la página ${pageNumber}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group min-w-0 rounded-xl border p-1.5 text-left transition-colors",
        active
          ? "border-[#0066FF]/60 bg-[#0066FF]/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]",
      )}
    >
      <span
        className="relative block overflow-hidden rounded-lg bg-white/[0.06]"
        style={{ aspectRatio: "1 / 1.414" }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={cn(
            "block h-full w-full object-contain transition-opacity",
            visible ? "opacity-100" : "opacity-0",
          )}
        />
        {!visible || failed ? (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/30">
            {failed ? "—" : <Loader2 className="h-4 w-4 animate-spin" />}
          </span>
        ) : null}
      </span>
      <span className="mt-1 flex items-center justify-between gap-1 text-[9.5px]">
        <span className="truncate text-white/60">Página {pageNumber}</span>
        {active ? <span className="h-1.5 w-1.5 rounded-full bg-[#8ab9ff]" /> : null}
      </span>
    </button>
  );
}

interface PdfPageProps {
  pageNumber: number;
  width?: number;
  height?: number;
  placeholderHeight: number;
  forceVisible: boolean;
  customTextRenderer: ((textItem: { str: string }) => string) | undefined;
  register: (page: number, element: HTMLDivElement | null) => void;
}

function PdfPage({
  pageNumber,
  width,
  height,
  placeholderHeight,
  forceVisible,
  customTextRenderer,
  register,
}: PdfPageProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(forceVisible);

  useEffect(() => {
    if (forceVisible) setVisible(true);
  }, [forceVisible]);

  useEffect(() => {
    register(pageNumber, shellRef.current);
    return () => register(pageNumber, null);
  }, [pageNumber, register]);

  useEffect(() => {
    if (visible) return;
    const element = shellRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: "1400px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={shellRef}
      id={`pdf-page-${pageNumber}`}
      data-page={pageNumber}
      className="pdf-page-shell"
      style={{ minHeight: placeholderHeight }}
    >
      {visible ? (
        height ? (
          <Page
            pageNumber={pageNumber}
            height={height}
            customTextRenderer={customTextRenderer}
            className="pdf-page"
          />
        ) : (
          <Page
            pageNumber={pageNumber}
            width={width ?? 800}
            customTextRenderer={customTextRenderer}
            className="pdf-page"
          />
        )
      ) : (
        <div className="pdf-page-placeholder" style={{ height: placeholderHeight }}>
          <span>Página {pageNumber}</span>
        </div>
      )}
    </div>
  );
}

function OutlineItems({
  nodes,
  depth = 0,
  onGo,
}: {
  nodes: OutlineNode[];
  depth?: number;
  onGo: (page: number) => void;
}) {
  return (
    <div>
      {nodes.map((node, index) => (
        <div key={`${depth}-${index}-${node.title}`}>
          <button
            type="button"
            disabled={!node.page}
            onClick={() => node.page && onGo(node.page)}
            className="flex w-full items-baseline gap-2 rounded-lg py-1.5 pr-2 text-left text-[12px] text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-default disabled:opacity-50"
            style={{ paddingLeft: `${10 + depth * 14}px` }}
          >
            <span className="min-w-0 flex-1 leading-4">{node.title}</span>
            {node.page && (
              <span className="shrink-0 text-[9px] tabular-nums text-white/30">
                {node.page}
              </span>
            )}
          </button>
          {node.children.length > 0 && (
            <OutlineItems nodes={node.children} depth={depth + 1} onGo={onGo} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReaderState({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0c0c0f] p-5 text-white">
      <div
        className={cn(
          "w-full max-w-md rounded-3xl border p-6 text-center",
          error
            ? "border-rose-400/20 bg-rose-500/10"
            : "border-white/10 bg-white/[0.04]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default function BookReaderView() {
  const params = useParams();
  const bookId = String(params.id);

  const [book, setBook] = useState<LocalBook | null>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageDraft, setPageDraft] = useState("1");
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<FitMode>("custom");
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024,
  );
  const [sidebarTab, setSidebarTab] = useState<ReaderTab>("outline");
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [contentSize, setContentSize] = useState({
    width: typeof window === "undefined" ? 1200 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  });

  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(null);
  const bookRef = useRef<LocalBook | null>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const lastObservedPageRef = useRef(1);
  const currentPageRef = useRef(1);
  const closingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingPatchRef = useRef<Partial<LocalBook>>({});
  const searchTokenRef = useRef<SearchToken>({ cancelled: true });
  const initialPageRef = useRef(1);
  const scrollReadyRef = useRef(false);
  // Ancla de lectura: guarda la página y su posición vertical antes de un
  // cambio de zoom/ancho para restaurarla cuando el navegador reflowe el PDF.
  const zoomAnchorRef = useRef<{ page: number; top: number } | null>(null);
  const pageLockRef = useRef(false);
  const pageLockTimerRef = useRef<number | null>(null);
  const zoomRef = useRef(100);

  const setReaderPage = useCallback((page: number) => {
    currentPageRef.current = page;
    setPageNumber(page);
  }, []);

  const flushSave = useCallback(async () => {
    if (!bookRef.current || Object.keys(pendingPatchRef.current).length === 0) return;
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    // Serializa las escrituras para que una lectura anterior no pueda pisar
    // la página exacta que se guarda al cerrar el lector.
    const write = saveQueueRef.current.then(async () => {
      try {
        await updateBook(bookId, patch);
      } catch {
        // IndexedDB puede fallar en modo privado; la lectura continúa en memoria.
      }
    });
    saveQueueRef.current = write;
    await write;
  }, [bookId]);

  const persist = useCallback(
    (patch: Partial<LocalBook>) => {
      if (!bookRef.current) return;
      bookRef.current = {
        ...bookRef.current,
        ...patch,
        updatedAt: Date.now(),
      };
      setBook((current) => (current ? { ...current, ...patch } : current));
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void flushSave();
      }, 400);
    },
    [flushSave],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingBook(true);
    setBook(null);
    setFile(null);
    setError(null);
    setPdfDocument(null);
    setNumPages(0);
    setPageNumber(1);
    setPageDraft("1");
    setBookmarks([]);
    setNotes("");
    setOutline([]);
    setSearchInput("");
    setSearchQuery("");
    setSearchResults([]);
    setSearchDone(false);
    setSidebarTab("outline");
    bookRef.current = null;
    pendingPatchRef.current = {};
    lastObservedPageRef.current = 1;
    scrollReadyRef.current = false;

    async function load() {
      try {
        const metadata = await getBook(bookId);
        if (!metadata) {
          if (!cancelled) setError("Este PDF no está guardado en este dispositivo.");
          return;
        }
        const blob = await getBookFile(bookId);
        if (cancelled) return;
        bookRef.current = metadata;
        setBook(metadata);
        setBookmarks(metadata.bookmarks ?? []);
        setNotes(metadata.notes ?? "");
        setZoom(metadata.zoom >= 50 && metadata.zoom <= 200 ? metadata.zoom : 100);
        const initial = clamp(metadata.lastPage, metadata.pages);
        initialPageRef.current = initial;
        lastObservedPageRef.current = initial;
        setReaderPage(initial);
        setPageDraft(String(initial));
        if (!blob) {
          setError("El archivo PDF no está disponible en este dispositivo.");
          return;
        }
        setFile(blob);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo abrir el PDF local.",
          );
        }
      } finally {
        if (!cancelled) setLoadingBook(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      searchTokenRef.current.cancelled = true;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [bookId, flushSave, setReaderPage]);

  const saveCurrentPage = useCallback(() => {
    if (!bookRef.current) return;
    const current = clamp(currentPageRef.current, bookRef.current.pages);
    pendingPatchRef.current = {
      ...pendingPatchRef.current,
      lastPage: current,
    };
    void flushSave();
  }, [flushSave]);

  useEffect(() => {
    closingRef.current = false;
    return () => {
      closingRef.current = true;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveCurrentPage();
    };
  }, [saveCurrentPage]);

  const attachContent = useCallback((element: HTMLDivElement | null) => {
    setContentElement(element);
  }, []);

  const capturePageAnchor = useCallback(() => {
    if (!scrollReadyRef.current) return;
    const page = lastObservedPageRef.current;
    const element = pageRefs.current.get(page);
    if (!element) return;
    zoomAnchorRef.current = {
      page,
      top: element.getBoundingClientRect().top,
    };
    // Mientras el PDF se reflowea, los eventos de scroll no deben cambiar la
    // página activa: el zoom no es una intención de pasar de página.
    pageLockRef.current = true;
    if (pageLockTimerRef.current) window.clearTimeout(pageLockTimerRef.current);
    pageLockTimerRef.current = window.setTimeout(() => {
      pageLockRef.current = false;
      zoomAnchorRef.current = null;
      pageLockTimerRef.current = null;
    }, 500);
  }, []);

  useEffect(() => {
    const update = () => {
      capturePageAnchor();
      const width = contentElement?.clientWidth ?? window.innerWidth;
      setContentSize({ width, height: window.innerHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    if (contentElement) observer.observe(contentElement);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [capturePageAnchor, contentElement]);

  useEffect(() => {
    return () => {
      searchTokenRef.current.cancelled = true;
      if (pageLockTimerRef.current) {
        window.clearTimeout(pageLockTimerRef.current);
        pageLockTimerRef.current = null;
      }
    };
  }, []);

  const totalPages = numPages || book?.pages || 1;
  const availableWidth = Math.max(
    260,
    contentSize.width - (contentSize.width < 780 ? 24 : 48),
  );
  const availableHeight = Math.max(
    360,
    contentSize.height - (contentSize.width < 780 ? 250 : 150),
  );
  const pageWidth =
    fitMode === "height"
      ? undefined
      : fitMode === "width"
        ? availableWidth
        : Math.max(260, Math.min(900, availableWidth) * (zoom / 100));
  const pageHeight = fitMode === "height" ? availableHeight : undefined;
  const placeholderHeight = pageHeight ?? Math.round((pageWidth ?? availableWidth) * PAGE_ASPECT);

  // IA Studio consume este contexto para leer la página o el capítulo abierto.
  useEffect(() => {
    if (!book) return;
    publishOpenBook({
      bookId: book.id,
      title: book.title,
      author: book.author,
      page: pageNumber,
      pages: totalPages,
    });
  }, [book, pageNumber, totalPages]);

  useEffect(() => () => clearOpenBook(bookId), [bookId]);

  const customTextRenderer = useCallback(
    (textItem: { str: string }) => highlightText(textItem.str, searchQuery),
    [searchQuery],
  );

  const registerPage = useCallback(
    (page: number, element: HTMLDivElement | null) => {
      if (element) pageRefs.current.set(page, element);
      else pageRefs.current.delete(page);
    },
    [],
  );

  useEffect(() => {
    setPageDraft(String(pageNumber));
  }, [pageNumber]);

  const handleActivePage = useCallback(
    (page: number) => {
      if (closingRef.current || pageLockRef.current) return;
      if (page === lastObservedPageRef.current) return;
      lastObservedPageRef.current = page;
      setReaderPage(page);
      persist({ lastPage: page });
    },
    [persist, setReaderPage],
  );

  useEffect(() => {
    if (!numPages) return;
    let frame = 0;

    const updateActivePage = () => {
      frame = 0;
      if (!scrollReadyRef.current || pageLockRef.current || closingRef.current) return;
      let active = 1;
      let previousTop = -Infinity;
      const readingLine = window.innerHeight * 0.35;
      for (let page = 1; page <= numPages; page += 1) {
        const element = pageRefs.current.get(page);
        // Si el layout aún no está completo o las páginas se solapan durante
        // una transición, no interpretes el final del documento como leído.
        if (!element) return;
        const top = element.getBoundingClientRect().top;
        if (!Number.isFinite(top)) return;
        if (page > 1 && top <= previousTop) return;
        previousTop = top;
        if (top <= readingLine) active = page;
        else break;
      }
      handleActivePage(active);
    };

    const onScroll = () => {
      if (!scrollReadyRef.current || pageLockRef.current || closingRef.current || frame) return;
      frame = window.requestAnimationFrame(updateActivePage);
    };

    const readyTimer = window.setTimeout(() => {
      scrollReadyRef.current = true;
      updateActivePage();
    }, 500);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(readyTimer);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [handleActivePage, numPages]);

  const goToPage = useCallback(
    (value: number, behavior: ScrollBehavior = "smooth") => {
      const next = clamp(value, totalPages);
      lastObservedPageRef.current = next;
      setReaderPage(next);
      persist({ lastPage: next });
      const element = pageRefs.current.get(next);
      if (element) {
        element.scrollIntoView({ behavior, block: "start" });
      }
    },
    [persist, setReaderPage, totalPages],
  );

  const handleLoadSuccess = useCallback(
    (pdf: PDFDocumentProxy) => {
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
      setError(null);
      const initial = clamp(bookRef.current?.lastPage ?? 1, pdf.numPages);
      lastObservedPageRef.current = initial;
      setReaderPage(initial);
      setPageDraft(String(initial));
      setOutlineLoading(true);
      void buildOutline(pdf)
        .then((nodes) => setOutline(nodes))
        .catch(() => setOutline([]))
        .finally(() => setOutlineLoading(false));
      window.setTimeout(() => {
        pageRefs.current
          .get(initial)
          ?.scrollIntoView({ behavior: "auto", block: "start" });
      }, 250);
    },
    [setReaderPage],
  );

  const toggleBookmark = useCallback(() => {
    if (!bookRef.current) return;
    const current = pageNumber;
    const next = bookmarks.includes(current)
      ? bookmarks.filter((page) => page !== current)
      : [...bookmarks, current].sort((a, b) => a - b);
    setBookmarks(next);
    persist({ bookmarks: next });
  }, [bookmarks, pageNumber, persist]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    const element = pageRefs.current.get(anchor.page);
    if (element) {
      const delta = element.getBoundingClientRect().top - anchor.top;
      if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
      // La página ancla manda durante el reflow, aunque el navegador haya
      // emitido un scroll intermedio al cambiar el tamaño de las páginas.
      lastObservedPageRef.current = anchor.page;
      setReaderPage(anchor.page);
    }
    if (pageLockTimerRef.current) window.clearTimeout(pageLockTimerRef.current);
    pageLockTimerRef.current = window.setTimeout(() => {
      pageLockRef.current = false;
      zoomAnchorRef.current = null;
      pageLockTimerRef.current = null;
    }, 250);
  }, [contentSize.width, contentSize.height, fitMode, setReaderPage, zoom]);

  const changeZoom = useCallback(
    (delta: number) => {
      capturePageAnchor();
      const next = Math.min(200, Math.max(50, zoomRef.current + delta));
      zoomRef.current = next;
      setFitMode("custom");
      setZoom(next);
      persist({ zoom: next });
    },
    [capturePageAnchor, persist],
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      // En trackpads el gesto de pinza llega como wheel con ctrlKey. Se consume
      // aquí para que no haga scroll ni active el detector de página.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (Math.abs(event.deltaY) < 0.5) return;
      changeZoom(event.deltaY < 0 ? 10 : -10);
    },
    [changeZoom],
  );

  useEffect(() => {
    if (!contentElement) return;
    contentElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => contentElement.removeEventListener("wheel", handleWheel);
  }, [contentElement, handleWheel]);

  const chooseFit = useCallback(
    (mode: FitMode) => {
      capturePageAnchor();
      setFitMode(mode);
    },
    [capturePageAnchor],
  );

  const runSearch = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const term = searchInput.trim();
      searchTokenRef.current.cancelled = true;
      const token: SearchToken = { cancelled: false };
      searchTokenRef.current = token;
      setSearchQuery(term);
      setSearchResults([]);
      setSearchDone(false);
      if (!term || !pdfDocument) {
        setSearching(false);
        return;
      }
      setSearching(true);
      setSearchProgress(0);
      try {
        const hits = await searchDocument(pdfDocument, term, token, setSearchProgress);
        if (!token.cancelled) {
          setSearchResults(hits);
          setSearchDone(true);
        }
      } catch {
        if (!token.cancelled) {
          setSearchResults([]);
          setSearchDone(true);
        }
      } finally {
        if (!token.cancelled) setSearching(false);
      }
    },
    [pdfDocument, searchInput],
  );

  const clearSearch = useCallback(() => {
    searchTokenRef.current.cancelled = true;
    setSearchInput("");
    setSearchQuery("");
    setSearchResults([]);
    setSearchDone(false);
    setSearching(false);
    setSearchProgress(0);
  }, []);

  const exportNotes = useCallback(() => {
    if (!book) return;
    const markdown = [
      `# ${book.title}`,
      "",
      `**Autor:** ${book.author}`,
      `**Páginas:** ${book.pages}`,
      `**Página actual:** ${pageNumber}`,
      bookmarks.length > 0
        ? `**Marcapáginas:** ${bookmarks.map((page) => `p. ${page}`).join(", ")}`
        : "",
      "",
      "## Notas",
      "",
      notes.trim() || "_Sin notas todavía._",
      "",
    ]
      .filter((line) => line !== "")
      .join("\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeDownloadName(book.title)}-notas.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [book, bookmarks, notes, pageNumber]);

  function goFromSidebar(page: number) {
    goToPage(page);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }

  if (loadingBook) {
    return (
      <ReaderState>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-white/60" />
        <p className="mt-3 text-sm text-white/60">Abriendo tu PDF local…</p>
      </ReaderState>
    );
  }

  if (error || !book) {
    return (
      <ReaderState error>
        <AlertCircle className="mx-auto h-9 w-9 text-rose-300" />
        <h1 className="mt-3 text-lg font-semibold text-white">
          No se pudo abrir el PDF
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/55">
          {error ?? "El libro no está disponible en este dispositivo."}
        </p>
        <Link
          href="/library"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-[#17171b] transition-colors hover:bg-white/90"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la biblioteca
        </Link>
      </ReaderState>
    );
  }

  const progress = progressPercent({
    lastPage: pageNumber,
    pages: totalPages,
  });
  const isBookmarked = bookmarks.includes(pageNumber);
  const sidebarTabs: Array<{
    id: ReaderTab;
    label: string;
    icon: typeof ListTree;
  }> = [
    { id: "outline", label: "Índice", icon: ListTree },
    { id: "pages", label: "Páginas", icon: LayoutGrid },
    { id: "bookmarks", label: "Marcas", icon: Bookmark },
    { id: "notes", label: "Notas", icon: NotebookPen },
    { id: "search", label: "Buscar", icon: Search },
  ];

  return (
    <div className="pdf-reader flex min-h-dvh bg-[#0c0c0f] text-white">
      {sidebarOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar panel lateral"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[340px] flex-col border-r border-white/10 bg-[#0a0a0a]/60 shadow-2xl backdrop-blur-2xl lg:sticky lg:top-0 lg:z-20 lg:h-dvh lg:w-[320px] lg:shrink-0 lg:shadow-none">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold">Lector local</p>
                  <p className="truncate text-[9.5px] text-white/35">
                    {book.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar barra lateral"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1 border-b border-white/10 p-2">
              {sidebarTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSidebarTab(tab.id)}
                    aria-pressed={sidebarTab === tab.id}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-medium transition",
                      sidebarTab === tab.id
                        ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-white/50 hover:bg-white/[0.06] hover:text-white/80",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {sidebarTab === "outline" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                      Índice del documento
                    </p>
                    {outlineLoading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
                    )}
                  </div>
                  {outline.length > 0 ? (
                    <OutlineItems nodes={outline} onGo={goFromSidebar} />
                  ) : (
                    <p className="rounded-xl border border-dashed border-white/10 p-3 text-[11px] leading-5 text-white/35">
                      Este PDF no incluye un índice navegable. Puedes usar el
                      número de página de la barra superior.
                    </p>
                  )}
                </div>
              )}

              {sidebarTab === "pages" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                      Páginas
                    </p>
                    <span className="text-[9px] tabular-nums text-white/25">
                      {pdfDocument ? `${totalPages} páginas` : "Cargando…"}
                    </span>
                  </div>
                  {pdfDocument ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: totalPages }, (_, index) => {
                        const page = index + 1;
                        return (
                          <PdfThumbnail
                            key={page}
                            pdfDocument={pdfDocument}
                            pageNumber={page}
                            active={page === pageNumber}
                            onSelect={goFromSidebar}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 p-3 text-[11px] text-white/35">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Preparando las miniaturas del documento…
                    </p>
                  )}
                </div>
              )}

              {sidebarTab === "bookmarks" && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    Marcapáginas
                  </p>
                  {bookmarks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-3 text-[11px] leading-5 text-white/35">
                      Aún no has guardado ninguna página. Pulsa el icono de
                      marcapáginas en la barra superior.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {bookmarks.map((page) => (
                        <div
                          key={page}
                          className="flex items-center gap-1 rounded-lg hover:bg-white/[0.06]"
                        >
                          <button
                            type="button"
                            onClick={() => goFromSidebar(page)}
                            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[12px] text-white/70"
                          >
                            <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-white/60" />
                            <span className="flex-1">Página {page}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-white/25" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = bookmarks.filter((item) => item !== page);
                              setBookmarks(next);
                              persist({ bookmarks: next });
                            }}
                            aria-label={`Quitar marca de la página ${page}`}
                            className="mr-1 rounded-md p-1 text-white/25 hover:bg-rose-500/15 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === "notes" && (
                <div className="flex h-full min-h-[320px] flex-col">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                      Notas del libro
                    </p>
                    <span className="text-[9px] text-white/25">Autoguardado</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      persist({ notes: event.target.value });
                    }}
                    placeholder="Escribe aquí tus apuntes, citas o ideas sobre este PDF…"
                    className="min-h-[220px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px] leading-5 text-white/80 outline-none placeholder:text-white/25 transition-colors focus:border-white/25 focus:bg-white/[0.06]"
                  />
                  <button
                    type="button"
                    onClick={exportNotes}
                    className="mt-2 inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-[11px] font-semibold text-white/75 transition hover:bg-white/15 hover:text-white"
                  >
                    <Download className="h-3.5 w-3.5" /> Exportar notas a Markdown
                  </button>
                </div>
              )}

              {sidebarTab === "search" && (
                <div>
                  <form onSubmit={(event) => void runSearch(event)} className="space-y-2">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                      <input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Buscar en el PDF…"
                        aria-label="Buscar texto en el PDF"
                        className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-8 pr-2 text-[12px] text-white/80 outline-none placeholder:text-white/25 transition-colors focus:border-white/25 focus:bg-white/[0.06]"
                      />
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="submit"
                        disabled={searching || !searchInput.trim()}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-40"
                      >
                        {searching ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Search className="h-3.5 w-3.5" />
                        )}
                        Buscar
                      </button>
                      {(searchQuery || searchResults.length > 0) && (
                        <button
                          type="button"
                          onClick={clearSearch}
                          className="h-8 rounded-lg bg-white/10 px-2.5 text-[11px] text-white/55 hover:bg-white/15"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </form>

                  {searching && (
                    <p className="mt-3 flex items-center gap-2 text-[10px] text-white/35">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Buscando en {searchProgress} de {totalPages} páginas…
                    </p>
                  )}
                  {!searching && searchDone && searchResults.length === 0 && (
                    <p className="mt-3 rounded-xl border border-dashed border-white/10 p-3 text-[11px] leading-5 text-white/35">
                      No se ha encontrado «{searchQuery}». Si el PDF es escaneado,
                      no contiene una capa de texto seleccionable.
                    </p>
                  )}
                  {searchResults.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] text-white/30">
                        {searchResults.reduce((total, hit) => total + hit.count, 0)}{" "}
                        coincidencias en {searchResults.length} páginas
                      </p>
                      {searchResults.map((hit) => (
                        <button
                          key={hit.page}
                          type="button"
                          onClick={() => goFromSidebar(hit.page)}
                          className="w-full rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-white/80">
                              Página {hit.page}
                            </span>
                            <span className="text-[9px] text-white/25">
                              {hit.count} {hit.count === 1 ? "vez" : "veces"}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-3 block text-[10.5px] leading-4 text-white/45">
                            …{hit.snippet}…
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 px-3 py-2 text-[9px] text-white/25">
              {book.pages} páginas · {Math.round(progress)}% leído
            </div>
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0a]/60 backdrop-blur-2xl">
          <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 sm:px-4">
            <Link
              href="/library"
              onClick={saveCurrentPage}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
              aria-label="Volver a la biblioteca"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen((value) => !value)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
              aria-label={sidebarOpen ? "Ocultar panel lateral" : "Mostrar panel lateral"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
            <div className="min-w-[110px] flex-1">
              <h1 className="truncate text-[12px] font-semibold text-white/90">
                {book.title}
              </h1>
              <p className="truncate text-[9.5px] text-white/35">
                {book.author} · PDF local
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                goToPage(Number(pageDraft), "auto");
              }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-1.5 py-1"
            >
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageDraft}
                onChange={(event) => setPageDraft(event.target.value)}
                onBlur={() => {
                  const value = Number(pageDraft);
                  if (Number.isFinite(value)) goToPage(value, "auto");
                  else setPageDraft(String(pageNumber));
                }}
                aria-label="Ir a la página"
                className="w-10 bg-transparent text-center text-[11px] font-medium text-white/80 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-white/30">/ {totalPages}</span>
            </form>

            <button
              type="button"
              onClick={toggleBookmark}
              aria-label={isBookmarked ? "Quitar marcapáginas" : "Guardar marcapáginas"}
              aria-pressed={isBookmarked}
              title={isBookmarked ? "Quitar marcapáginas" : "Guardar página"}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                isBookmarked
                  ? "bg-white/10 text-white"
                  : "text-white/45 hover:bg-white/10 hover:text-white",
              )}
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={openAiDrawer}
              aria-label="Preguntar a la IA sobre esta página"
              title="Preguntar a la IA sobre esta página"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white"
            >
              <Sparkles className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
              <button
                type="button"
                onClick={() => changeZoom(-10)}
                aria-label="Reducir zoom"
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[38px] text-center text-[10px] text-white/55">
                {fitMode === "width" ? "Ancho" : fitMode === "height" ? "Alto" : `${zoom}%`}
              </span>
              <button
                type="button"
                onClick={() => changeZoom(10)}
                aria-label="Aumentar zoom"
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => chooseFit("width")}
              aria-label="Ajustar al ancho"
              title="Ajustar al ancho"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                fitMode === "width"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:bg-white/10 hover:text-white",
              )}
            >
              <MoveHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => chooseFit("height")}
              aria-label="Ajustar al alto"
              title="Ajustar al alto"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                fitMode === "height"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:bg-white/10 hover:text-white",
              )}
            >
              <MoveVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="h-0.5 bg-white/5">
            <div
              className="h-full bg-white/30 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <main ref={attachContent} className="pdf-reader-pages flex-1 px-3 py-5 sm:px-5">
          {file && (
            <Document
              file={file}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={(reason) => {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "No se pudo procesar el PDF.",
                );
              }}
              loading={
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-white/40">
                  <Loader2 className="h-6 w-6 animate-spin text-white/60" />
                  <span className="text-[11px]">Preparando el documento…</span>
                </div>
              }
              error={
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center text-white/50">
                  <AlertCircle className="h-7 w-7 text-rose-300" />
                  <span className="text-sm">No se pudo abrir este PDF.</span>
                </div>
              }
            >
              {numPages > 0 &&
                Array.from({ length: numPages }, (_, index) => {
                  const page = index + 1;
                  return (
                    <PdfPage
                      key={page}
                      pageNumber={page}
                      width={pageWidth}
                      height={pageHeight}
                      placeholderHeight={placeholderHeight}
                      forceVisible={page === initialPageRef.current}
                      customTextRenderer={customTextRenderer}
                      register={registerPage}
                    />
                  );
                })}
            </Document>
          )}
        </main>
      </div>
    </div>
  );
}
