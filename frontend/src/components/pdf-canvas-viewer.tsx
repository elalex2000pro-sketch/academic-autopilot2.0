"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderGenerationRef = useRef(0);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [documentReady, setDocumentReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const nextPage = Math.min(Math.max(initialPage, 1), nextTotal);
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

  const goTo = (next: number) => {
    if (!total) return;
    const clamped = Math.min(Math.max(next, 1), total);
    setPage(clamped);
    onPageChange?.(clamped, total);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/40 bg-white/45 px-3 py-2 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/25">
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
          <span className="min-w-16 text-center text-[11px] font-medium tabular-nums text-slate-600 dark:text-white/65">
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

      <div
        ref={containerRef}
        className="relative min-h-[420px] overflow-auto rounded-3xl border border-white/35 bg-slate-200/45 p-3 shadow-inner backdrop-blur-2xl dark:border-white/10 dark:bg-black/35"
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
