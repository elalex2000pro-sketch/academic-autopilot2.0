"use client";

import { TaskDeliveryControls, type TaskDeliveryActions } from "@/components/task-delivery-controls";
import { groupTaskDeliveries } from "@/lib/task-delivery";
import type { Course, Task } from "@/lib/types";

export function TaskDeliveries({ tasks, courses, ...actions }: TaskDeliveryActions & { tasks: Task[]; courses: Course[] }) {
  const groups = groupTaskDeliveries(tasks);
  const now = Date.now();
  const courseNames = new Map(courses.map((course) => [course.id, course.name]));

  function card(task: Task, pending: boolean) {
    const overdue = pending && task.due_at && Date.parse(task.due_at) < now;
    return (
      <article key={task.id} aria-label={task.title} className={`app-glass-soft min-w-0 space-y-2 rounded-2xl border p-3 ${overdue ? "border-destructive/50" : "border-border"}`}>
        <h4 className="break-words text-sm font-medium text-foreground">{task.title}</h4>
        <p className="text-xs text-muted-foreground">{task.course_id ? courseNames.get(task.course_id) ?? "Sin asignatura" : "Sin asignatura"}</p>
        <p className={overdue ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
          {overdue ? "Vencida · " : ""}{task.due_at ? `Vence: ${new Date(task.due_at).toLocaleString("es-ES")}` : "Sin fecha límite"}
        </p>
        {pending && task.status === "completed" && <p className="text-xs text-muted-foreground">Completada en Atlantium; sin entrega registrada.</p>}
        <TaskDeliveryControls task={task} {...actions} />
      </article>
    );
  }

  return (
    <div className="mt-3 min-w-0 space-y-5">
      <p className="text-xs text-muted-foreground">Marcar una entrega aquí no envía documentos a ninguna plataforma.</p>
      <section aria-label="Por entregar" className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Por entregar ({groups.pending.length})</h3>
        {groups.pending.length ? groups.pending.map((task) => card(task, true)) : <p className="text-xs text-muted-foreground">No hay tareas por entregar.</p>}
      </section>
      <section aria-label="Entregadas" className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Entregadas ({groups.delivered.length})</h3>
        {groups.delivered.length ? groups.delivered.map((task) => card(task, false)) : <p className="text-xs text-muted-foreground">Todavía no hay entregas registradas.</p>}
      </section>
    </div>
  );
}
