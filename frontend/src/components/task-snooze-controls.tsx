"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { reminderDateAfter, snoozeLabel, TASK_REMINDER_EVENT } from "@/lib/task-snooze";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TaskSnoozeControls({ task, onSaved }: { task: Task; onSaved?: (task: Task) => void }) {
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(until: string | null) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const saved = await api.snoozeTask(task.id, until);
      onSaved?.(saved);
      window.dispatchEvent(new Event(TASK_REMINDER_EVENT));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el aplazamiento."); }
    finally { setBusy(false); }
  }
  if (task.status === "completed" || task.status === "archived" || (task.delivery_status && task.delivery_status !== "none") || task.parent_task_id) return null;
  return <div className="min-w-0 space-y-2 text-xs text-foreground">
    {snoozeLabel(task) && <p className="font-medium text-primary">{snoozeLabel(task)}</p>}
    <div className="flex flex-wrap gap-2">
      {([ [1, "Mañana"], [3, "En 3 días"], [7, "En 1 semana"] ] as const).map(([days, label]) => <Button key={days} type="button" size="sm" variant="outline" disabled={busy} onClick={() => void save(reminderDateAfter(days))}>{label}</Button>)}
      {task.snoozed_until && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>Deshacer aplazamiento</Button>}
    </div>
    <form className="flex min-w-0 flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (date) void save(date); }}>
      <Input aria-label={`Fecha para aplazar ${task.title}`} type="date" min={reminderDateAfter(1)} value={date} onChange={(event) => setDate(event.target.value)} className="min-w-0 flex-1" required disabled={busy} />
      <Button type="submit" size="sm" variant="secondary" disabled={busy}>Elegir fecha</Button>
    </form>
    <p className="text-muted-foreground">Solo cambia el recordatorio, no la fecha límite.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
