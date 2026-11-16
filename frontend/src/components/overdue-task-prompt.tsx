"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { TaskSnoozeControls } from "@/components/task-snooze-controls";
import { TaskDeliveryControls } from "@/components/task-delivery-controls";
import { api } from "@/lib/api";
import { isSnoozed, TASK_REMINDER_EVENT } from "@/lib/task-snooze";
import type { Task } from "@/lib/types";

export function OverdueTaskPrompt() {
  const { user } = useAuth();
  const userId = user?.id;
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useRef(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const update = useCallback((saved: Task) => {
    setTasks((current) => current.map((task) => task.id === saved.id ? saved : task));
    window.dispatchEvent(new Event(TASK_REMINDER_EVENT));
  }, []);
  useEffect(() => {
    let cancelled = false, busy = false;
    async function check() {
      if (!userId || open.current || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const result = await api.overduePrompts();
        if (!cancelled && result.tasks.length) {
          open.current = true; setTasks(result.tasks); setRemaining(result.remaining); setDismissed([]);
          dialog.current?.showModal();
        }
      } catch { /* Sin red: no mostrar datos antiguos como si fueran actuales. */ }
      finally { busy = false; }
    }
    void check();
    const timer = setInterval(() => void check(), 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, [userId]);
  function close() { dialog.current?.close(); open.current = false; setTasks([]); setError(null); }
  return <dialog ref={dialog} aria-labelledby="overdue-title" onCancel={close} className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-3xl border border-border bg-background p-4 text-foreground shadow-xl backdrop:bg-foreground/30 sm:p-6">
    <h2 id="overdue-title" className="text-lg font-semibold">Tareas que han pasado de fecha</h2>
    <p className="my-3 text-sm text-muted-foreground">¿Quieres aplazarlas? El plazo del colegio se mantiene. Solo preguntamos una vez al día por tarea.</p>
    <div className="space-y-4">{tasks.filter((task) => !dismissed.includes(task.id)).map((task) => <article aria-label={task.title} key={task.id} className="min-w-0 space-y-3 rounded-2xl border border-border p-3">
      <h3 className="break-words font-medium">{task.title}</h3>
      <p className="text-xs text-destructive">Vencida · Fecha real: {task.due_at && new Date(task.due_at).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}</p>
      <TaskSnoozeControls task={task} onSaved={update} />
      {isSnoozed(task) && <p className="text-xs text-muted-foreground">El aviso está silenciado hasta esa fecha.</p>}
      {task.delivery_status === "declared" || task.delivery_status === "confirmed" ? <TaskDeliveryControls task={task} onDeclareDelivery={async () => {}} onUndoDelivery={async (id) => update(await api.undoTaskDelivery(id))} /> : <Button size="sm" variant="secondary" onClick={async () => { setError(null); try { update(await api.declareTaskDelivery(task.id, {})); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la entrega."); } }}>Ya la entregué</Button>}
      <Button size="sm" variant="ghost" onClick={() => setDismissed((current) => [...current, task.id])}>Ahora no</Button>
    </article>)}</div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {remaining > 0 && <p className="my-3 text-sm text-muted-foreground">Hay {remaining} tareas vencidas más. Puedes revisarlas en el historial de Tareas; hoy no volveremos a preguntarte por ellas.</p>}
    <Button className="mt-4" onClick={close}>Cerrar · Ahora no (todas)</Button>
  </dialog>;
}
