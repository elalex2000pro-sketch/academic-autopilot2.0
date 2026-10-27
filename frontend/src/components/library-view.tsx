"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Headphones,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { AddToNotebookButton } from "@/components/add-to-notebook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api, ApiError } from "@/lib/api";
import {
  deleteCachedApiResponse,
  deleteCachedApiResponsesByPrefix,
} from "@/lib/local-cache";
import { uploadFileInChunks, type UploadProgress } from "@/lib/upload";
import type { Book, Course } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.epub,.docx,.txt,.md";
const MAX_BOOK_MB = 512;

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

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(value: string | null): string {
  if (!value) return "Sin empezar";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const day = 86_400_000;
  if (diff < day) return "Leído hoy";
  if (diff < 2 * day) return "Leído ayer";
  if (diff < 7 * day) return `Hace ${Math.floor(diff / day)} días`;
  return `Último acceso ${date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`;
}

function bookStatus(book: Book): "new" | "reading" | "done" {
  if (book.progress_percent >= 99) return "done";
  if (book.progress_percent > 0 || book.last_opened_at) return "reading";
  return "new";
}

function isScannedPdf(book: Book): boolean {
  return (
    book.format === "pdf" &&
    book.status === "ready" &&
    (book.text_available === false || book.total_chars === 0)
  );
}

export default function LibraryView() {
  const [books, setBooks] = useState<Book[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "reading" | "new" | "done">("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourse, setUploadCourse] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookData, courseData] = await Promise.all([
        api.books(),
        api.courses().catch(() => []),
      ]);
      setBooks(bookData);
      setCourses(courseData);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // La confirmación de borrado se cierra con Escape y bloquea el scroll de
  // fondo mientras está abierta.
  useEffect(() => {
    if (!pendingDelete) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setPendingDelete(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [pendingDelete, deleting]);

  // Los libros se extraen en segundo plano: refresca solo los que están en cola.
  useEffect(() => {
    const processing = books.filter((book) => book.status === "processing");
    if (processing.length === 0) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      const updates = await Promise.all(
        processing.map((book) => api.book(book.id).catch(() => null)),
      );
      if (cancelled) return;
      const ready = updates.find(
        (updated) => updated?.status === "ready" && updated.total_sections > 0,
      );
      if (ready) setNotice(`"${ready.title}" ya está listo para leer.`);
      setBooks((current) =>
        current.map((book) => {
          const update = updates.find((item) => item?.id === book.id);
          return update ? { ...book, ...update } : book;
        }),
      );
    }, 2600);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [books]);

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return books.filter((book) => {
      if (term && !`${book.title} ${book.author ?? ""}`.toLowerCase().includes(term)) {
        return false;
      }
      if (courseFilter && book.course_id !== courseFilter) return false;
      if (filter !== "all" && bookStatus(book) !== filter) return false;
      return true;
    });
  }, [books, search, courseFilter, filter]);

  const continueBook = useMemo(
    () =>
      books
        .filter((book) => book.status === "ready" && bookStatus(book) === "reading")
        .sort((a, b) => {
          const aTime = a.last_opened_at ? Date.parse(a.last_opened_at) : 0;
          const bTime = b.last_opened_at ? Date.parse(b.last_opened_at) : 0;
          return bTime - aTime;
        })[0] ?? null,
    [books],
  );

  const readingCount = books.filter((book) => bookStatus(book) === "reading").length;
  const readyBooks = books.filter((book) => book.status === "ready");
  const totalMinutes = readyBooks.reduce((total, book) => total + book.estimated_minutes, 0);

  function chooseFile(selected: File | null) {
    setFile(selected);
    setUploadError(null);
    setProgress(null);
    if (selected) {
      const stem = selected.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      setUploadTitle(stem);
      if (selected.size > MAX_BOOK_MB * 1024 * 1024) {
        setUploadError(
          `El archivo pesa ${formatBytes(selected.size)}. Para la biblioteca el máximo es ${MAX_BOOK_MB} MB.`,
        );
      }
    }
  }

  async function startUpload() {
    if (!file) {
      setUploadError("Elige un archivo primero.");
      return;
    }
    if (file.size > MAX_BOOK_MB * 1024 * 1024) {
      setUploadError(`El máximo para un libro es ${MAX_BOOK_MB} MB.`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    setProgress({ uploadedBytes: 0, totalBytes: file.size, percent: 0 });
    try {
      const document = await uploadFileInChunks(file, {
        courseId: uploadCourse || null,
        onProgress: setProgress,
      });
      const book = await api.importBook({
        document_id: document.id,
        title: uploadTitle.trim() || null,
        course_id: uploadCourse || null,
      });
      setBooks((current) => [book, ...current.filter((item) => item.id !== book.id)]);
      setUploadOpen(false);
      setFile(null);
      setUploadTitle("");
      setUploadCourse("");
      setProgress(null);
      setNotice(
        "Libro recibido. Estamos preparándolo; aparecerá listo en unos segundos. " +
          "El archivo original también queda en Archivos.",
      );
    } catch (error) {
      setUploadError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function clearBookLocalCache(bookId: string) {
    const base = `/api/v1/books/${bookId}`;
    await Promise.all([
      deleteCachedApiResponse("/api/v1/books"),
      deleteCachedApiResponse(base),
      deleteCachedApiResponse(`${base}/messages`),
      deleteCachedApiResponse(`${base}/summary`),
      deleteCachedApiResponsesByPrefix(`${base}/sections/`),
    ]);
  }

  async function confirmRemoveBook() {
    const book = pendingDelete;
    if (!book || deleting) return;

    const index = books.findIndex((item) => item.id === book.id);
    setDeleting(true);
    // Quitar la tarjeta al instante mantiene la vista fluida; si el servidor
    // falla, se restaura en la misma posición.
    setBooks((current) => current.filter((item) => item.id !== book.id));
    setNotice(`Eliminando “${book.title}” de tu biblioteca…`);

    try {
      await api.deleteBook(book.id);
      await clearBookLocalCache(book.id);
      setPendingDelete(null);
      setNotice(
        `“${book.title}” se ha eliminado de tu biblioteca. El archivo original sigue en Archivos.`,
      );
    } catch (error) {
      setBooks((current) => {
        if (current.some((item) => item.id === book.id)) return current;
        const restored = [...current];
        restored.splice(Math.max(0, Math.min(index, restored.length)), 0, book);
        return restored;
      });
      setPendingDelete(null);
      setNotice(`No se pudo eliminar “${book.title}”: ${errorMessage(error)}`);
    } finally {
      setDeleting(false);
    }
  }

  async function retry(book: Book) {
    try {
      const updated = await api.reprocessBook(book.id);
      setBooks((current) => current.map((item) => (item.id === book.id ? updated : item)));
      setNotice("Reintentando la extracción del libro.");
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-4 pb-16 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            <BookOpen className="h-3.5 w-3.5" /> Biblioteca
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Tus libros, en un solo lugar</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Sube libros completos, continúa donde lo dejaste, pregunta con citas y escucha un
            resumen. La idea es simple: que volver a estudiar no empiece por buscar el archivo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/files">
            <Button variant="secondary">
              <Upload className="h-4 w-4" /> Ver archivos
            </Button>
          </Link>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" /> Subir libro
          </Button>
        </div>
      </header>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800">
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
          </p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-lg p-1 text-indigo-500 hover:bg-indigo-100"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Abriendo tu biblioteca...
        </div>
      ) : books.length === 0 ? (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-dashed border-indigo-200 bg-gradient-to-br from-slate-100/80 via-indigo-50/40 to-violet-50/60 p-8 sm:p-12 dark:border-indigo-900/60 dark:from-[#0b0f18] dark:via-[#0b0f18]/70 dark:to-[#0b0f18]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100/80 text-indigo-600 shadow-md shadow-indigo-500/10">
              <BookOpen className="h-7 w-7" />
            </span>
            <h2 className="mt-5 text-2xl font-bold">Tu primera biblioteca empieza con un libro</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              Sube un PDF, EPUB, DOCX, TXT o Markdown. Extraemos el texto completo por capítulos,
              lo guardamos en tu cuenta y recordamos tu progreso. Los PDFs escaneados se abren en
              un visor de imagen para que puedas leerlos igualmente.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4" /> Subir mi primer libro
              </Button>
              <Link href="/files">
                <Button variant="secondary">Elegir un archivo ya subido</Button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">
              Formatos: PDF, EPUB, DOCX, TXT y Markdown · hasta {MAX_BOOK_MB} MB.
            </p>
          </div>
          <div className="space-y-3">
            {[
              {
                icon: BookOpen,
                title: "1. Todo empieza en tu fuente",
                text: "El libro completo queda dentro de la app. Sin enlaces rotos ni carpetas perdidas.",
              },
              {
                icon: Sparkles,
                title: "2. Pregunta sin salir del texto",
                text: "Cada respuesta incluye citas de la sección exacta. Si no hay IA conectada, se extrae literalmente.",
              },
              {
                icon: Headphones,
                title: "3. Escucha y vuelve",
                text: "Resumen en voz alta con la voz de tu navegador y progreso guardado para el próximo día.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex gap-3 rounded-2xl border border-slate-300/40 bg-slate-100/70 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-3xl"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-300/40 bg-slate-100/70 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-3xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Libros</p>
              <p className="mt-1 text-2xl font-bold">{books.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-300/40 bg-slate-100/70 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-3xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Leyendo</p>
              <p className="mt-1 text-2xl font-bold">{readingCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-300/40 bg-slate-100/70 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-3xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Páginas de texto</p>
              <p className="mt-1 text-2xl font-bold">{readyBooks.reduce((sum, book) => sum + book.total_sections, 0)}</p>
            </div>
            <div className="rounded-2xl border border-slate-300/40 bg-slate-100/70 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-3xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tiempo estimado</p>
              <p className="mt-1 text-2xl font-bold">
                {Math.floor(totalMinutes / 60)} h {totalMinutes % 60} min
              </p>
            </div>
          </section>

          {continueBook && (
            <section className="overflow-hidden rounded-xl border border-border bg-foreground p-5 text-background sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div
                  className="flex h-24 w-20 shrink-0 flex-col justify-between rounded-xl bg-white/15 p-3 shadow-inner ring-1 ring-white/25"
                  style={{ background: "linear-gradient(160deg, rgba(255,255,255,.28), rgba(255,255,255,.08))" }}
                >
                  <BookOpen className="h-5 w-5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                    {FORMAT_LABEL[continueBook.format] || continueBook.format}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                    Continuar leyendo
                  </p>
                  <h2 className="mt-1 truncate text-xl font-bold sm:text-2xl">{continueBook.title}</h2>
                  <p className="mt-1 text-sm text-white/80">
                    {continueBook.current_section_title || `Sección ${continueBook.current_section_index + 1}`}
                    {" · "}
                    {Math.round(continueBook.progress_percent)}% leído
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white keep-white transition-all"
                      style={{ width: `${Math.max(2, continueBook.progress_percent)}%` }}
                    />
                  </div>
                </div>
                <Link href={`/library/${continueBook.id}`} className="shrink-0">
                  <Button className="bg-white keep-white text-indigo-700 hover:bg-indigo-50">
                    Seguir leyendo <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </section>
          )}

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {[
                ["all", "Todos"],
                ["reading", "Leyendo"],
                ["new", "Sin empezar"],
                ["done", "Terminados"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value as typeof filter)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    filter === value
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100/80 text-slate-600 ring-1 ring-slate-300/40 hover:bg-slate-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por título o autor"
                  className="w-full rounded-xl border border-slate-300/40 bg-slate-100/70 py-2 pl-9 pr-3 text-sm outline-none backdrop-blur-xl focus:border-indigo-400"
                />
              </label>
              {courses.length > 0 && (
                <select
                  value={courseFilter}
                  onChange={(event) => setCourseFilter(event.target.value)}
                  className="rounded-xl border border-slate-300/40 bg-slate-100/70 px-3 py-2 text-sm outline-none backdrop-blur-xl focus:border-indigo-400"
                >
                  <option value="">Todas las asignaturas</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300/50 bg-slate-100/55 p-10 text-center backdrop-blur-3xl">
              <Search className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold">No hay libros con ese filtro</p>
              <p className="mt-1 text-xs text-muted-foreground">Prueba otra búsqueda o asignatura.</p>
            </div>
          ) : (
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((book) => {
                const course = book.course_id ? courseMap.get(book.course_id) : null;
                const status = bookStatus(book);
                const scanned = isScannedPdf(book);
                return (
                  <Card
                    key={book.id}
                    className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="relative flex h-36 items-end overflow-hidden p-4 text-white">
                      <div
                        className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                        style={{
                          background: `linear-gradient(135deg, ${book.cover_color}, ${book.cover_color}bb 55%, #0f172a)`,
                        }}
                      />
                      <div className="absolute -right-6 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                      <button
                        type="button"
                        onClick={() => setPendingDelete(book)}
                        aria-label={`Eliminar ${book.title} de la biblioteca`}
                        title="Eliminar de la biblioteca"
                        className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-slate-950/25 text-white/85 shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-rose-300/70 hover:bg-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="relative flex w-full items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                            {FORMAT_LABEL[book.format] || book.format}
                            {scanned ? " · Escaneado" : ""}
                            {course ? ` · ${course.name}` : ""}
                          </p>
                          <h3 className="mt-1 line-clamp-2 text-xl font-bold leading-tight">
                            {book.title}
                          </h3>
                          {book.author && (
                            <p className="mt-1 truncate text-xs text-white/75">{book.author}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {scanned && (
                            <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-white/85 backdrop-blur-md">
                              Modo imagen
                            </span>
                          )}
                          <span className="flex h-12 w-10 items-center justify-center rounded-lg border border-white/25 bg-white/10">
                            <BookOpen className="h-5 w-5" />
                          </span>
                        </div>
                      </div>
                    </div>

                    <CardContent className="space-y-3 p-4">
                      {book.status === "processing" ? (
                        <div className="space-y-2">
                          <p className="flex items-center gap-2 text-sm font-medium text-indigo-700">
                            <Loader2 className="h-4 w-4 animate-spin" /> Preparando texto completo...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Extrayendo capítulos de {book.source_filename}. Suele tardar unos segundos.
                          </p>
                        </div>
                      ) : book.status === "error" ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-rose-700">No se pudo extraer el texto</p>
                          <p className="line-clamp-3 text-xs text-muted-foreground">
                            {book.error_message || "El archivo no contiene texto legible."}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {book.format === "pdf" && book.document_id && (
                              <Link href={`/library/${book.id}`}>
                                <Button size="sm">
                                  <BookOpen className="h-3.5 w-3.5" /> Abrir PDF
                                </Button>
                              </Link>
                            )}
                            <Button size="sm" variant="secondary" onClick={() => void retry(book)}>
                              <RefreshCcw className="h-3.5 w-3.5" /> Reintentar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              {scanned ? (
                                <>
                                  <BookOpen className="h-3.5 w-3.5" />
                                  Visor de imagen
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3.5 w-3.5" />
                                  {book.estimated_minutes} min
                                </>
                              )}
                            </span>
                            <span className="text-muted-foreground">{formatRelative(book.last_opened_at)}</span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="truncate">
                                {status === "done"
                                  ? "Terminado"
                                  : book.current_section_title || `${book.total_sections} secciones`}
                              </span>
                              <span>{Math.round(book.progress_percent)}%</span>
                            </div>
                            <Progress value={book.progress_percent} className="mt-1.5 h-1.5" />
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link href={`/library/${book.id}`} className="flex-1">
                              <Button size="sm" className="w-full">
                                {scanned
                                  ? "Abrir PDF"
                                  : status === "new"
                                    ? "Empezar a leer"
                                    : status === "done"
                                      ? "Repasar"
                                      : "Continuar"}
                                {scanned ? (
                                  <BookOpen className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowRight className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </Link>
                            <AddToNotebookButton bookId={book.id} label="" size="icon" />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}

          <section className="rounded-3xl border border-slate-300/40 bg-slate-100/70 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-3xl sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold">Lo que hace diferente a esta biblioteca</h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                  No guarda solo el archivo: guarda el <strong>texto completo por secciones</strong>,
                  tu posición, el historial de preguntas y las citas. Así puedes cerrar la app y
                  volver semanas después sin empezar de cero. Si conectas un modelo de IA, las
                  respuestas se redactan; si no, se extraen literalmente y se avisa. Nunca se
                  inventa contenido.
                </p>
              </div>
              <Badge variant="success" className="sm:ml-auto">
                <Check className="mr-1 h-3 w-3" /> Sin datos de ejemplo
              </Badge>
            </div>
          </section>
        </>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-book-title"
            aria-describedby="delete-book-description"
            className="animate-pop w-full max-w-md rounded-3xl border border-slate-300/40 bg-slate-100/85 p-5 shadow-[0_28px_80px_-36px_rgba(32,39,48,0.45)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/90"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/15 dark:text-rose-300">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">
                  Biblioteca
                </p>
                <h2
                  id="delete-book-title"
                  className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 dark:text-white/95"
                >
                  ¿Eliminar de tu biblioteca?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p
              id="delete-book-description"
              className="mt-3 text-[12.5px] leading-5 text-slate-600 dark:text-white/55"
            >
              ¿Seguro que deseas eliminar este libro/PDF de tu biblioteca?
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-300/40 bg-white/40 p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <span
                className="flex h-14 w-10 shrink-0 items-end justify-start rounded-lg p-1.5 text-white shadow-sm"
                style={{
                  background: `linear-gradient(145deg, ${pendingDelete.cover_color}, #0f172a)`,
                }}
              >
                <BookOpen className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[12.5px] font-semibold text-slate-800 dark:text-white/85">
                  {pendingDelete.title}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                  {FORMAT_LABEL[pendingDelete.format] || pendingDelete.format}
                  {" · "}
                  {pendingDelete.course_id
                    ? courseMap.get(pendingDelete.course_id)?.name ?? "Sin asignatura"
                    : "Sin asignatura"}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[10.5px] leading-4 text-slate-400 dark:text-white/30">
              Se borrarán el texto por secciones, tus preguntas y el progreso guardado. El archivo
              original seguirá en Archivos.
            </p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                autoFocus
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void confirmRemoveBook()}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting ? "Eliminando…" : "Eliminar libro"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => !uploading && setUploadOpen(false)}
        >
          <div
            className="animate-pop w-full max-w-lg rounded-3xl border border-slate-300/40 bg-slate-100/85 p-6 shadow-[0_28px_80px_-36px_rgba(32,39,48,0.45)] backdrop-blur-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <BookOpen className="h-5 w-5 text-indigo-600" /> Subir un libro completo
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se guarda por secciones y se abre en el lector. También quedará en Archivos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !uploading && setUploadOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "mt-5 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
                file
                  ? "border-indigo-300 bg-indigo-50/50"
                  : "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/30",
              )}
            >
              <Upload className="h-7 w-7 text-indigo-500" />
              <span className="mt-2 text-sm font-semibold">
                {file ? file.name : "Elegir PDF, EPUB, DOCX, TXT o Markdown"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {file ? formatBytes(file.size) : `Hasta ${MAX_BOOK_MB} MB. El texto completo queda guardado.`}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Título (opcional)</span>
                <input
                  value={uploadTitle}
                  onChange={(event) => setUploadTitle(event.target.value)}
                  placeholder="El título del libro"
                  disabled={uploading}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Asignatura (opcional)</span>
                <select
                  value={uploadCourse}
                  onChange={(event) => setUploadCourse(event.target.value)}
                  disabled={uploading}
                  className="mt-1 w-full rounded-xl border border-slate-300/40 bg-slate-100/70 px-3 py-2 text-sm outline-none backdrop-blur-xl focus:border-indigo-400"
                >
                  <option value="">Sin asignatura</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {progress && uploading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subiendo archivo...</span>
                  <span>{Math.round(progress.percent)}%</span>
                </div>
                <Progress value={progress.percent} className="mt-1.5" />
              </div>
            )}

            {uploadError && (
              <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{uploadError}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button onClick={() => void startUpload()} disabled={uploading || !file}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Preparando..." : "Subir y preparar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
