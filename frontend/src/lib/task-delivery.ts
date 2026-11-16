import type { Task } from "@/lib/types";

export function deliveryLabel(task: Task): string {
  if (task.delivery_status === "confirmed") {
    return `Entrega confirmada por ${task.source === "moodle" ? "Moodle" : "Classroom"}`;
  }
  return task.delivery_status === "declared" ? "Entregada (marcada por ti)" : "Sin entrega registrada";
}

export function groupTaskDeliveries(tasks: Task[]): { pending: Task[]; delivered: Task[] } {
  const pending: Task[] = [];
  const delivered: Task[] = [];
  for (const task of tasks) {
    if (task.status === "archived" || task.parent_task_id) continue;
    (task.delivery_status === "declared" || task.delivery_status === "confirmed" ? delivered : pending).push(task);
  }
  pending.sort((a, b) => {
    const aDue = a.due_at ? Date.parse(a.due_at) : Infinity;
    const bDue = b.due_at ? Date.parse(b.due_at) : Infinity;
    return (aDue === bDue ? 0 : aDue - bDue) || a.title.localeCompare(b.title, "es");
  });
  delivered.sort((a, b) => (Date.parse(b.delivered_at ?? "") || 0) - (Date.parse(a.delivered_at ?? "") || 0));
  return { pending, delivered };
}
