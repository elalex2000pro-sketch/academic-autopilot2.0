"use client";

import { useId, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deliveryLabel } from "@/lib/task-delivery";
import type { Task } from "@/lib/types";

export interface TaskDeliveryActions {
  onDeclareDelivery: (id: string, body: { note?: string; url?: string }) => Promise<void>;
  onUndoDelivery: (id: string) => Promise<void>;
}

export function TaskDeliveryControls({ task, onDeclareDelivery, onUndoDelivery }: TaskDeliveryActions & { task: Task }) {
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delivered = task.delivery_status === "declared" || task.delivery_status === "confirmed";
  const confirmed = task.delivery_status === "confirmed";
  const link = task.delivery_url && /^https?:\/\//i.test(task.delivery_url) ? task.delivery_url : null;

  async function save(undo: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (undo) await onUndoDelivery(task.id);
      else await onDeclareDelivery(task.id, { note: note.trim() || undefined, url: url.trim() || undefined });
      setEditing(false);
      setNote("");
      setUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la entrega. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-2 text-xs">
      {delivered ? (
        <>
          <p className={confirmed ? "flex items-start gap-1.5 font-medium text-primary" : "flex items-start gap-1.5 font-medium text-foreground"}>
            {confirmed ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
            <span>{deliveryLabel(task)}</span>
          </p>
          {task.delivered_at && <p className="text-muted-foreground">Fecha registrada: {new Date(task.delivered_at).toLocaleString("es-ES")}</p>}
          {task.delivery_note && <p className="whitespace-pre-wrap break-words text-foreground">{task.delivery_note}</p>}
          {link && <a href={link} target="_blank" rel="noopener noreferrer" className="block break-all text-primary underline">Abrir documento externo</a>}
          {!confirmed && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void save(true)}>{busy ? "Guardando…" : "Deshacer entrega"}</Button>}
        </>
      ) : editing ? (
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
          <p className="text-muted-foreground">Solo se registra en Atlantium. No se envía nada a Moodle ni a Classroom.</p>
          <label className="block text-foreground" htmlFor={`${formId}-note`}>Nota (opcional)</label>
          <Input id={`${formId}-note`} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} disabled={busy} placeholder="Por ejemplo: entregada en papel" />
          <label className="block text-foreground" htmlFor={`${formId}-url`}>Enlace al documento (opcional)</label>
          <Input id={`${formId}-url`} type="url" value={url} maxLength={2048} onChange={(event) => setUrl(event.target.value)} disabled={busy} placeholder="https://…" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : "Confirmar entrega"}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(false); setError(null); }}>Cancelar</Button>
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(true); setError(null); }}>Marcar como entregada</Button>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  );
}
