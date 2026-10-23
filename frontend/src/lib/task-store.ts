import type { Task } from "@/lib/types";

/**
 * Exclusiones persistentes de tareas.
 *
 * El backend es la fuente de verdad, pero un sync (o una copia offline en
 * IndexedDB) puede devolver una tarea que el usuario ya completo o elimino.
 * Estas listas viven en localStorage y se aplican DESPUES de cada lectura para
 * que esa tarea no vuelva a aparecer en la interfaz.
 */
export const COMPLETED_TASK_IDS_KEY = "completedTaskIds";
export const DELETED_TASK_IDS_KEY = "deletedTaskIds";
export const TASK_EXCLUSIONS_EVENT = "autopilot-task-exclusions";

export interface TaskExclusions {
  completedTaskIds: string[];
  deletedTaskIds: string[];
}

export const EMPTY_TASK_EXCLUSIONS: TaskExclusions = {
  completedTaskIds: [],
  deletedTaskIds: [],
};

export type TaskExclusionKind = "completed" | "deleted";

function storageKey(kind: TaskExclusionKind): string {
  return kind === "completed" ? COMPLETED_TASK_IDS_KEY : DELETED_TASK_IDS_KEY;
}

function readIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0)),
    );
  } catch {
    // localStorage puede estar bloqueado o contener JSON corrupto.
    return [];
  }
}

function writeIds(key: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    // Si el almacenamiento esta lleno o bloqueado, la app sigue funcionando
    // durante la sesion; el filtro en memoria se aplica igualmente.
  }
}

function notifyExclusionsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TASK_EXCLUSIONS_EVENT));
}

export function getTaskExclusions(): TaskExclusions {
  return {
    completedTaskIds: readIds(COMPLETED_TASK_IDS_KEY),
    deletedTaskIds: readIds(DELETED_TASK_IDS_KEY),
  };
}

/**
 * Añade o quita un id de la lista persistente. Se escribe inmediatamente, antes
 * de llamar a la API, para que un refresh o un sync posterior no lo reabra.
 */
export function setTaskExclusion(
  kind: TaskExclusionKind,
  taskId: string,
  excluded = true,
): TaskExclusions {
  if (typeof window === "undefined") return EMPTY_TASK_EXCLUSIONS;

  const key = storageKey(kind);
  const current = readIds(key);
  const wasExcluded = current.includes(taskId);
  if (wasExcluded === excluded) return getTaskExclusions();

  const next = excluded
    ? [...current, taskId]
    : current.filter((id) => id !== taskId);
  writeIds(key, next);
  notifyExclusionsChanged();
  return getTaskExclusions();
}

export function markTaskCompleted(taskId: string): TaskExclusions {
  return setTaskExclusion("completed", taskId, true);
}

export function markTaskDeleted(taskId: string): TaskExclusions {
  return setTaskExclusion("deleted", taskId, true);
}

export function restoreTaskExclusion(kind: TaskExclusionKind, taskId: string): TaskExclusions {
  return setTaskExclusion(kind, taskId, false);
}

export function clearTaskExclusions(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COMPLETED_TASK_IDS_KEY);
    window.localStorage.removeItem(DELETED_TASK_IDS_KEY);
  } catch {
    // Nada que limpiar.
  }
  notifyExclusionsChanged();
}

/** Filtra las tareas descargadas antes de que lleguen al estado de la UI. */
export function applyTaskExclusions<T extends Pick<Task, "id">>(
  tasks: T[],
  exclusions: TaskExclusions = getTaskExclusions(),
): T[] {
  const excluded = new Set([
    ...exclusions.completedTaskIds,
    ...exclusions.deletedTaskIds,
  ]);
  if (excluded.size === 0) return tasks;
  return tasks.filter((task) => !excluded.has(task.id));
}

/** Una tarea esta vencida si su fecha limite ya paso y sigue sin completarse. */
export function isTaskExpired(
  task: Pick<Task, "due_at" | "status">,
  now: number = Date.now(),
): boolean {
  if (task.status === "completed" || task.status === "archived" || !task.due_at) {
    return false;
  }
  const due = new Date(task.due_at).getTime();
  return Number.isFinite(due) && due < now;
}

export interface TaskPartition<T extends Task> {
  /** Tareas que deben verse en la lista principal. */
  active: T[];
  /** Tareas vencidas: solo aparecen en el historial secundario. */
  overdue: T[];
  /** Completadas que sigan presentes en la respuesta de la API. */
  completed: T[];
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  long_project: 1,
  short_task: 2,
};

export function sortTasksForList<T extends Task>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const priority =
      (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (priority !== 0) return priority;
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return a.title.localeCompare(b.title, "es");
  });
}

/**
 * Separa tareas activas, vencidas y completadas. Las vencidas nunca forman
 * parte de `active`, aunque la preferencia de tachado este desactivada.
 */
export function partitionTasks<T extends Task>(
  tasks: T[],
  now: number = Date.now(),
): TaskPartition<T> {
  const active: T[] = [];
  const overdue: T[] = [];
  const completed: T[] = [];

  for (const task of tasks) {
    if (task.status === "archived") continue;
    if (task.status === "completed") {
      completed.push(task);
    } else if (isTaskExpired(task, now)) {
      overdue.push(task);
    } else {
      active.push(task);
    }
  }

  return {
    active: sortTasksForList(active),
    overdue: sortTasksForList(overdue),
    completed: sortTasksForList(completed),
  };
}
