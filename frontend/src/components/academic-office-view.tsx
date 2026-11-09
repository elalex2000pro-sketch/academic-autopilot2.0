"use client";

// Academic-Office: suite ofimatica integrada (documentos y hojas de calculo).
//
// El editor corre en el navegador: Tiptap/ProseMirror para texto y un motor de
// formulas propio para la hoja. No necesita servidores externos ni claves, asi
// que funciona igual en local, en Vercel y en la app de escritorio.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Download,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Save,
} from "lucide-react";

import { SheetEditor } from "@/components/office/sheet-editor";
import {
  exportDocumentAsDoc,
  exportDocumentAsHtml,
  printDocumentAsPdf,
  safeFileName,
  textToHtml,
} from "@/lib/office-doc";
import {
  SHEET_COLS,
  SHEET_ROWS,
  evaluateSheet,
  parseCsv,
  sheetToCsv,
  sheetToSpreadsheetMl,
  type CellMap,
} from "@/lib/office-sheet";
import { cn } from "@/lib/utils";

type OfficeModule = "document" | "sheet";

const DOC_KEY = "academic-office-document-v1";
const SHEET_KEY = "academic-office-sheet-v1";

// CKEditor 5 necesita el DOM: se carga solo en cliente y en su propio chunk.
const WriterEditor = dynamic(
  () =>
    import("@/components/office/writer-editor").then((module) => ({
      default: module.WriterEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando motor ofimatico...
      </div>
    ),
  },
);

const DEFAULT_DOC = `<h1>Documento sin título</h1><p>Empieza a escribir aquí. Puedes dar formato con la barra superior y exportar a Word, HTML o PDF.</p><p></p>`;

interface StoredDocument {
  name?: string;
  html?: string;
}

interface StoredSheet {
  name?: string;
  cells?: CellMap;
}

function AcademicOfficeLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 shadow-[0_8px_20px_-8px_rgba(59,130,246,0.9)]">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.65),transparent_55%)]" />
        <svg viewBox="0 0 24 24" className="relative h-5 w-5" aria-hidden="true">
          <path
            d="M12 3.2 4.6 20.4h3.5l1.5-3.7h4.8l1.5 3.7h3.5L12 3.2Zm-1.2 10.4L12 9.8l1.2 3.8h-2.4Z"
            fill="white"
          />
        </svg>
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">
          Academic<span className="text-primary">-Office</span>
        </p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Suite de estudio
        </p>
      </div>
    </div>
  );
}

function GlassButton({
  label,
  onClick,
  children,
  primary = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition disabled:opacity-50",
        primary
          ? "border-primary/30 bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_rgba(37,99,235,0.9)] hover:brightness-110"
          : "border-white/50 bg-white/60 text-foreground/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function AcademicOfficeView({ newSignal = 0 }: { newSignal?: number }) {
  const [module, setModule] = useState<OfficeModule>("document");
  const [docName, setDocName] = useState("Documento sin título");
  const [docHtml, setDocHtml] = useState(DEFAULT_DOC);
  const [sheetName, setSheetName] = useState("Hoja sin título");
  const [cells, setCells] = useState<CellMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const openRef = useRef<HTMLInputElement>(null);

  // Recupera el trabajo guardado en este dispositivo.
  useEffect(() => {
    try {
      const rawDocument = window.localStorage.getItem(DOC_KEY);
      if (rawDocument) {
        const parsed = JSON.parse(rawDocument) as StoredDocument;
        if (typeof parsed.html === "string" && parsed.html.trim()) {
          setDocHtml(parsed.html);
        }
        if (parsed.name) setDocName(parsed.name);
      }
      const rawSheet = window.localStorage.getItem(SHEET_KEY);
      if (rawSheet) {
        const parsed = JSON.parse(rawSheet) as StoredSheet;
        if (parsed.cells && typeof parsed.cells === "object") {
          setCells(parsed.cells);
        }
        if (parsed.name) setSheetName(parsed.name);
      }
    } catch {
      // Datos corruptos: se empieza con un documento limpio.
    } finally {
      setHydrated(true);
    }
  }, []);

  // Documentos puede pedir un documento formal nuevo desde fuera.
  useEffect(() => {
    if (newSignal > 0) newDocument(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSignal]);

  // Autoguardado con retardo para no escribir en cada tecla.
  useEffect(() => {
    if (!hydrated) return;
    setSaving(true);
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          DOC_KEY,
          JSON.stringify({ name: docName, html: docHtml } satisfies StoredDocument),
        );
        window.localStorage.setItem(
          SHEET_KEY,
          JSON.stringify({ name: sheetName, cells } satisfies StoredSheet),
        );
        setSavedAt(Date.now());
      } catch {
        // Sin espacio o modo privado: el trabajo sigue en memoria.
      } finally {
        setSaving(false);
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [cells, docHtml, docName, hydrated, sheetName]);

  function saveNow(nameOverride?: string) {
    const name = nameOverride ?? docName;
    try {
      window.localStorage.setItem(
        DOC_KEY,
        JSON.stringify({ name, html: docHtml } satisfies StoredDocument),
      );
      window.localStorage.setItem(
        SHEET_KEY,
        JSON.stringify({ name: sheetName, cells } satisfies StoredSheet),
      );
      if (nameOverride) setDocName(nameOverride);
      setSavedAt(Date.now());
    } catch {
      // Sin espacio o modo privado: el trabajo sigue en memoria.
    }
  }

  const computed = evaluateSheet(cells);
  const filledCells = Object.keys(cells).length;

  function newDocument(force = false) {
    if (
      !force &&
      module === "document" &&
      !window.confirm("¿Descartar el documento actual y crear uno nuevo?")
    ) {
      return;
    }
    if (
      module === "sheet" &&
      !window.confirm("¿Descartar la hoja actual y crear una nueva?")
    ) {
      return;
    }
    if (module === "document") {
      setDocHtml(DEFAULT_DOC);
      setDocName("Documento sin título");
    } else {
      setCells({});
      setSheetName("Hoja sin título");
    }
  }

  async function openFile(file: File) {
    const text = await file.text();
    const baseName = file.name.replace(/\.[^.]+$/, "");
    if (module === "document") {
      const looksLikeHtml = /\.html?$/i.test(file.name);
      setDocHtml(looksLikeHtml ? text : textToHtml(text));
      setDocName(baseName || "Documento importado");
    } else {
      setCells(parseCsv(text));
      setSheetName(baseName || "Hoja importada");
    }
  }

  function exportDocument(kind: "doc" | "html" | "pdf") {
    const name = safeFileName(docName);
    if (kind === "doc") exportDocumentAsDoc(name, docHtml);
    else if (kind === "html") exportDocumentAsHtml(name, docHtml);
    else printDocumentAsPdf(name, docHtml);
  }

  function exportSheet(kind: "csv" | "xls") {
    const name = safeFileName(sheetName);
    if (kind === "csv") {
      const csv = `\uFEFF${sheetToCsv(computed, SHEET_ROWS, SHEET_COLS)}`;
      triggerDownload(
        `${name}.csv`,
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
    } else {
      const xml = sheetToSpreadsheetMl(
        computed,
        sheetName,
        SHEET_ROWS,
        SHEET_COLS,
      );
      triggerDownload(
        `${name}.xls`,
        new Blob([xml], { type: "application/vnd.ms-excel" }),
      );
    }
  }

  return (
    <div className="academic-office-panel relative flex h-[calc(100dvh-9rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-white/50 bg-gradient-to-br from-white/80 via-white/60 to-white/40 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-950/60 sm:min-h-[560px]">
      {/* Brillo ambiental del cristal */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-400/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl"
      />

      {/* Barra superior personalizada */}
      <header className="relative z-10 flex flex-wrap items-center gap-3 border-b border-white/50 px-3 py-2.5 dark:border-white/10 sm:px-4">
        <AcademicOfficeLogo />

        <div className="order-3 flex w-full gap-1 rounded-xl border border-white/50 bg-white/40 p-1 backdrop-blur sm:order-none sm:ml-3 sm:w-auto dark:border-white/10 dark:bg-white/5">
          {(
            [
              { id: "document", label: "Documento", icon: FileText },
              { id: "sheet", label: "Hoja de calculo", icon: FileSpreadsheet },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setModule(tab.id)}
              aria-pressed={module === tab.id}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition sm:flex-none",
                module === tab.id
                  ? "bg-white text-foreground shadow-sm dark:bg-white/15"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <input
            value={module === "document" ? docName : sheetName}
            onChange={(event) =>
              module === "document"
                ? setDocName(event.target.value)
                : setSheetName(event.target.value)
            }
            aria-label="Nombre del archivo"
            className="hidden h-9 w-44 rounded-xl border border-white/50 bg-white/50 px-3 text-xs font-medium outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 sm:block dark:border-white/10 dark:bg-white/5"
          />
          {module === "sheet" && (
            <>
              <GlassButton label="Nuevo" onClick={newDocument}>
                <FilePlus2 className="h-4 w-4" />
              </GlassButton>
              <GlassButton label="Abrir" onClick={() => openRef.current?.click()}>
                <FolderOpen className="h-4 w-4" />
              </GlassButton>
              <GlassButton label="Guardar" onClick={() => saveNow()} primary>
                <Save className="h-4 w-4" />
              </GlassButton>
            </>
          )}
        </div>

        <input
          ref={openRef}
          type="file"
          className="hidden"
          accept={
            module === "document" ? ".html,.htm,.txt,.md" : ".csv,.txt"
          }
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openFile(file);
            event.target.value = "";
          }}
        />
      </header>

      {/* Barra de exportacion (la hoja conserva sus botones; el documento
          usa el menu Archivo del escritor). */}
      {module === "sheet" && (
      <div className="relative z-10 flex flex-wrap items-center gap-1.5 border-b border-white/40 px-3 py-2 dark:border-white/10 sm:px-4">
        <span className="mr-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Download className="h-3.5 w-3.5" /> Exportar
        </span>
        <GlassButton label="CSV" onClick={() => exportSheet("csv")}>
          <Download className="h-3.5 w-3.5" />
        </GlassButton>
        <GlassButton label="Excel (.xls)" onClick={() => exportSheet("xls")}>
          <FileSpreadsheet className="h-3.5 w-3.5" />
        </GlassButton>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando...
            </>
          ) : savedAt ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" /> Guardado en este
              dispositivo
            </>
          ) : (
            "Los cambios se guardan solos"
          )}
        </span>
      </div>
      )}

      {/* Area de trabajo */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {module === "document" ? (
          <WriterEditor
            html={docHtml}
            documentName={docName}
            saving={saving}
            savedAt={savedAt}
            onChange={setDocHtml}
            onNew={newDocument}
            onOpen={() => openRef.current?.click()}
            onSave={() => saveNow()}
            onSaveAs={(name) => saveNow(name)}
            onExport={exportDocument}
          />
        ) : (
          <SheetEditor cells={cells} onChange={setCells} />
        )}
      </div>

      {module === "sheet" && (
        <footer className="relative z-10 flex flex-wrap items-center gap-x-4 border-t border-white/40 px-4 py-1.5 text-[10px] text-muted-foreground dark:border-white/10">
          <span>Academic-Office · editor local sin servidores externos</span>
          <span className="ml-auto">{filledCells} celdas · CSV y Excel</span>
        </footer>
      )}
    </div>
  );
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
