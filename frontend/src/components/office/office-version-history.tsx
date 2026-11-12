"use client";
import type { OfficeVersion } from "@/lib/office-storage";

interface OfficeVersionHistoryProps {
  versions: OfficeVersion[];
  onClose: () => void;
  onRestore: (version: OfficeVersion) => void;
}

export function OfficeVersionHistory({ versions, onClose, onRestore }: OfficeVersionHistoryProps) {
  return (
    <div className="app-glass rounded-xl border p-3">
      <div className="flex justify-between">
        <h3>Historial de versiones</h3>
        <button onClick={onClose}>Cerrar historial</button>
      </div>
      {!versions.length && <p>Sin versiones todavía</p>}
      {versions.map(v => (
        <div key={v.id} className="flex gap-3 p-2 text-sm">
          <span>Revisión {v.revision} · {new Date(v.created_at).toLocaleString("es")}</span>
          <button onClick={() => onRestore(v)}>Restaurar</button>
        </div>
      ))}
    </div>
  );
}
