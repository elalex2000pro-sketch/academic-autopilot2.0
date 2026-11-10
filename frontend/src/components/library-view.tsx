"use client";

import { pageItem, pageStagger } from "@/components/page-animated-wrapper";
import { usePreferences } from "@/components/preferences-provider";

import Image from "next/image";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  FolderInput,
  HardDrive,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  LIBRARY_CATEGORIES,
  categoryLabel,
  normalizeCategory,
  type LibraryCategoryId,
} from "@/lib/library-categories";
import {
  deleteBook,
  formatBytes,
  importPdf,
  listBooks,
  progressPercent,
  updateBookCategory,
  type ImportStage,
  type LocalBook,
} from "@/lib/local-library";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "No se pudo importar el PDF.";
}

function stageLabel(stage: ImportStage): string {
  if (stage === "reading") return "Leyendo el PDF";
  if (stage === "cover") return "Generando la portada";
  return "Guardando en IndexedDB";
}

type LibraryFilter = "all" | "reading" | "not-started";

const FILTERS: Array<{ value: LibraryFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "reading", label: "En curso" },
  { value: "not-started", label: "Sin empezar" },
];

const BookCover = memo(function BookCover({
  book,
  className,
  sizes,
}: {
  book: LocalBook;
  className?: string;
  sizes: string;
}) {
  if (!book.cover) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-950 text-white",
          className,
        )}
      >
        <BookOpen className="h-8 w-8 opacity-60" />
      </div>
    );
  }
  return (
    <Image
      src={book.cover}
      alt={`Portada de ${book.title}`}
      fill
      unoptimized
      sizes={sizes}
      className={cn("object-cover", className)}
    />
  );
});

export default function LibraryView() {
  const [books, setBooks] = useState<LocalBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importLabel, setImportLabel] = useState("");
  const [pendingDelete, setPendingDelete] = useState<LocalBook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  // Sección activa ("all" = todos) y sección de destino al importar.
  const [category, setCategory] = useState<"all" | LibraryCategoryId>("all");
  const [importCategory, setImportCategory] = useState<LibraryCategoryId>("apuntes");
  const [menu, setMenu] = useState<{ book: LocalBook; x: number; y: number } | null>(null);
  const { animationLevel } = usePreferences();
  const reduceMotion = animationLevel === "reduced";
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const localBooks = await listBooks();
      setBooks(localBooks);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setPendingDelete(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [pendingDelete, deleting]);

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0 || importing) return;
    setImporting(true);
    setError(null);
    const failures: string[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      try {
        await importPdf(
          file,
          (stage) => {
            setImportLabel(
              `${stageLabel(stage)}: ${file.name} (${index + 1}/${files.length})`,
            );
          },
          importCategory,
        );
      } catch (caught) {
        failures.push(`${file.name}: ${errorMessage(caught)}`);
      }
    }

    await load();
    setImporting(false);
    setImportLabel("");
    if (failures.length > 0) setError(failures.join(" "));
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteBook(pendingDelete.id);
      setBooks((current) => current.filter((book) => book.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  const openMenu = useCallback((book: LocalBook, point?: { x: number; y: number }) => {
    const width = 210;
    const height = 230;
    const x = point?.x ?? window.innerWidth / 2 - width / 2;
    const y = point?.y ?? window.innerHeight / 2 - height / 2;
    setMenu({
      book,
      x: Math.max(12, Math.min(x, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(y, window.innerHeight - height - 12)),
    });
  }, []);

  const moveBook = useCallback(async (book: LocalBook, next: LibraryCategoryId) => {
    setMenu(null);
    if (book.category === next) return;
    try {
      const updated = await updateBookCategory(book.id, next);
      if (!updated) return;
      setBooks((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  // El menú se cierra con Escape, al hacer scroll o al cambiar el tamaño.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const continueBook = useMemo(
    () => books.find((book) => book.lastPage > 1) ?? books[0] ?? null,
    [books],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const book of books) {
      counts.set(book.category, (counts.get(book.category) ?? 0) + 1);
    }
    return counts;
  }, [books]);

  const visibleBooks = useMemo(
    () =>
      books.filter((book) => {
        if (category !== "all" && book.category !== category) return false;
        if (filter === "reading") return book.lastPage > 1;
        if (filter === "not-started") return book.lastPage <= 1;
        return true;
      }),
    [books, category, filter],
  );

  return (
    <motion.div variants={pageStagger} className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <motion.header variants={pageItem} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            <HardDrive className="h-3.5 w-3.5" /> Solo en este dispositivo
          </p>
          <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.055em] text-[#1d1d1f] dark:text-white sm:text-[38px]">
            Biblioteca
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-black/45 dark:text-white/50">
            Tus PDFs se guardan en IndexedDB. Nada se envía a la nube y puedes
            leerlos sin conexión.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {/* El PDF entra directamente en la sección elegida; luego se puede
              cambiar con el botón o el clic derecho de cada tarjeta. */}
          <label className="flex h-11 items-center gap-2 rounded-full border border-white/45 bg-white/45 px-3 text-[11px] font-semibold text-black/50 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
            <span className="whitespace-nowrap">Guardar en</span>
            <select
              value={importCategory}
              onChange={(event) => setImportCategory(normalizeCategory(event.target.value))}
              aria-label="Sección para los nuevos PDFs"
              className="max-w-[124px] cursor-pointer truncate bg-transparent text-[11.5px] font-semibold text-[#1d1d1f] outline-none dark:text-white/85"
            >
              {LIBRARY_CATEGORIES.map((option) => (
                <option key={option.id} value={option.id} className="text-black">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={importing}
            className="inline-flex h-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-full bg-[#1b1b1f] px-4 text-[12px] font-semibold text-white shadow-[0_12px_28px_-15px_rgba(20,20,28,0.75)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {importing ? "Importando…" : "Añadir PDFs"}
          </button>
        </div>
      </motion.header>

      {error && (
        <motion.div variants={pageItem}
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Cerrar aviso"
            className="rounded-lg p-1 hover:bg-rose-100 dark:hover:bg-rose-500/15"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {loading ? (
        <motion.div variants={pageItem} className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Leyendo tu biblioteca local…
        </motion.div>
      ) : books.length === 0 ? (
        <section className="glass-card mt-8 overflow-hidden rounded-[28px] border-dashed p-8 text-center sm:p-14">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-black/[0.045] text-black/45 dark:bg-white/[0.06] dark:text-white/55">
            <BookOpen className="h-9 w-9" />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.035em] text-[#1d1d1f] dark:text-white">
            Tu biblioteca empieza aquí
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-6 text-black/45 dark:text-white/50">
            Añade uno o varios PDFs. Generaremos la portada de la primera página
            y guardaremos el progreso, las marcas y las notas en este navegador.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 inline-flex h-11 touch-manipulation items-center gap-2 rounded-full bg-[#1b1b1f] px-5 text-[12px] font-semibold text-white transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> Añadir PDFs
          </button>
        </section>
      ) : (
        <>
          {continueBook && (
            <section className="glass-card relative mt-7 overflow-hidden rounded-[30px] p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#c8bdf2]/35 blur-3xl" />
              <div className="relative flex items-center gap-5">
                <Link
                  href={`/library/${continueBook.id}`}
                  className="relative hidden aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-[16px] border border-black/10 bg-slate-200 shadow-[0_18px_34px_-24px_rgba(20,20,28,0.55)] sm:block dark:border-white/10 dark:bg-slate-800"
                >
                  <BookCover book={continueBook} sizes="96px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-black/40 dark:text-white/35">
                    Continuar leyendo
                  </p>
                  <h2 className="mt-1 line-clamp-2 text-xl font-semibold tracking-[-0.045em] text-[#1d1d1f] dark:text-white sm:text-2xl">
                    {continueBook.title}
                  </h2>
                  <p className="mt-1 truncate text-[11.5px] text-black/45 dark:text-white/55">
                    {continueBook.author} · {continueBook.pages} páginas
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/15">
                      <div
                        className="h-full rounded-full bg-[#1b1b1f] transition-[width] dark:bg-white"
                        style={{ width: `${progressPercent(continueBook)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-black/45 dark:text-white/65">
                      {progressPercent(continueBook)}%
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/library/${continueBook.id}`}
                      className="inline-flex h-11 touch-manipulation items-center gap-1.5 rounded-full bg-[#1b1b1f] px-4 text-[11.5px] font-semibold text-white transition hover:-translate-y-0.5"
                    >
                      {continueBook.lastPage > 1 ? "Continuar" : "Empezar a leer"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <span className="text-[11px] text-black/40 dark:text-white/45">
                      {continueBook.lastPage > 1
                        ? `Página ${continueBook.lastPage} de ${continueBook.pages}`
                        : "Aún sin empezar"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.035em] text-[#1d1d1f] dark:text-white">
                  {category === "all" ? "Todos los libros" : categoryLabel(category)}
                </h2>
                <p className="mt-0.5 text-[11.5px] text-black/40 dark:text-white/40">
                  {visibleBooks.length} de {books.length} {books.length === 1 ? "PDF" : "PDFs"} en este dispositivo
                </p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-11 touch-manipulation items-center rounded-full border border-black/[0.06] bg-white/55 px-3.5 text-[11.5px] font-semibold text-black/60 transition-colors hover:bg-white/85 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/10"
              >
                Importar más
              </button>
            </div>

            <div
              role="tablist"
              aria-label="Secciones de la biblioteca"
              className="mb-3 mt-4 flex gap-1 overflow-x-auto rounded-2xl border border-white/45 bg-white/40 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]"
            >
              {[
                { id: "all" as const, label: "Todos", count: books.length },
                ...LIBRARY_CATEGORIES.map((option) => ({
                  id: option.id,
                  label: option.label,
                  count: categoryCounts.get(option.id) ?? 0,
                })),
              ].map((tab) => {
                const active = category === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(tab.id)}
                    className={cn(
                      "relative flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-semibold transition-colors",
                      active
                        ? "bg-white/85 text-[#1d1d1f] shadow-[0_6px_16px_-12px_rgba(20,20,28,0.65)] dark:bg-white/15 dark:text-white"
                        : "text-black/45 hover:bg-white/55 dark:text-white/45 dark:hover:bg-white/[0.07]",
                    )}
                  >
                    {tab.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[9.5px] font-semibold",
                        active
                          ? "bg-black/[0.07] text-black/55 dark:bg-white/20 dark:text-white/80"
                          : "bg-black/[0.05] text-black/35 dark:bg-white/10 dark:text-white/40",
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {FILTERS.map((option) => {
                const active = filter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex h-11 touch-manipulation items-center rounded-full px-3 text-[11px] font-semibold transition-colors",
                      active
                        ? "bg-[#1b1b1f] text-white shadow-[0_7px_16px_-10px_rgba(20,20,28,0.7)]"
                        : "border border-black/[0.06] bg-white/50 text-black/45 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/45 dark:hover:bg-white/10",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <motion.div
              layout
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              <AnimatePresence mode="popLayout" initial={false}>
              {visibleBooks.map((book) => {
                const percent = progressPercent(book);
                return (
                  <motion.article
                    key={book.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -8 }}
                    whileHover={reduceMotion ? undefined : { y: -5 }}
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openMenu(book, { x: event.clientX, y: event.clientY });
                    }}
                    className="glass-card group min-w-0 rounded-[24px] p-3"
                  >
                    <Link
                      href={`/library/${book.id}`}
                      className="relative block aspect-[3/4] overflow-hidden rounded-[18px] border border-white/60 bg-slate-200 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.55)] transition-shadow duration-300 group-hover:shadow-[0_24px_42px_-26px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-slate-800"
                    >
                      <BookCover book={book} sizes="(max-width: 640px) 92vw, (max-width: 1024px) 44vw, 280px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent opacity-80" />
                      <span className="absolute bottom-2.5 left-2.5 rounded-full border border-white/20 bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-md">
                        {percent}% leído
                      </span>
                      <span className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur-md">
                        PDF
                      </span>
                    </Link>
                    <div className="mt-2.5 flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/library/${book.id}`}
                          className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-[#1d1d1f] hover:text-black dark:text-white/90 dark:hover:text-white"
                        >
                          {book.title}
                        </Link>
                        <p className="mt-0.5 truncate text-[10.5px] text-black/45 dark:text-white/40">
                          {book.author}
                        </p>
                        <p className="mt-0.5 text-[10px] text-black/35 dark:text-white/30">
                          {book.pages} páginas · {formatBytes(book.size)}
                        </p>
                        <p className="mt-1 inline-flex items-center rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[9.5px] font-semibold text-black/45 dark:bg-white/[0.07] dark:text-white/45">
                          {categoryLabel(book.category)}
                        </p>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-[#1b1b1f] dark:bg-white"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          openMenu(book, { x: rect.right - 210, y: rect.bottom + 6 });
                        }}
                        aria-label={`Mover ${book.title} a otra sección`}
                        title="Mover a otra sección"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 opacity-100 transition hover:bg-black/[0.05] hover:text-black/60 dark:text-white/25 dark:hover:bg-white/10 dark:hover:text-white/70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <FolderInput className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(book)}
                        aria-label={`Eliminar ${book.title}`}
                        title="Eliminar PDF y datos locales"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 opacity-100 transition hover:bg-rose-50 hover:text-rose-500 dark:text-white/25 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.article>
                );
              })}
              </AnimatePresence>
              {visibleBooks.length === 0 ? (
                <motion.p
                  key="library-empty"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="col-span-full rounded-2xl border border-dashed border-black/[0.08] px-4 py-8 text-center text-[12px] text-black/40 dark:border-white/10 dark:text-white/35"
                >
                  {category === "all"
                    ? "No hay libros en este filtro."
                    : `Aún no hay PDFs en ${categoryLabel(category)}.`}
                </motion.p>
              ) : null}
            </motion.div>
          </section>
        </>
      )}

      {importing && (
        <motion.div variants={pageItem}
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(var(--mobile-nav-offset,0px)+1rem)] right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-white/50 bg-white/85 px-4 py-3 text-xs shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90 dark:text-white/80 lg:bottom-5"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />
          <span className="min-w-0 truncate">{importLabel || "Preparando importación…"}</span>
        </motion.div>
      )}

      {menu ? (
        <div
          className="fixed inset-0 z-[86]"
          onClick={() => setMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu(null);
          }}
        >
          <div
            role="menu"
            aria-label={`Mover ${menu.book.title} de sección`}
            style={{ left: menu.x, top: menu.y }}
            className="fixed w-[210px] rounded-2xl border border-white/50 bg-white/90 p-1.5 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.5)] backdrop-blur-3xl dark:border-white/10 dark:bg-slate-950/92"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/35">
              Mover a
            </p>
            {LIBRARY_CATEGORIES.map((option) => {
              const current = menu.book.category === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  disabled={current}
                  onClick={() => void moveBook(menu.book, option.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-[12px] font-medium transition-colors",
                    current
                      ? "text-black/35 dark:text-white/30"
                      : "text-slate-700 hover:bg-black/[0.05] dark:text-white/75 dark:hover:bg-white/10",
                  )}
                >
                  {option.label}
                  {current ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {pendingDelete && (
        <motion.div variants={pageItem}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-local-book-title"
            className="w-full max-w-md rounded-3xl border border-white/50 bg-white/90 p-5 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-950/95"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-500 dark:text-rose-300">
                  Biblioteca local
                </p>
                <h2
                  id="delete-local-book-title"
                  className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white"
                >
                  ¿Eliminar este PDF?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                aria-label="Cerrar"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-5 text-slate-600 dark:text-white/55">
              Se borrarán el archivo, la portada, las marcas y las notas de{" "}
              <strong className="text-slate-800 dark:text-white/80">
                {pendingDelete.title}
              </strong>{" "}
              de este dispositivo.
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <span className="relative flex h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
                <BookCover book={pendingDelete} sizes="40px" />
              </span>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[12.5px] font-semibold text-slate-800 dark:text-white/85">
                  {pendingDelete.title}
                </p>
                <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/35">
                  {pendingDelete.pages} páginas · {formatBytes(pendingDelete.size)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="h-9 rounded-xl px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Eliminar PDF
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
