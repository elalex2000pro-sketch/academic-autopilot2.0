"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { OfficeData, OfficeDocument, OfficeError, officeDraftKey, officeRequest } from "@/lib/office-storage";

export function useOfficeStorage(data: OfficeData, load: (doc: OfficeData) => void) {
  const [active, setActive] = useState<OfficeDocument | null>(null);
  const [status, setStatus] = useState("Sin guardar");
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const current = useRef(data); current.current = data;
  const loader = useRef(load); loader.current = load;
  const docRef = useRef<OfficeDocument | null>(null);
  const baseline = useRef(JSON.stringify(data));
  const checkpointRevision = useRef(0);
  const pending = useRef<Promise<boolean> | null>(null);
  const blocked = useRef(false);
  const persist = useCallback(() => {
    try { localStorage.setItem(officeDraftKey(docRef.current?.id || "new"), JSON.stringify({ data: current.current, revision: docRef.current?.revision, import_key: draftKey.current })); return true; }
    catch { setError("No hay espacio para conservar el borrador local. Guarda una copia en el PC."); return false; }
  }, []);
  const save = useCallback(async (checkpoint = false): Promise<boolean> => {
    if (pending.current) { await pending.current; return saveRef.current(checkpoint); }
    if (blocked.current) return false;
    const task = (async () => {
      const value = { ...current.current }; const serialized = JSON.stringify(value);
      const doc = docRef.current;
      try {
        if (serialized === baseline.current && doc) {
          if (checkpoint && checkpointRevision.current !== doc.revision) {
            await officeRequest(`/${doc.id}/checkpoint`, "POST", { revision: doc.revision }); checkpointRevision.current = doc.revision;
          }
          return true;
        }
        persist(); setStatus("Guardando");
        const saved = await officeRequest<OfficeDocument>(doc ? `/${doc.id}` : "", doc ? "PUT" : "POST", { ...value, ...(doc ? { revision: doc.revision, checkpoint } : { import_key: draftKey.current }) });
        if (!doc && (saved.content !== value.content || saved.title !== value.title || JSON.stringify(saved.settings) !== JSON.stringify(value.settings))) {
          // Una creación anterior pudo llegar al servidor aunque se perdiera la respuesta.
          // Su respuesta idempotente no confirma que este borrador más reciente esté guardado.
          docRef.current = saved; setActive(saved);
          throw new OfficeError(409, "El servidor recuperó una creación anterior. Conservamos tu borrador más reciente; guárdalo como copia.");
        }
        docRef.current = saved; setActive(saved); baseline.current = serialized;
        if (checkpoint || !doc) checkpointRevision.current = saved.revision;
        setStatus("Guardado"); setError(""); setSavedAt(Date.now());
        if (JSON.stringify(current.current) === serialized) {
          localStorage.removeItem(officeDraftKey(doc?.id || "new"));
          localStorage.removeItem(officeDraftKey(saved.id));
        } else persist();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "No se pudo guardar";
        if (e instanceof OfficeError && e.status === 409) { blocked.current = true; setStatus("Conflicto de versión"); }
        else setStatus("Sin conexión");
        setError(message); persist(); return false;
      }
    })();
    pending.current = task;
    try { return await task; } finally { if (pending.current === task) pending.current = null; }
  }, [persist]);
  const draftKey = useRef(crypto.randomUUID());
  const install = useCallback((doc: OfficeDocument | null, value: OfficeData) => {
    docRef.current = doc; setActive(doc); blocked.current = false;
    const clean: OfficeData = { title: value.title, kind: value.kind, content: value.content, schema_version: value.schema_version, settings: value.settings, folder: value.folder };
    baseline.current = JSON.stringify(clean); current.current = clean;
    draftKey.current = crypto.randomUUID(); checkpointRevision.current = 0;
    loader.current(value); setStatus(doc ? "Guardado" : "Sin guardar"); setError("");
  }, []);
  const open = useCallback(async (id: string) => {
    if (pending.current) await pending.current;
    if (JSON.stringify(current.current) !== baseline.current && !await save(true)) return;
    const doc = await officeRequest<OfficeDocument>(`/${id}`);
    const raw = localStorage.getItem(officeDraftKey(id));
    install(doc, doc);
    if (raw && window.confirm("Hay un borrador local pendiente. ¿Recuperarlo?")) {
      const draft = JSON.parse(raw); loader.current(draft.data); current.current = draft.data;
      if (draft.revision !== doc.revision) { blocked.current = true; setStatus("Conflicto de versión"); setError("El servidor tiene otra revisión. Guarda el borrador como copia."); }
    }
  }, [install, save]);
  const copy = useCallback(async (title: string) => {
    try {
      if (pending.current) await pending.current;
      if (!blocked.current) await save(true); else persist();
      const doc = await officeRequest<OfficeDocument>("", "POST", { ...current.current, title });
      install(doc, doc);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear la copia"); persist(); }
  }, [install, persist, save]);
  const fresh = useCallback(async (value: OfficeData) => {
    if (pending.current) await pending.current;
    if (JSON.stringify(current.current) !== baseline.current && !await save(true)) return;
    try { const doc = await officeRequest<OfficeDocument>("", "POST", value); install(doc, doc); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el documento"); }
  }, [install, save]);
  useEffect(() => {
    if (JSON.stringify(data) === baseline.current) return;
    persist(); const timer = setTimeout(() => { void save(); }, 1200);
    return () => clearTimeout(timer);
  }, [data, persist, save]);
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    const timer = setInterval(() => { if (docRef.current || JSON.stringify(current.current) !== baseline.current) void saveRef.current(true); }, 120000);
    const retry = () => { if (docRef.current || JSON.stringify(current.current) !== baseline.current) void saveRef.current(); };
    const retryTimer = setInterval(retry, 15000);
    const closing = () => {
      if (JSON.stringify(current.current) !== baseline.current) persist();
      const doc = docRef.current;
      if (doc && !blocked.current) {
        const dirty = JSON.stringify(current.current) !== baseline.current;
        const body = dirty ? { ...current.current, revision: doc.revision, checkpoint: true } : { revision: doc.revision };
        // keepalive puede fallar por tamaño o cierre abrupto; el borrador ya está a salvo.
        void officeRequest(dirty ? `/${doc.id}` : `/${doc.id}/checkpoint`, dirty ? "PUT" : "POST", body, true).catch(() => {});
      }
    };
    window.addEventListener("online", retry); window.addEventListener("pagehide", closing);
    return () => { clearInterval(timer); clearInterval(retryTimer); window.removeEventListener("online", retry); window.removeEventListener("pagehide", closing); if (docRef.current) void saveRef.current(true); };
  }, [persist]);
  return { active, status, error, savedAt, save, open, copy, fresh, install };
}
