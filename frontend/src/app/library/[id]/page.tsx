"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Headphones,
  Highlighter,
  List,
  Loader2,
  MessageCircleQuestion,
  NotebookPen,
  Quote,
  RefreshCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";

import { AddToNotebookButton } from "@/components/add-to-notebook";
import { PdfCanvasViewer } from "@/components/pdf-canvas-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, ApiError } from "@/lib/api";
import type {
  BookCitation,
  BookDetail,
  BookMessage,
  BookSection,
  BookSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "¿Cuáles son las ideas principales de este capítulo?",
  "Explícame lo más importante en palabras sencillas.",
  "¿Qué conceptos debería memorizar?",
  "Hazme un resumen para repasar.",
];

const FORMAT_LABEL: Record<string, string> = {
  pdf: "PDF",
  epub: "EPUB",
  docx: "DOCX",
  txt: "TXT",
  md: "Markdown",
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function formatDate(value: string | null): string {
  if (!value) return "Sin abrir todavía";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BookReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = String(params.id);

  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [section, setSection] = useState<BookSection | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [showChapters, setShowChapters] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [panelTab, setPanelTab] = useState<"ask" | "summary">("ask");
  const [messages, setMessages] = useState<BookMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BookSummary | null>(null);
  const [summaryScope, setSummaryScope] = useState<"current" | "book">("current");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotal, setPdfTotal] = useState(0);

  const initialized = useRef(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadBook = useCallback(async () => {
    try {
      const data = await api.book(bookId);
      setBook(data);
      setError(null);
      if (data.status === "ready" && !initialized.current) {
        initialized.current = true;
        setIndex(data.current_section_index);
        // Marca la apertura para que "Continuar leyendo" sepa dónde volver.
        api
          .updateBookProgress(data.id, { section_index: data.current_section_index })
          .then((updated) => setBook((current) => (current ? { ...current, ...updated } : current)))
          .catch(() => undefined);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    initialized.current = false;
    void loadBook();
  }, [loadBook]);

  useEffect(() => {
    if (book?.status !== "processing") return;
    const timer = window.setTimeout(() => void loadBook(), 2600);
    return () => window.clearTimeout(timer);
  }, [book?.status, loadBook]);

  useEffect(() => {
    if (!book || book.status !== "ready" || book.text_available === false) return;
    let cancelled = false;
    setSectionLoading(true);
    api
      .bookSection(book.id, index)
      .then((data) => {
        if (!cancelled) setSection(data);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setSectionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [book?.id, book?.status, book?.text_available, index]);

  useEffect(() => {
    if (!book || book.status !== "ready" || book.text_available === false) return;
    api
      .bookMessages(book.id)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [book?.id, book?.status, book?.text_available]);

  useEffect(() => {
    setSummary(null);
  }, [index]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("autopilot_reader_font"));
    if (stored >= 15 && stored <= 26) setFontSize(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("autopilot_reader_font", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, asking]);

  const progress = useMemo(() => {
    if (!book) return 0;
    if (book.text_available === false || book.status === "error") {
      return pdfTotal ? (pdfPage / pdfTotal) * 100 : book.progress_percent;
    }
    if (book.total_sections === 0) return 0;
    return Math.max(book.progress_percent, ((index + 1) / book.total_sections) * 100);
  }, [book, index, pdfPage, pdfTotal]);

  async function goToSection(next: number) {
    if (!book || book.total_sections === 0) return;
    const clamped = Math.max(0, Math.min(next, book.total_sections - 1));
    if (clamped === index) {
      readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setIndex(clamped);
    setShowChapters(false);
    setHighlight(null);
    readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const updated = await api.updateBookProgress(book.id, { section_index: clamped });
      setBook((current) => (current ? { ...current, ...updated } : current));
    } catch {
      // El progreso se reintentará al cambiar de sección; la lectura no se bloquea.
    }
  }

  async function ask(text = question) {
    if (!book || !text.trim() || asking) return;
    const clean = text.trim();
    setAsking(true);
    setPanelError(null);
    setQuestion("");
    setPanelTab("ask");
    try {
      await api.askBook(book.id, { question: clean, section_index: index });
      const updated = await api.bookMessages(book.id);
      setMessages(updated);
    } catch (caught) {
      setPanelError(errorMessage(caught));
      setQuestion(clean);
    } finally {
      setAsking(false);
    }
  }

  async function clearChat() {
    if (!book) return;
    if (!window.confirm("¿Borrar el historial de preguntas de este libro?")) return;
    try {
      await api.clearBookMessages(book.id);
      setMessages([]);
    } catch (caught) {
      setPanelError(errorMessage(caught));
    }
  }

  async function makeSummary(scope: "current" | "book") {
    if (!book || summaryLoading) return;
    setSummaryScope(scope);
    setSummaryLoading(true);
    setPanelError(null);
    try {
      const data = await api.bookSummary(book.id, { scope, section_index: index });
      setSummary(data);
    } catch (caught) {
      setPanelError(errorMessage(caught));
    } finally {
      setSummaryLoading(false);
    }
  }

  function speakSummary() {
    if (!summary || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setPanelError("Tu navegador no permite la lectura en voz alta.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = [summary.title, summary.summary, ...summary.key_points].filter(Boolean).join(". ");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 0.98;
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.lang.toLowerCase().startsWith("es"));
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  async function copySummary() {
    if (!summary) return;
    const text = [summary.summary, ...summary.key_points.map((point) => `• ${point}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setPanelError("No se pudo copiar el resumen.");
    }
  }

  function jumpToCitation(citation: BookCitation) {
    void goToSection(citation.section_index);
    setHighlight(citation.quote);
  }

  if (loading) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Abriendo el libro...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
        <h1 className="mt-3 text-lg font-bold">No encontramos este libro</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error || "Puede que se haya borrado."}</p>
        <Link href="/library" className="mt-4 inline-block">
          <Button>Volver a la biblioteca</Button>
        </Link>
      </div>
    );
  }

  if (book.status === "processing") {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600">
          <Loader2 className="h-7 w-7 animate-spin" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Preparando “{book.title}”</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estamos extrayendo todo el texto y dividiéndolo en capítulos. Esta página se actualizará
          sola en unos segundos.
        </p>
        <Link href="/library" className="mt-5 inline-block">
          <Button variant="secondary">Volver mientras tanto</Button>
        </Link>
      </div>
    );
  }

  const scannedPdf =
    book.format === "pdf" &&
    Boolean(book.document_id) &&
    (book.status === "error" ||
      book.text_available === false ||
      (book.status === "ready" && book.total_chars === 0));

  if (scannedPdf) {
    return (
      <div className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-white/40 bg-white/55 backdrop-blur-3xl dark:border-white/10 dark:bg-black/30">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-3">
            <Link
              href="/library"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white/60 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Volver a la biblioteca"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div
              className="hidden h-11 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-lg sm:flex"
              style={{ background: `linear-gradient(145deg, ${book.cover_color}, #0f172a)` }}
            >
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                {book.title}
              </h1>
              <p className="truncate text-[11px] text-slate-500 dark:text-white/50">
                {book.author || "Autor desconocido"} · PDF escaneado · visor de imagen
              </p>
            </div>
            <div className="hidden min-w-[160px] max-w-[240px] flex-1 md:block">
              <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-white/50">
                <span>Progreso</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="mt-1 h-1.5 bg-white/35 dark:bg-white/10" />
            </div>
            <Badge
              variant="secondary"
              className="rounded-full border border-white/50 bg-white/55 text-[10px] font-semibold text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-white/65"
            >
              Modo imagen
            </Badge>
            <AddToNotebookButton bookId={book.id} label="Cuaderno" />
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 py-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-white/50">
            <span>
              Vista de imagen: el PDF se dibuja directamente en canvas y puedes leerlo con
              normalidad. Las herramientas que necesitan texto seleccionable no están disponibles
              en este archivo.
            </span>
            <span className="rounded-full border border-white/40 bg-white/45 px-2.5 py-1 font-medium backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
              {pdfTotal ? `Página ${pdfPage} de ${pdfTotal}` : "Preparando visor"}
            </span>
          </div>
          <PdfCanvasViewer
            documentId={book.document_id as string}
            initialPage={Math.max(1, book.current_section_index + 1)}
            title={book.title}
            onPageChange={(page, total) => {
              setPdfPage(page);
              setPdfTotal(total);
              api
                .updateBookProgress(book.id, {
                  section_index: Math.max(0, page - 1),
                  percent: total ? (page / total) * 100 : undefined,
                })
                .catch(() => undefined);
            }}
          />
        </main>
      </div>
    );
  }

  if (book.status === "error") {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-600">
          <BookOpen className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">No se pudo abrir el libro</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {book.error_message || "El archivo no contiene texto legible."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            onClick={async () => {
              const updated = await api.reprocessBook(book.id);
              setBook((current) => (current ? { ...current, ...updated } : current));
            }}
          >
            <RefreshCcw className="h-4 w-4" /> Reintentar
          </Button>
          <Link href="/library">
            <Button variant="secondary">Biblioteca</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentIndex = section?.section_index ?? index;

  return (
    <div className="min-h-dvh bg-slate-50/70">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href="/library"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Volver a la biblioteca"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div
            className="hidden h-11 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm sm:flex"
            style={{ background: `linear-gradient(145deg, ${book.cover_color}, #0f172a)` }}
          >
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold sm:text-base">{book.title}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {book.author || "Autor desconocido"} · {FORMAT_LABEL[book.format] || book.format} ·{" "}
              {book.total_sections} secciones
            </p>
          </div>
          <div className="hidden min-w-[180px] max-w-[260px] flex-1 md:block">
            <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
              <span>Progreso</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="mt-1 h-1.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <AddToNotebookButton bookId={book.id} label="Cuaderno" />
            <button
              type="button"
              onClick={() => setShowChapters((value) => !value)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 xl:hidden"
              aria-label="Ver capítulos"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 xl:grid-cols-[250px_minmax(0,1fr)_390px]">
        <aside className="hidden xl:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
            <div className="px-2 pb-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Contenido
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {book.total_sections} secciones · {Math.round(progress)}% leído
              </p>
            </div>
            <div className="space-y-0.5">
              {book.sections.map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => void goToSection(chapter.section_index)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors",
                    chapter.section_index === currentIndex
                      ? "bg-indigo-50 font-semibold text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                      chapter.section_index < currentIndex
                        ? "bg-emerald-100 text-emerald-700"
                        : chapter.section_index === currentIndex
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {chapter.section_index < currentIndex ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      chapter.section_index + 1
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 leading-5">{chapter.title}</span>
                    {chapter.page_start && (
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                        Pág. {chapter.page_start}
                        {chapter.page_end && chapter.page_end !== chapter.page_start
                          ? `–${chapter.page_end}`
                          : ""}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main ref={readerRef} className="min-w-0 scroll-mt-24">
          {showChapters && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:hidden">
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Capítulos</p>
                <button type="button" onClick={() => setShowChapters(false)}>
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {book.sections.map((chapter) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => void goToSection(chapter.section_index)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs",
                      chapter.section_index === currentIndex
                        ? "bg-indigo-50 font-semibold text-indigo-700"
                        : "text-slate-600",
                    )}
                  >
                    <span className="w-5 text-right text-[10px] text-slate-400">
                      {chapter.section_index + 1}
                    </span>
                    <span className="truncate">{chapter.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {highlight && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex items-start gap-2">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Cita de la sección
                  </p>
                  <p className="mt-1 leading-6">{highlight}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHighlight(null)}
                  className="text-amber-600 hover:text-amber-800"
                  aria-label="Quitar cita"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <article className="rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
                  Sección {currentIndex + 1} de {book.total_sections}
                </p>
                <h2 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">
                  {section?.title || `Sección ${currentIndex + 1}`}
                </h2>
                {section?.page_start && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Páginas {section.page_start}
                    {section.page_end && section.page_end !== section.page_start
                      ? `–${section.page_end}`
                      : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => setFontSize((value) => Math.max(15, value - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100"
                  aria-label="Reducir texto"
                >
                  A-
                </button>
                <span className="px-1 text-[10px] text-slate-400">{fontSize}</span>
                <button
                  type="button"
                  onClick={() => setFontSize((value) => Math.min(26, value + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100"
                  aria-label="Aumentar texto"
                >
                  A+
                </button>
              </div>
            </div>

            {sectionLoading ? (
              <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando sección...
              </div>
            ) : section ? (
              <div
                className="prose-reader mt-6 leading-8 text-slate-700"
                style={{ fontSize: `${fontSize}px` }}
              >
                {section.content.split(/\n{2,}/).map((paragraph, position) => (
                  <p key={position} className="mb-5 whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl bg-slate-50 p-6 text-sm text-muted-foreground">
                No se pudo cargar esta sección. Prueba a recargar la página.
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="secondary"
                onClick={() => void goToSection(currentIndex - 1)}
                disabled={currentIndex <= 0}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-center text-[11px] text-muted-foreground">
                {formatDate(book.last_opened_at)} · {Math.round(progress)}% del libro
              </span>
              <Button
                onClick={() => void goToSection(currentIndex + 1)}
                disabled={currentIndex >= book.total_sections - 1}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </article>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs text-muted-foreground shadow-sm">
            <span className="flex items-center gap-2">
              <Highlighter className="h-4 w-4 text-indigo-500" />
              Pregunta con citas o escucha el resumen sin perder la página.
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPanelTab("ask");
                  document.getElementById("book-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <MessageCircleQuestion className="h-4 w-4" /> Preguntar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPanelTab("summary");
                  document.getElementById("book-panel")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Headphones className="h-4 w-4" /> Resumen
              </Button>
            </div>
          </div>
        </main>

        <aside id="book-panel" className="min-w-0 scroll-mt-24">
          <div className="space-y-3 xl:sticky xl:top-24">
            <div className="flex rounded-xl bg-slate-200/60 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPanelTab("ask")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition-colors",
                  panelTab === "ask" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500",
                )}
              >
                <MessageCircleQuestion className="h-4 w-4" /> Preguntar
              </button>
              <button
                type="button"
                onClick={() => setPanelTab("summary")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition-colors",
                  panelTab === "summary" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500",
                )}
              >
                <Headphones className="h-4 w-4" /> Resumen
              </button>
            </div>

            {panelError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {panelError}
              </p>
            )}

            {panelTab === "ask" ? (
              <div className="flex max-h-[70dvh] flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:h-[calc(100dvh-9rem)] xl:max-h-none">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-bold">
                      <Sparkles className="h-4 w-4 text-indigo-500" /> Preguntar al libro
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Respuestas con citas de la sección exacta
                    </p>
                  </div>
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void clearChat()}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500"
                      aria-label="Borrar historial"
                      title="Borrar historial"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
                  {messages.length === 0 && !asking && (
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-3 text-xs leading-5 text-slate-600">
                        <p className="font-semibold text-indigo-800">Empieza por una pregunta</p>
                        <p className="mt-1">
                          Estás en “{section?.title || `sección ${currentIndex + 1}`}”. Puedo
                          responder usando solo este libro y enseñarte de dónde sale cada idea.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => void ask(suggestion)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-800"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[92%] rounded-2xl px-3 py-2 text-xs leading-5",
                          message.role === "user"
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-50 text-slate-700 ring-1 ring-slate-100",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.role === "assistant" && message.citations.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-2">
                            {message.citations.map((citation) => (
                              <button
                                key={`${message.id}-${citation.section_id}`}
                                type="button"
                                onClick={() => jumpToCitation(citation)}
                                className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-50"
                                title={citation.quote}
                              >
                                <Quote className="h-2.5 w-2.5" />
                                {citation.section_index + 1}. {citation.title.slice(0, 34)}
                                {citation.title.length > 34 ? "…" : ""}
                              </button>
                            ))}
                          </div>
                        )}
                        {message.role === "assistant" && message.source !== "ai" && (
                          <p className="mt-2 text-[10px] text-amber-700">
                            Extraído literalmente del libro · sin IA conectada
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {asking && (
                    <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-100">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                      Buscando en el libro y preparando la respuesta...
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-slate-100 p-2.5">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void ask();
                        }
                      }}
                      rows={2}
                      placeholder="Pregunta algo sobre este capítulo..."
                      className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400"
                    />
                    <Button
                      size="icon"
                      onClick={() => void ask()}
                      disabled={asking || !question.trim()}
                      aria-label="Enviar pregunta"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                    Las citas te llevan a la sección. El historial se guarda.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex max-h-[70dvh] flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:h-[calc(100dvh-9rem)] xl:max-h-none">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <Headphones className="h-4 w-4 text-indigo-500" /> Resumen para estudiar
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Escúchalo con la voz del navegador
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void makeSummary("current")}
                      disabled={summaryLoading}
                      className={cn(
                        "flex-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors",
                        summaryScope === "current" && summary
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      Este capítulo
                    </button>
                    <button
                      type="button"
                      onClick={() => void makeSummary("book")}
                      disabled={summaryLoading}
                      className={cn(
                        "flex-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors",
                        summaryScope === "book" && summary
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      Todo el libro
                    </button>
                  </div>

                  {!summary && !summaryLoading && (
                    <div className="mt-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-4 text-xs leading-5 text-slate-600">
                      <p className="font-semibold text-indigo-800">Estudia sin releerlo todo</p>
                      <p className="mt-1">
                        Genera un resumen del capítulo actual o una visión general del libro.
                        Después puedes escucharlo mientras ordenas apuntes.
                      </p>
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => void makeSummary("current")}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Resumir este capítulo
                      </Button>
                    </div>
                  )}

                  {summaryLoading && (
                    <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      Leyendo y resumiendo...
                    </div>
                  )}

                  {summary && (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={summary.source === "ai" ? "default" : "warning"}>
                          {summary.source === "ai" ? "Resumen con IA" : "Resumen extractivo"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {summaryScope === "book" ? "Visión general" : "Capítulo actual"}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold leading-5">{summary.title}</h3>
                      <p className="text-xs leading-6 text-slate-600">{summary.summary}</p>
                      {summary.key_points.length > 0 && (
                        <ul className="space-y-1.5">
                          {summary.key_points.map((point, position) => (
                            <li
                              key={position}
                              className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700"
                            >
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      )}
                      {summary.notice && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                          {summary.notice}
                        </p>
                      )}
                      {summary.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {summary.citations.map((citation) => (
                            <button
                              key={citation.section_id}
                              type="button"
                              onClick={() => jumpToCitation(citation)}
                              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              <Quote className="h-2.5 w-2.5" />
                              {citation.title.slice(0, 30)}
                              {citation.title.length > 30 ? "…" : ""}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                        <Button size="sm" variant="secondary" onClick={speakSummary}>
                          {speaking ? (
                            <Square className="h-3.5 w-3.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                          {speaking ? "Detener" : "Escuchar resumen"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void copySummary()}>
                          {copied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copied ? "Copiado" : "Copiar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 text-[10px] leading-4 text-muted-foreground shadow-sm">
              <p className="flex items-center gap-1.5 font-semibold text-slate-600">
                <NotebookPen className="h-3.5 w-3.5 text-indigo-500" /> Llévalo a un cuaderno
              </p>
              <p className="mt-1">
                Añade este libro como fuente para tener apuntes, preguntas y citas en el mismo
                sitio.
              </p>
              <div className="mt-2">
                <AddToNotebookButton bookId={book.id} label="Añadir a un cuaderno" variant="outline" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
