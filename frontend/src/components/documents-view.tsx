"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Calculator, FileText, NotebookPen, PenTool, Plus, X } from "lucide-react";

import NotebooksPage from "@/app/notebooks/page";
import { AcademicOfficeView } from "@/components/academic-office-view";
import { CalculatorPanel } from "@/components/calculator";
import { Button } from "@/components/ui/button";
import { requestNewCanvas, requestNewNotebook } from "@/lib/documents";
import { cn } from "@/lib/utils";

const CanvasView = dynamic(
  () =>
    import("@/components/canvas/canvas-view").then((module) => ({
      default: module.CanvasView,
    })),
  { ssr: false },
);

type DocumentKind = "notes" | "formal" | "canvas";

const KIND_TABS: { id: DocumentKind; label: string; description: string }[] = [
  {
    id: "notes",
    label: "Apuntes rápidos",
    description: "Cuadernos para tomar notas al vuelo",
  },
  {
    id: "formal",
    label: "Documentos formales",
    description: "Documento de texto o hoja de cálculo",
  },
  {
    id: "canvas",
    label: "Pizarras",
    description: "Mapas mentales y esquemas libres",
  },
];

/**
 * Sección única de Documentos: reúne los cuadernos (apuntes rápidos) y el
 * Academic-Office (documentos formales) bajo una misma entrada de navegación.
 */
export function DocumentsView() {
  const [kind, setKind] = useState<DocumentKind>("notes");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [pendingNew, setPendingNew] = useState<DocumentKind | null>(null);
  const [formalSignal, setFormalSignal] = useState(0);
  // Calculadora flotante: se abre con un clic desde cualquier pestaña.
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  // Si el apunte se crea desde la pestaña de documentos formales, primero hay
  // que montar la vista de cuadernos y avisarle después de que escuche.
  useEffect(() => {
    if (kind === "notes" && pendingNew === "notes") {
      requestNewNotebook();
      setPendingNew(null);
    }
    if (kind === "canvas" && pendingNew === "canvas") {
      requestNewCanvas();
      setPendingNew(null);
    }
  }, [kind, pendingNew]);

  function create(next: DocumentKind) {
    setChooserOpen(false);
    setKind(next);
    if (next === "formal") setFormalSignal((value) => value + 1);
    else if (next === "canvas") setPendingNew("canvas");
    else setPendingNew("notes");
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-2 md:px-6 md:pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/90">
            Documentos
          </h1>
          <p className="text-[11.5px] text-slate-500 dark:text-white/40">
            Apuntes, documentos formales y pizarras en un solo lugar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCalculatorOpen((value) => !value)}
            aria-expanded={calculatorOpen}
            aria-controls="documents-calculator"
          >
            <Calculator className="h-4 w-4" />
            Calculadora
          </Button>
          <Button size="sm" onClick={() => setChooserOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Tipo de documento"
        className="flex gap-1 rounded-2xl border border-slate-300/40 bg-slate-100/50 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]"
      >
        {KIND_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={kind === item.id}
            onClick={() => setKind(item.id)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-left transition-colors",
              kind === item.id
                ? "bg-white/80 text-slate-900 shadow-sm dark:bg-white/10 dark:text-white/90"
                : "text-slate-500 hover:bg-white/50 dark:text-white/40 dark:hover:bg-white/[0.06]",
            )}
          >
            <span className="block text-[12px] font-semibold">{item.label}</span>
            <span className="block text-[10px] opacity-70">{item.description}</span>
          </button>
        ))}
      </div>

      {kind === "notes" ? (
        <NotebooksPage />
      ) : kind === "formal" ? (
        <AcademicOfficeView newSignal={formalSignal} />
      ) : (
        <CanvasView />
      )}

      <div id="documents-calculator">
        <CalculatorPanel
          open={calculatorOpen}
          onClose={() => setCalculatorOpen(false)}
        />
      </div>

      {chooserOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onClick={() => setChooserOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="documents-new-title"
            className="w-full max-w-2xl rounded-3xl border border-slate-300/40 bg-slate-100/90 p-5 shadow-[0_28px_80px_-36px_rgba(32,39,48,0.45)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/92"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="documents-new-title" className="text-lg font-semibold tracking-tight">
                  ¿Qué quieres crear?
                </h2>
                <p className="text-[11.5px] text-slate-500 dark:text-white/40">
                  Elige el tipo de documento y empezamos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => create("notes")}
                className="group rounded-2xl border border-slate-300/40 bg-white/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#0066FF]/35 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-[#8ab9ff]/30 dark:hover:bg-white/[0.07]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]">
                  <NotebookPen className="h-5 w-5" />
                </span>
                <span className="mt-3 block text-[13px] font-semibold text-slate-800 dark:text-white/85">
                  Apunte rápido
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-white/40">
                  Un cuaderno con plantillas para clase, Cornell o repaso.
                </span>
              </button>

              <button
                type="button"
                onClick={() => create("formal")}
                className="group rounded-2xl border border-slate-300/40 bg-white/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#0066FF]/35 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-[#8ab9ff]/30 dark:hover:bg-white/[0.07]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="mt-3 block text-[13px] font-semibold text-slate-800 dark:text-white/85">
                  Documento formal
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-white/40">
                  Editor de texto o hoja de cálculo con exportación a Word, PDF y Excel.
                </span>
              </button>

              <button
                type="button"
                onClick={() => create("canvas")}
                className="group rounded-2xl border border-slate-300/40 bg-white/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#0066FF]/35 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-[#8ab9ff]/30 dark:hover:bg-white/[0.07]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]">
                  <PenTool className="h-5 w-5" />
                </span>
                <span className="mt-3 block text-[13px] font-semibold text-slate-800 dark:text-white/85">
                  Pizarra infinita
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-white/40">
                  Lienzo libre para mapas mentales, fotos y esquemas de red.
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
