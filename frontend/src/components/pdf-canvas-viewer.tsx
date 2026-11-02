"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PdfCanvasViewerProps {
  documentId: string;
  initialPage?: number;
  onPageChange?: (page: number, total: number) => void;
  className?: string;
  title?: string;
}

/**
 * Visor de respaldo para PDFs escaneados. No depende de una capa de texto:
 * dibuja cada pagina en un canvas con pdf.js para que el archivo siga siendo
 * legible aunque el backend no pueda extraer texto seleccionable.
 */
export function PdfCanvasViewer({
  documentId,
  initialPage = 1,
  onPageChange,
  className,
  title,
}: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderGenerationRef = useRef(0);
  const firstPage = Number.isFinite(initialPage)
    ? Math.max(1, Math.trunc(initialPage))
    : 1;
  const [page, setPage] = useState(firstPage);
  const [total, setTotal] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [documentReady, setDocumentReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageDraft, setPageDraft] = useState(String(firstPage));
  const [sliderPage, setSliderPage] = useState(firstPage);
  const pageInputId = useId();

  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;

    async function load() {
      setLoading(true);
      setDocumentReady(false);
      setError(null);
      try {
        const blob = await api.fileBlob(documentId);
        const data = new Uint8Array(await blob.arrayBuffer());
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        pdfRef.current = doc;
        const nextTotal = doc.numPages;
        setTotal(nextTotal);
        const requestedPage = Number.isFinite(initialPage) ? Math.trunc(initialPage) : 1;
        const nextPage = Math.min(Math.max(requestedPage, 1), nextTotal);
        setPage(nextPage);
        setDocumentReady(true);
        onPageChange?.(nextPage, nextTotal);
      } catch {
        if (!cancelled) {
          setDocumentReady(false);
          setError("No se pudo abrir el PDF original. Inténtalo de nuevo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      pdfRef.current = null;
      if (doc) void doc.destroy();
    };
    // initialPage y onPageChange se usan solo al cargar el documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setContainerWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const renderPage = useCallback(async () => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!documentReady || !doc || !canvas || containerWidth <= 0) return;

    // Cada render tiene una generación. Si el contenedor o la página cambian
    // mientras pdf.js está preparando el canvas, el render antiguo se descarta
    // antes de tocar el canvas para que no pueda dejarlo en blanco.
    const generation = ++renderGenerationRef.current;
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    setRendering(true);
    try {
      const pdfPage = await doc.getPage(page);
      if (generation !== renderGenerationRef.current) return;

      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const available = Math.max(260, containerWidth - 28);
      const fitScale = available / baseViewport.width;
      const viewport = pdfPage.getViewport({ scale: fitScale * zoom });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const context = canvas.getContext("2d");
      if (!context || generation !== renderGenerationRef.current) return;

      canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
      canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const task = pdfPage.render({
        canvasContext: context,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      });
      if (generation !== renderGenerationRef.current) {
        task.cancel();
        return;
      }
      renderTaskRef.current = task;
      await task.promise;
    } catch (reason) {
      const name = reason instanceof Error ? reason.name : "";
      if (generation === renderGenerationRef.current && name !== "RenderingCancelledException") {
        setError("No se pudo dibujar esta página del PDF.");
      }
    } finally {
      if (generation === renderGenerationRef.current) {
        renderTaskRef.current = null;
        setRendering(false);
      }
    }
  }, [containerWidth, documentReady, page, zoom]);

  useEffect(() => {
    void renderPage();
    return () => {
      renderGenerationRef.current += 1;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [renderPage]);

  // El input numérico refleja siempre la página real, incluso si el salto se
  // hizo con la barra de progreso o con las flechas del teclado.
  useEffect(() => {
    setPageDraft(String(page));
    setSliderPage(page);
  }, [page]);

  const goTo = useCallback(
    (next: number) => {
      if (!total || !Number.isFinite(next)) return;
      const clamped = Math.min(Math.max(Math.trunc(next), 1), total);
      if (clamped === page) {
        setPageDraft(String(clamped));
        return;
      }

      // Solo se reinicia el scroll interno del visor. No usamos
      // `scrollIntoView` para no arrastrar la ventana principal de la app.
      const container = containerRef.current;
      if (container) {
        container.scrollTop = 0;
        container.scrollLeft = 0;
      }

      setPage(clamped);
      setPageDraft(String(clamped));
      onPageChange?.(clamped, total);
    },
    [onPageChange, page, total],
  );

  function submitPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number.parseInt(pageDraft, 10);
    if (!Number.isFinite(parsed)) {
      setPageDraft(String(page));
      return;
    }
    goTo(parsed);
    // Al soltar el foco, las flechas vuelven a pasar página en lugar de
    // mover el cursor dentro del campo.
    pageInputRef.current?.blur();
  }

  // Flechas izquierda/derecha para pasar página. Se ignoran cuando el foco
  // está en un campo de texto, al usar modificadores o si hay un diálogo
  // abierto, para no robar atajos a otras partes de la app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          target.isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT"
        ) {
          return;
        }
      }
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;

      // Solo responde cuando el visor está a la vista; así las flechas no
      // cambian de página si el usuario está leyendo otra parte de la app.
      const viewer = containerRef.current;
      if (!viewer) return;
      const rect = viewer.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;

      event.preventDefault();
      goTo(event.key === "ArrowLeft" ? page - 1 : page + 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, page]);

  const percent = total ? Math.round((sliderPage / total) * 100) : 0;

  return (
    <div
      className={cn("space-y-3", className)}
      aria-keyshortcuts="ArrowLeft ArrowRight"
    >
      <div
        role="group"
        aria-label="Controles del visor de PDF"
        className="space-y-2 rounded-2xl border border-white/40 bg-white/45 px-3 py-2 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/25"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500 dark:text-white/55">
            <span className="rounded-full bg-[#0066FF]/10 px-2.5 py-1 text-[11px] font-semibold text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#7eb2ff]">
              PDF original
            </span>
            <span className="truncate">{title || "Documento escaneado"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.15).toFixed(2))))}
              aria-label="Reducir zoom"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-[11px] tabular-nums text-slate-500 dark:text-white/55">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((value) => Math.min(2.4, Number((value + 0.15).toFixed(2))))}
              aria-label="Aumentar zoom"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" />
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => goTo(page - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className="min-w-16 text-center text-[11px] font-medium tabular-nums text-slate-600 dark:text-white/65"
              aria-live="polite"
              aria-atomic="true"
            >
              {total ? `${page} / ${total}` : "—"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!total || page >= total || loading}
              onClick={() => goTo(page + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/30 pt-2 dark:border-white/10">
          <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-white/50">
            {total ? sliderPage : page}
          </span>
          <input
            type="range"
            min={1}
            max={Math.max(total, 1)}
            step={1}
            value={total ? sliderPage : 1}
            disabled={!total || loading}
            onChange={(event) => setSliderPage(Number(event.target.value))}
            onPointerUp={(event) => goTo(Number(event.currentTarget.value))}
            onKeyUp={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(
                  event.key,
                )
              ) {
                goTo(Number(event.currentTarget.value));
              }
            }}
            onBlur={(event) => goTo(Number(event.currentTarget.value))}
            aria-label="Progreso de lectura"
            aria-valuetext={total ? `Página ${sliderPage} de ${total}` : "Cargando documento"}
            className="h-2 min-w-[120px] flex-1 cursor-pointer accent-[#0066FF] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-white/50">
            {total || "—"}
          </span>
          <span className="hidden text-[10px] tabular-nums text-slate-400 dark:text-white/40 sm:inline">
            {percent}%
          </span>
          <form className="flex items-center gap-1" onSubmit={submitPage}>
            <label htmlFor={pageInputId} className="sr-only">
              Número de página
            </label>
            <input
              ref={pageInputRef}
              id={pageInputId}
              type="number"
              min={1}
              max={total || undefined}
              step={1}
              inputMode="numeric"
              value={pageDraft}
              disabled={!total || loading}
              onChange={(event) => setPageDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => {
                const parsed = Number.parseInt(pageDraft, 10);
                if (!Number.isFinite(parsed)) setPageDraft(String(page));
              }}
              className="h-7 w-16 rounded-lg border border-white/50 bg-white/60 px-1 text-center text-[11px] font-medium tabular-nums text-slate-700 outline-none transition-colors focus:border-[#0066FF] disabled:opacity-50 dark:border-white/10 dark:bg-black/25 dark:text-white/80"
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={!total || loading}
              className="h-7 px-2 text-[11px]"
            >
              Ir
            </Button>
          </form>
          <span className="hidden text-[10px] text-slate-400 dark:text-white/35 lg:inline">
            ← → cambian de página
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[420px] max-h-[calc(100dvh-16rem)] overflow-auto overscroll-contain rounded-3xl border border-white/35 bg-slate-200/45 p-3 shadow-inner backdrop-blur-2xl dark:border-white/10 dark:bg-black/35"
      >
        {(loading || rendering) && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/30 backdrop-blur-[2px] dark:bg-black/20">
            <span className="flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-xs font-medium text-slate-600 shadow-lg dark:bg-black/55 dark:text-white/70">
              <Loader2 className="h-4 w-4 animate-spin text-[#0066FF]" />
              {loading ? "Abriendo PDF…" : "Dibujando página…"}
            </span>
          </div>
        )}
        {error ? (
          <div className="flex min-h-[380px] flex-col items-center justify-center gap-2 px-6 text-center">
            <Maximize2 className="h-7 w-7 text-slate-400 dark:text-white/35" />
            <p className="max-w-sm text-sm text-slate-600 dark:text-white/60">{error}</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full rounded-xl bg-white keep-white shadow-[0_18px_60px_-22px_rgba(15,23,42,0.55)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
