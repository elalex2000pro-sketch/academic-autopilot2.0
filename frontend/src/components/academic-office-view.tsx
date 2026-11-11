"use client";

// Academic Office conserva la edición local y sincroniza documentos privados con la API.
import { OfficeLibrary } from "@/components/office/office-library";
import { useOfficeStorage } from "@/components/office/use-office-storage";
import { OfficeData } from "@/lib/office-storage";
import { useRouter } from "next/navigation";
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
  buildDocumentHtml,
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

export function AcademicOfficeView({ newSignal = 0, documentId }: { newSignal?: number; documentId?: string }) {
  const router = useRouter();
  const [loadError, setLoadError] = useState("");
  const [module, setModule] = useState<OfficeModule>("document");
  const [docName, setDocName] = useState("Documento sin título");
  const [docHtml, setDocHtml] = useState(DEFAULT_DOC);
  const [sheetName, setSheetName] = useState("Hoja sin título");
  const [cells, setCells] = useState<CellMap>({});
  const [library, setLibrary] = useState(true);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [folder, setFolder] = useState<string | null>(null);


  const openRef = useRef<HTMLInputElement>(null);

  const data: OfficeData = { title: module === "document" ? docName : sheetName, kind: module, content: module === "document" ? docHtml : JSON.stringify(cells), schema_version: 1, settings, folder };
  const storage = useOfficeStorage(data, (doc) => {
    setModule(doc.kind); setSettings(doc.settings); setFolder(doc.folder);
    if (doc.kind === "document") { setDocName(doc.title); setDocHtml(doc.content); }
    else { setSheetName(doc.title); try { setCells(JSON.parse(doc.content)); } catch { setCells({}); } }
  });
  const openDocument = storage.open;
  useEffect(() => { if (documentId) void openDocument(documentId).then(() => setLibrary(false)).catch(e => setLoadError(e.message)); }, [documentId, openDocument]);
  useEffect(() => { if (documentId && storage.active && storage.active.id !== documentId) router.replace(`/office/${storage.active.id}`); }, [documentId, storage.active, router]);
  const saving = storage.status === "Guardando";
  const savedAt = storage.savedAt;
  function saveNow(nameOverride?: string) { if (nameOverride) void storage.copy(nameOverride); else void storage.save(); }
  useEffect(() => { if (newSignal > 0) void createNew("document"); /* external new document request */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSignal]);
  async function createNew(kind: OfficeModule) {
    await storage.fresh({ title: kind === "document" ? "Documento sin título" : "Hoja sin título", kind, content: kind === "document" ? DEFAULT_DOC : "{}", schema_version: 1, settings: {}, folder: null });
    setLibrary(false);
  }
  async function showLibrary() { await storage.save(true); if (documentId) router.push("/office"); else setLibrary(true); }
  async function openFromPc() {
    const bridge = window.autopilotDesktop?.files;
    if (!bridge || module === "sheet") { openRef.current?.click(); return; }
    const result = await bridge.open({ mode: "pick-office" });
    if (!result.ok) { if (result.error) window.alert(result.error); return; }
    if (result.name && (result.data || result.text !== undefined)) await openFile(new File([result.data || result.text!], result.name));
  }
  async function saveToPc(kind: "html" | "txt") {
    const element = document.createElement("div"); element.innerHTML = docHtml;
    const text = kind === "html" ? buildDocumentHtml(docName, docHtml) : element.innerText || element.textContent || "";
    const name = `${safeFileName(docName)}.${kind}`;
    const blob = new Blob([text], { type: kind === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8" });
    const bridge = window.autopilotDesktop?.files;
    if (bridge) { const result = await bridge.save({ name, data: await blob.arrayBuffer() }); if (!result.ok && !result.canceled) window.alert(result.error || "No se pudo guardar el archivo"); }
    else triggerDownload(name, blob);
  }

  const computed = evaluateSheet(cells);
  const filledCells = Object.keys(cells).length;

  function newDocument() { void createNew(module); }

  async function openFile(file: File) {
    if (file.size > 5 * 1024 * 1024) { window.alert("El archivo supera el límite de 5 MB."); return; }
    if (module === "document") {
      try { const { readOfficeFile } = await import("@/lib/office-docx"); const result = await readOfficeFile(file); if (!result) return; await storage.fresh({ title:file.name.replace(/\.[^.]+$/,""),kind:"document",content:result.html,schema_version:1,settings:result.settings,folder:null }); setLibrary(false); }
      catch(e) { window.alert(e instanceof Error?e.message:"No se pudo importar el documento"); }
    } else { const text=await file.text(); await storage.fresh({title:file.name,kind:"sheet",content:JSON.stringify(parseCsv(text)),schema_version:1,settings:{},folder:null});setLibrary(false); }
  }

  function exportDocument(kind: "docx" | "html" | "pdf") {
    const name = safeFileName(docName);
    if (kind === "docx") void import("@/lib/office-docx").then(m=>m.saveDocx(name,docHtml,settings)).catch(e=>window.alert(e.message));
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
        <GlassButton label={documentId ? "Volver a Office" : "Mis documentos"} onClick={() => void showLibrary()}><FolderOpen className="h-4 w-4" /></GlassButton>
        <span role="status" className="text-xs">{storage.status}</span>

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
              onClick={() => { if (tab.id !== module) void createNew(tab.id); }}
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
            module === "document" ? ".docx,.html,.htm,.txt,.md" : ".csv,.txt"
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

      {storage.error && <div role="alert" className="relative z-10 bg-amber-400/10 p-2 text-sm">{storage.error} <button className="underline" onClick={() => void storage.copy(`${docName} (recuperado)`)}>Guardar como copia</button></div>}
      {/* Area de trabajo */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {documentId && library ? <p role="status" className="p-6">{loadError || "Cargando documento…"}</p> : library ? <OfficeLibrary active={storage.active} onOpen={storage.open} onNew={newDocument} onClose={() => setLibrary(false)} onRestore={doc => storage.install(doc, doc)} onImported={doc => storage.install(doc, doc)} /> : module === "document" ? (
          <WriterEditor
            key={storage.active?.id || "new"}
            initialSettings={settings}
            onSettingsChange={setSettings}
            onSaveToPc={(kind) => void saveToPc(kind)}
            html={docHtml}
            documentName={docName}
            saving={saving}
            savedAt={savedAt}
            onChange={setDocHtml}
            onNew={newDocument}
            onOpen={() => void openFromPc()}
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
          <span>Academic Office · biblioteca privada</span>
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
