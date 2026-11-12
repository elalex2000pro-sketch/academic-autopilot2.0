"use client";
import type { OfficeDocument } from "@/lib/office-storage";

interface OfficeDocumentCardProps {
  doc: OfficeDocument;
  onOpenTitle: () => void;
  onOpen: () => void;
  onSavePc: () => void;
  onRename: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onHistory: () => void;
  onDelete: () => void;
}

export function OfficeDocumentCard({ doc, onOpenTitle, onOpen, onSavePc, onRename, onMove, onDuplicate, onHistory, onDelete }: OfficeDocumentCardProps) {
  return (
    <article className="app-glass flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm">
      <button className="min-w-32 flex-1 text-left" onClick={onOpenTitle}>
        <strong>{doc.title}</strong>
        <p className="text-xs text-muted-foreground">
          {doc.kind === "sheet" ? "Hoja de cálculo" : "Documento"} · {doc.folder || "Sin carpeta"} · {new Date(doc.updated_at).toLocaleString("es")}
        </p>
      </button>
      <details className="relative">
        <summary className="cursor-pointer p-2" aria-label={`Acciones de ${doc.title}`}>Acciones</summary>
        <div className="flex flex-wrap gap-1">
          <button onClick={onOpen}>Abrir</button>
          <button onClick={onSavePc}>Guardar en el PC</button>
          <button onClick={onRename}>Renombrar</button>
          <button onClick={onMove}>Mover a carpeta</button>
          <button onClick={onDuplicate}>Duplicar</button>
          <button onClick={onHistory}>Historial</button>
          <button className="text-red-500" onClick={onDelete}>Borrar</button>
        </div>
      </details>
    </article>
  );
}
