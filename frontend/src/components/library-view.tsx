"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  HardDrive,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  deleteBook,
  formatBytes,
  importPdf,
  listBooks,
  progressPercent,
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

function BookCover({
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
}

export default function LibraryView() {
  const [books, setBooks] = useState<LocalBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importLabel, setImportLabel] = useState("");
  const [pendingDelete, setPendingDelete] = useState<LocalBook | null>(null);
  const [deleting, setDeleting] = useState(false);
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
        await importPdf(file, (stage) => {
          setImportLabel(
            `${stageLabel(stage)}: ${file.name} (${index + 1}/${files.length})`,
          );
        });
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

  const continueBook =
    books.find((book) => book.lastPage > 1) ?? books[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
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

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            <HardDrive className="h-3.5 w-3.5" /> Solo en este dispositivo
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white">
            Biblioteca
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-white/50">
            Tus PDFs se guardan en IndexedDB. Nada se envía a la nube y puedes
            leerlos sin conexión.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_14px_30px_-16px_rgba(79,70,229,0.9)] transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {importing ? "Importando…" : "Añadir PDFs"}
        </button>
      </header>

      {error && (
        <div
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
        </div>
      )}

      {loading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Leyendo tu biblioteca local…
        </div>
      ) : books.length === 0 ? (
        <section className="mt-8 overflow-hidden rounded-3xl border border-dashed border-slate-300/70 bg-white/50 p-8 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] sm:p-14">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300">
            <BookOpen className="h-9 w-9" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
            Tu biblioteca empieza aquí
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-white/50">
            Añade uno o varios PDFs. Generaremos la portada de la primera página
            y guardaremos el progreso, las marcas y las notas en este navegador.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Añadir PDFs
          </button>
        </section>
      ) : (
        <>
          {continueBook && (
            <section className="relative mt-7 overflow-hidden rounded-3xl bg-[#151b2b] p-5 text-white shadow-[0_28px_70px_-38px_rgba(15,23,42,0.9)] sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
              <div className="relative flex items-center gap-5">
                <Link
                  href={`/library/${continueBook.id}`}
                  className="relative hidden aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-slate-800 shadow-2xl sm:block"
                >
                  <BookCover book={continueBook} sizes="96px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-200/80">
                    Continuar leyendo
                  </p>
                  <h2 className="mt-1 line-clamp-2 text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                    {continueBook.title}
                  </h2>
                  <p className="mt-1 truncate text-xs text-white/55">
                    {continueBook.author} · {continueBook.pages} páginas
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-[width]"
                        style={{ width: `${progressPercent(continueBook)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-white/65">
                      {progressPercent(continueBook)}%
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/library/${continueBook.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-900 transition hover:bg-indigo-50"
                    >
                      {continueBook.lastPage > 1 ? "Continuar" : "Empezar a leer"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <span className="text-[11px] text-white/45">
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
                <h2 className="text-lg font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                  Todos los libros
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-white/40">
                  {books.length} {books.length === 1 ? "PDF" : "PDFs"} en este dispositivo
                </p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
              >
                Importar más
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {books.map((book) => {
                const percent = progressPercent(book);
                return (
                  <article key={book.id} className="group min-w-0">
                    <Link
                      href={`/library/${book.id}`}
                      className="relative block aspect-[3/4] overflow-hidden rounded-2xl border border-slate-300/50 bg-slate-200 shadow-[0_18px_35px_-24px_rgba(15,23,42,0.7)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_45px_-24px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-slate-800"
                    >
                      <BookCover book={book} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px" />
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
                          className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900 hover:text-indigo-600 dark:text-white/90 dark:hover:text-indigo-300"
                        >
                          {book.title}
                        </Link>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-white/40">
                          {book.author}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/30">
                          {book.pages} páginas · {formatBytes(book.size)}
                        </p>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(book)}
                        aria-label={`Eliminar ${book.title}`}
                        title="Eliminar PDF y datos locales"
                        className="rounded-lg p-1 text-slate-300 opacity-100 transition hover:bg-rose-50 hover:text-rose-500 dark:text-white/25 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {importing && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(var(--mobile-nav-offset,0px)+1rem)] right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-white/50 bg-white/85 px-4 py-3 text-xs shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90 dark:text-white/80 lg:bottom-5"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />
          <span className="min-w-0 truncate">{importLabel || "Preparando importación…"}</span>
        </div>
      )}

      {pendingDelete && (
        <div
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
        </div>
      )}
    </div>
  );
}
