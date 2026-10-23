import type { Task } from "@/lib/types";

/** Una tarea esta vencida si tiene fecha limite pasada y aun no se ha completado. */
export function isTaskOverdue(
  task: Pick<Task, "due_at" | "status">,
  now: number = Date.now(),
): boolean {
  if (task.status === "completed" || task.status === "archived" || !task.due_at) return false;
  const due = new Date(task.due_at).getTime();
  return Number.isFinite(due) && due < now;
}

/**
 * Clases del titulo de una tarea. El tachado de vencidas solo se aplica cuando
 * la preferencia global esta activa; las completadas siempre quedan tachadas.
 */
export function taskTitleClass(
  task: Pick<Task, "due_at" | "status">,
  autoStrikeOverdue: boolean,
): string {
  if (task.status === "completed") {
    return "line-through opacity-50 text-slate-400 dark:text-white/30";
  }
  if (autoStrikeOverdue && isTaskOverdue(task)) {
    return "line-through opacity-50 text-rose-500/80 dark:text-rose-300/70";
  }
  return "text-slate-700 group-hover:text-slate-900 dark:text-white/80 dark:group-hover:text-white/95";
}

/** Texto corto y humano para la fecha de entrega. */
export function formatDueLabel(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Sin fecha";

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs < 0) {
    const hours = Math.max(1, Math.round(Math.abs(diffMs) / 3_600_000));
    if (hours < 24) return `Vencida hace ${hours} h`;
    const days = Math.max(1, Math.round(hours / 24));
    return `Vencida hace ${days} d`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(date);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) {
    return `Vence hoy a las ${date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  if (diffDays === 1) return "Vence mañana";
  if (diffDays < 7) return `En ${diffDays} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
