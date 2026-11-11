"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { OfficeLibrary } from "./office-library";
import { OfficeDocument, officeRequest } from "@/lib/office-storage";
import { textToHtml } from "@/lib/office-doc";
export function OfficeHome() {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null); const [error, setError] = useState("");
  const open = async (id: string) => { router.push(`/office/${id}`); };
  async function create(kind: "document" | "sheet", title?: string, content?: string) {
    try { const doc = await officeRequest<OfficeDocument>("", "POST", { title: title || (kind === "document" ? "Documento sin título" : "Hoja sin título"), kind, content: content ?? (kind === "document" ? "<p></p>" : "{}") }); await open(doc.id); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el documento"); }
  }
  async function importPc() {
    if (!window.autopilotDesktop?.files) { input.current?.click(); return; }
    const result = await window.autopilotDesktop.files.open({ mode: "pick-office" });
    if (result.ok && result.name && result.text !== undefined) await importText(result.name, result.text); else if (result.error) setError(result.error);
  }
  async function importText(name: string, text: string) { await create("document", name.replace(/\.[^.]+$/, ""), /\.html?$/i.test(name) ? text : textToHtml(text)); }
  return <div className="flex min-h-[70vh] flex-col gap-3">{error && <p role="alert">{error}</p>}<OfficeLibrary dashboard active={null} onOpen={open} onClose={() => {}} onNew={() => void create("document")} onNewSheet={() => void create("sheet")} onPc={() => void importPc()} onRestore={doc => void open(doc.id)} onImported={doc => void open(doc.id)} /><input ref={input} type="file" accept=".html,.htm,.txt,.md" className="hidden" onChange={e => { const file=e.target.files?.[0]; if(file) { if(file.size > 5*1024*1024) setError("El archivo supera 5 MB"); else void file.text().then(text => importText(file.name,text)); } e.target.value=""; }} /></div>;
}
