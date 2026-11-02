import type { Course, Grade, Task } from "@/lib/types";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** Ventana en la que un examen pendiente se considera "próximo". */
const EXAM_LOOKAHEAD_DAYS = 14;
/** Ventana de entregas: desde 2 días de retraso hasta 3 días de antelación. */
const DEADLINE_PAST_MS = 2 * DAY_MS;
const DEADLINE_FUTURE_MS = 3 * DAY_MS;
/** Una tarea recién creada se muestra como novedad durante una semana. */
const RECENT_TASK_MS = 7 * DAY_MS;
const MAX_UPCOMING = 8;
const MAX_RECENT = 6;

export type NotificationKind = "exam" | "deadline" | "task";
export type NotificationTone = "blue" | "green" | "amber" | "red" | "purple";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  /** Texto corto: "En 2 días", "Vence en 4 h", "Hace 10 min". */
  meta: string;
  href: string;
  tone: NotificationTone;
  /** Instante usado para ordenar los avisos próximos. */
  sortAt: number;
  /** Instante de creación del dato que originó el aviso. */
  createdAt: number;
}

export interface BuildNotificationsInput {
  tasks: Task[];
  grades: Grade[];
  courses: Course[];
  /** Permite congelar el reloj en pruebas. */
  now?: number;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `graded_at` es una fecha sin hora (YYYY-MM-DD). Se interpreta a medianoche
 * local para que "en 2 días" coincida con el calendario del usuario y no con
 * una diferencia de 48 horas exactas.
 */
function parseDateOnly(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() ?? "");
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(date.getTime()) ? date : null;
}

function calendarDayDifference(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((end - start) / DAY_MS);
}

function formatShortDate(value: number): string {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

function formatTaskDue(value: number): string {
  const date = new Date(value);
  const day = date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  const time = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

function formatExamWhen(days: number): string {
  if (days <= 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

function formatElapsed(milliseconds: number): string {
  if (milliseconds < MINUTE_MS) return "hace un momento";
  if (milliseconds < HOUR_MS) {
    return `hace ${Math.max(1, Math.floor(milliseconds / MINUTE_MS))} min`;
  }
  if (milliseconds < DAY_MS) {
    return `hace ${Math.max(1, Math.floor(milliseconds / HOUR_MS))} h`;
  }
  return `hace ${Math.max(1, Math.floor(milliseconds / DAY_MS))} d`;
}

function formatDeadlineWhen(difference: number): string {
  if (difference < 0) return `Venció ${formatElapsed(-difference)}`;
  if (difference < MINUTE_MS) return "Vence ahora";
  if (difference < HOUR_MS) {
    return `Vence en ${Math.max(1, Math.round(difference / MINUTE_MS))} min`;
  }
  if (difference < DAY_MS) {
    return `Vence en ${Math.max(1, Math.round(difference / HOUR_MS))} h`;
  }
  if (difference < 2 * DAY_MS) return "Vence mañana";
  return `Vence en ${Math.max(2, Math.round(difference / DAY_MS))} días`;
}

export function formatNotificationAge(value: number, now = Date.now()): string {
  const difference = now - value;
  if (!Number.isFinite(value)) return "";
  if (difference < 0) return formatShortDate(value);
  if (difference < MINUTE_MS) return "Ahora mismo";
  if (difference < HOUR_MS) {
    return `Hace ${Math.max(1, Math.floor(difference / MINUTE_MS))} min`;
  }
  if (difference < DAY_MS) {
    return `Hace ${Math.max(1, Math.floor(difference / HOUR_MS))} h`;
  }
  if (difference < RECENT_TASK_MS) {
    return `Hace ${Math.max(1, Math.floor(difference / DAY_MS))} d`;
  }
  return formatShortDate(value);
}

function courseName(courseId: string | null, courses: Map<string, Course>): string | null {
  if (!courseId) return null;
  const name = courses.get(courseId)?.name?.trim();
  return name ? name : null;
}

function taskSourceLabel(task: Task): string {
  if (task.source === "moodle") return "Importada de Moodle";
  if (task.source === "google_classroom") return "Importada de Google Classroom";
  return "Añadida por ti";
}

/**
 * Convierte tareas, exámenes y asignaturas en la lista que consume el panel.
 *
 * Los avisos "próximos" (exámenes y entregas) se ordenan por fecha. Las
 * novedades (tareas recién añadidas o importadas) se ordenan de más reciente a
 * más antigua y no repiten una tarea que ya aparece como entrega inminente.
 */
export function buildNotifications({
  tasks,
  grades,
  courses,
  now = Date.now(),
}: BuildNotificationsInput): AppNotification[] {
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const upcoming: AppNotification[] = [];
  const recent: AppNotification[] = [];

  for (const exam of grades) {
    if (!exam.is_exam || exam.score !== null) continue;
    const examDate = parseDateOnly(exam.graded_at);
    if (!examDate) continue;

    const days = calendarDayDifference(new Date(now), examDate);
    if (days < 0 || days > EXAM_LOOKAHEAD_DAYS) continue;

    const subject = courseName(exam.course_id, coursesById);
    const title = subject
      ? `Examen de ${subject}`
      : exam.title.trim()
        ? `Examen: ${exam.title.trim()}`
        : "Examen pendiente";

    upcoming.push({
      id: `exam:${exam.id}`,
      kind: "exam",
      title,
      description: `Pendiente de nota · ${examDate.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
      })}`,
      meta: formatExamWhen(days),
      href: "/academics",
      tone: days <= 2 ? "red" : "purple",
      sortAt: examDate.getTime(),
      createdAt: parseTime(exam.created_at) ?? now,
    });
  }

  const deadlineTaskIds = new Set<string>();

  for (const task of tasks) {
    if (task.status === "completed" || task.status === "archived") continue;
    const due = parseTime(task.due_at);
    if (!due) continue;

    const difference = due - now;
    if (difference < -DEADLINE_PAST_MS || difference > DEADLINE_FUTURE_MS) continue;

    deadlineTaskIds.add(task.id);
    const subject = courseName(task.course_id, coursesById);

    upcoming.push({
      id: `deadline:${task.id}`,
      kind: "deadline",
      title: `Entrega: ${task.title}`,
      description: subject
        ? `${subject} · ${formatTaskDue(due)}`
        : formatTaskDue(due),
      meta: formatDeadlineWhen(difference),
      href: "/planner",
      tone: difference < 0 ? "red" : difference <= DAY_MS ? "amber" : "blue",
      sortAt: due,
      createdAt: parseTime(task.created_at) ?? now,
    });
  }

  for (const task of tasks) {
    if (task.status === "completed" || task.status === "archived") continue;
    if (deadlineTaskIds.has(task.id)) continue;

    const created = parseTime(task.created_at);
    if (!created || now - created > RECENT_TASK_MS) continue;

    const due = parseTime(task.due_at);
    const source = taskSourceLabel(task);

    recent.push({
      id: `task:${task.id}`,
      kind: "task",
      title: task.title,
      description: due ? `${source} · Entrega ${formatShortDate(due)}` : source,
      meta: formatNotificationAge(created, now),
      href: "/planner",
      tone: task.source === "manual" ? "green" : "blue",
      sortAt: created,
      createdAt: created,
    });
  }

  upcoming.sort((left, right) => left.sortAt - right.sortAt);
  recent.sort((left, right) => right.sortAt - left.sortAt);

  return [...upcoming.slice(0, MAX_UPCOMING), ...recent.slice(0, MAX_RECENT)];
}

// --- Estado de "visto" persistente -----------------------------------------

export const NOTIFICATIONS_SEEN_KEY = "academic-autopilot-notifications-seen-v1";
const MAX_SEEN_IDS = 300;

function notificationStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSeenNotificationIds(): string[] {
  const storage = notificationStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(NOTIFICATIONS_SEEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        ),
      ),
    ).slice(-MAX_SEEN_IDS);
  } catch {
    return [];
  }
}

export function writeSeenNotificationIds(ids: readonly string[]): void {
  const storage = notificationStorage();
  if (!storage) return;
  try {
    storage.setItem(
      NOTIFICATIONS_SEEN_KEY,
      JSON.stringify(Array.from(new Set(ids)).slice(-MAX_SEEN_IDS)),
    );
  } catch {
    // La marca de leído es una comodidad: si no se puede guardar, el panel
    // sigue funcionando durante la sesión.
  }
}

export function mergeSeenNotificationIds(
  existing: readonly string[],
  current: readonly string[],
): string[] {
  const merged = [...existing];
  const seen = new Set(existing);
  for (const id of current) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged.slice(-MAX_SEEN_IDS);
}

export function unreadNotificationIds(
  items: readonly AppNotification[],
  seenIds: readonly string[],
): string[] {
  const seen = new Set(seenIds);
  return items.filter((item) => !seen.has(item.id)).map((item) => item.id);
}
