"use client";
import { OfficeDocumentCard } from "./office-document-card";
import { AnimatePresence, motion } from "framer-motion";
import { saveOfficeFile } from "@/lib/office-file-actions";
import { buildDocumentHtml, safeFileName } from "@/lib/office-doc";
import { useCallback, useEffect, useState } from "react";
import { OfficeData, OfficeDocument, OfficeVersion, draftImportKey, officeRequest, officeDraftKey } from "@/lib/office-storage";

export function OfficeLibrary({ active, onOpen, onNew, onClose, onRestore, onImported, dashboard = false, onNewSheet, onPc }: {
  dashboard?: boolean; onNewSheet?: () => void; onPc?: () => void;
  active: OfficeDocument | null; onOpen: (id: string) => Promise<void>; onNew: () => void;
  onClose: () => void; onRestore: (doc: OfficeDocument) => void; onImported: (doc: OfficeDocument) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [grid, setGrid] = useState(true);
  const [historyDoc, setHistoryDoc] = useState<OfficeDocument | null>(null);
  const [docs, setDocs] = useState<OfficeDocument[]>([]);
  const [q, setQ] = useState(""); const [order, setOrder] = useState("updated");
  const [folder, setFolder] = useState(""); const [error, setError] = useState("");
  const [versions, setVersions] = useState<OfficeVersion[] | null>(null);
  const [legacy, setLegacy] = useState<{ key: string; data: OfficeData; import_key?: string }[]>([]);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setDocs(await officeRequest(`?q=${encodeURIComponent(q)}&order=${order}`)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Sin conexión"); }
    finally { setLoading(false); }
  }, [q, order]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const drafts: { key: string; data: OfficeData; import_key?: string }[] = [];
    for (const kind of ["document", "sheet"] as const) {
      const key = `academic-office-${kind}-v1`;
      try { const raw = localStorage.getItem(key); if (!raw) continue; const old = JSON.parse(raw);
        drafts.push({ key, data: { title: old.name || "Borrador recuperado", kind, content: kind === "document" ? old.html || "" : JSON.stringify(old.cells || {}), schema_version: 1, settings: {}, folder: null } });
      } catch { setError("No se pudo leer un borrador antiguo. Se conserva en este dispositivo."); }
    }
    try { const raw = localStorage.getItem(officeDraftKey("new")); if (raw) drafts.push({ key: officeDraftKey("new"), data: JSON.parse(raw).data, import_key: JSON.parse(raw).import_key }); } catch { /* conservar */ }
    setLegacy(drafts);
  }, []);
  async function run(action: () => Promise<void>) { try { await action(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la operación"); } }
  async function rename(doc: OfficeDocument, move = false) {
    const value = window.prompt(move ? "Carpeta (vacío para quitarla)" : "Nombre del documento", move ? doc.folder || "" : doc.title);
    if (value === null || (!move && !value.trim())) return;
    const full = await officeRequest<OfficeDocument>(`/${doc.id}`);
    const result = await officeRequest<OfficeDocument>(`/${doc.id}`, "PUT", { title: move ? full.title : value.trim(), kind: full.kind, content: full.content, settings: full.settings, schema_version: full.schema_version, folder: move ? value.trim() || null : full.folder, revision: doc.revision, checkpoint: true });
    if (active?.id === doc.id) onRestore(result);
  }
  async function savePc(doc: OfficeDocument) {
    const full = await officeRequest<OfficeDocument>(`/${doc.id}`);
    const blob = new Blob([full.kind === "document" ? buildDocumentHtml(full.title, full.content) : full.content], { type: full.kind === "document" ? "text/html;charset=utf-8" : "application/json" });
    const name = `${safeFileName(full.title)}.${full.kind === "document" ? "html" : "json"}`;
    const result = await saveOfficeFile(name, blob);
    if (!result.ok && !result.canceled) throw new Error(result.error);
  }
  const folders = Array.from(new Set(docs.map(d => d.folder).filter(Boolean))) as string[];
  return <section className="app-glass flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4 [&_button]:min-h-9 [&_button]:rounded-lg [&_button]:px-2 [&_button]:transition-colors [&_button:hover]:bg-primary/10 [&_button:focus-visible]:outline-primary [&_select]:rounded-lg [&_select]:border [&_select]:bg-background/60 [&_select]:p-2" aria-label="Mis documentos">
    <div className="flex flex-wrap items-center gap-2"><h2 className="mr-auto text-2xl font-semibold">{dashboard ? "Academic Office" : "Mis documentos"}</h2><button onClick={onNew}>Nuevo documento</button>{dashboard && <><button onClick={onNewSheet}>Nueva hoja</button><button onClick={onPc}>Abrir desde el PC</button></>}{!dashboard && <button onClick={onClose}>Volver al editor</button>}</div>
    <div className="flex flex-wrap gap-2"><input aria-label="Buscar documentos" placeholder="Buscar documentos…" className="rounded-lg border bg-background/60 p-2" value={q} onChange={e => setQ(e.target.value)} /><select aria-label="Ordenar" value={order} onChange={e => setOrder(e.target.value)}><option value="updated">Última modificación</option><option value="created">Fecha de creación</option><option value="title">Nombre</option></select><select aria-label="Carpeta" value={folder} onChange={e => setFolder(e.target.value)}><option value="">Todas las carpetas</option>{folders.map(f => <option key={f}>{f}</option>)}</select></div>
    <div className="flex flex-wrap gap-2"><select aria-label="Filtrar por tipo" value={type} onChange={e => setType(e.target.value)}><option value="">Todos los tipos</option><option value="document">Documentos</option><option value="sheet">Hojas</option></select><button aria-pressed={grid} onClick={() => setGrid(true)}>Cuadrícula</button><button aria-pressed={!grid} onClick={() => setGrid(false)}>Lista</button></div>
    {dashboard && !q && <><h3 className="text-lg font-semibold">Recientes</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...docs].sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0,3).map(doc => <button key={doc.id} className="app-glass min-w-0 rounded-xl border p-4 text-left" onClick={() => void run(() => onOpen(doc.id))}><strong>{doc.title}</strong><p className="line-clamp-2 text-sm text-muted-foreground">{doc.excerpt || "Sin contenido todavía"}</p><p className="text-xs">{new Date(doc.updated_at).toLocaleString("es")}</p></button>)}</div></>}
    {dashboard && <h3 className="text-lg font-semibold">Mis documentos</h3>}
    {loading && <p role="status">Cargando documentos…</p>}
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    {legacy.map(draft => <div key={draft.key} className="rounded-xl border bg-amber-400/10 p-3 text-sm">Borrador de este dispositivo: {draft.data.title} <button className="underline" onClick={() => void run(async () => {
      const doc = await officeRequest<OfficeDocument>("", "POST", { ...draft.data, import_key: draft.import_key || draftImportKey(draft.key, draft.data.content) });
      // Solo retirar el borrador tras respuesta de éxito del servidor.
      localStorage.removeItem(draft.key); setLegacy(items => items.filter(i => i.key !== draft.key)); onImported(doc);
    })}>Guardar en la app</button></div>)}
    {!loading && !docs.filter(d => (!folder || d.folder === folder) && (!type || d.kind === type)).length && <p className="text-sm text-muted-foreground">Aquí aparecerán tus documentos y hojas. Crea uno o recupera tu borrador.</p>}
    <AnimatePresence mode="wait"><motion.div key={`${grid}-${type}-${folder}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={grid ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"}>{docs.filter(d => (!folder || d.folder === folder) && (!type || d.kind === type)).map(doc => <OfficeDocumentCard key={doc.id} doc={doc} onOpenTitle={() => void run(async () => { await onOpen(doc.id); onClose(); })} onOpen={() => void run(() => onOpen(doc.id))} onSavePc={() => void run(() => savePc(doc))} onRename={() => void run(() => rename(doc))} onMove={() => void run(() => rename(doc, true))} onDuplicate={() => void run(async () => { await officeRequest(`/${doc.id}/duplicate`, "POST"); })} onHistory={() => void run(async () => { setHistoryDoc(await officeRequest<OfficeDocument>(`/${doc.id}`)); setVersions(await officeRequest(`/${doc.id}/versions`)); })} onDelete={() => { if (window.confirm(`¿Borrar «${doc.title}» y su historial?`)) void run(async () => { await officeRequest(`/${doc.id}`, "DELETE"); if (active?.id === doc.id) onNew(); }); }} />)}</motion.div></AnimatePresence>
    {versions && <div className="app-glass rounded-xl border p-3"><div className="flex justify-between"><h3>Historial de versiones</h3><button onClick={() => setVersions(null)}>Cerrar historial</button></div>{!versions.length && <p>Sin versiones todavía</p>}{versions.map(v => <div key={v.id} className="flex gap-3 p-2 text-sm"><span>Revisión {v.revision} · {new Date(v.created_at).toLocaleString("es")}</span><button onClick={() => void run(async () => { const target = historyDoc || active; if (!target) return; const restored = await officeRequest<OfficeDocument>(`/${target.id}/versions/${v.id}/restore`, "POST", { revision: target.revision }); onRestore(restored); setVersions(null); })}>Restaurar</button></div>)}</div>}
  </section>;
}
