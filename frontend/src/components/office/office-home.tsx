"use client";
import { OFFICE_TEMPLATES } from "@/lib/office-templates";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { OfficeLibrary } from "./office-library";
import { OfficeDocument, officeRequest } from "@/lib/office-storage";
export function OfficeHome() {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null); const [error, setError] = useState(""); const [templates,setTemplates]=useState(false);
  const open = async (id: string) => { router.push(`/office/${id}`); };
  async function create(kind: "document" | "sheet", title?: string, content?: string, settings:Record<string,unknown> = {}) {
    try { const doc = await officeRequest<OfficeDocument>("", "POST", { title: title || (kind === "document" ? "Documento sin título" : "Hoja sin título"), settings, kind, content: content ?? (kind === "document" ? "<p></p>" : "{}") }); await open(doc.id); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el documento"); }
  }
  async function importPc() {
    if (!window.autopilotDesktop?.files) { input.current?.click(); return; }
    const result = await window.autopilotDesktop.files.open({ mode: "pick-office" });
    if (result.ok && result.name && (result.data || result.text !== undefined)) await importFile(new File([result.data || result.text!],result.name)); else if (result.error) setError(result.error);
  }
  async function importFile(file:File) { try { const {readOfficeFile}=await import("@/lib/office-docx");const result=await readOfficeFile(file);if(result)await create("document",file.name.replace(/\.[^.]+$/,""),result.html,result.settings); }catch(e){setError(e instanceof Error?e.message:"No se pudo importar");} }
  return <div className="flex min-h-[70vh] flex-col gap-3">{templates && <div role="dialog" aria-label="Plantillas" className="app-glass rounded-xl border p-4"><h2>Nuevo documento</h2><div className="grid gap-3 sm:grid-cols-3">{OFFICE_TEMPLATES.map(t=><button key={t.title} className="rounded-xl border p-4 text-left hover:bg-primary/10" onClick={()=>{setTemplates(false);void create("document",t.title,t.html,t.settings)}}>{t.title}</button>)}</div><button onClick={()=>setTemplates(false)}>Cancelar</button></div>}{error && <p role="alert">{error}</p>}<OfficeLibrary dashboard active={null} onOpen={open} onClose={() => {}} onNew={() => setTemplates(true)} onNewSheet={() => void create("sheet")} onPc={() => void importPc()} onRestore={doc => void open(doc.id)} onImported={doc => void open(doc.id)} /><input ref={input} type="file" accept=".docx,.html,.htm,.txt,.md" className="hidden" onChange={e => { const file=e.target.files?.[0]; if(file) { if(file.size > 5*1024*1024) setError("El archivo supera 5 MB"); else void importFile(file); } e.target.value=""; }} /></div>;
}
