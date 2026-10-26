import type { Course, TimetableEntry } from "@/lib/types";

/**
 * Horario personalizado del planificador.
 *
 * El backend sigue siendo el origen de los datos sincronizados, pero la vista
 * permite editar las franjas sin un endpoint PATCH. Por eso el horario
 * personalizado vive en localStorage y tiene prioridad sobre la copia del
 * servidor. La importación de horarios sigue usando la API y, al terminar,
 * vuelca el resultado en esta misma copia local.
 */
export const CUSTOM_TIMETABLE_KEY = "customTimetable";
export const CUSTOM_TIMETABLE_EVENT = "autopilot-custom-timetable";

/** Asignaturas oficiales de 1.º SMR (mismas que backend/seed_horario.py). */
export const OFFICIAL_SMR_SUBJECTS = [
  "Aplicaciones Ofimáticas",
  "Redes Locales",
  "Montaje y Mantenimiento de Equipos",
  "Sistemas Operativos Monopuesto",
  "Itinerario Personal para la Empleabilidad I",
  "Sostenibilidad Aplicada al Sistema Productivo",
  "Digitalización Aplicada a los Sectores Productivos",
] as const;

export type OfficialSMRSubject = (typeof OFFICIAL_SMR_SUBJECTS)[number];

/**
 * (día 0 = lunes … 4 = viernes, inicio, fin, asignatura)
 * Fuente: backend/seed_horario.py.
 */
export const OFFICIAL_SMR_SCHEDULE: ReadonlyArray<
  readonly [day: number, start: string, end: string, subject: OfficialSMRSubject]
> = [
  // Lunes
  [0, "08:15", "09:15", "Aplicaciones Ofimáticas"],
  [0, "09:15", "10:15", "Aplicaciones Ofimáticas"],
  [0, "10:15", "11:15", "Redes Locales"],
  [0, "11:45", "12:45", "Redes Locales"],
  [0, "12:45", "13:45", "Montaje y Mantenimiento de Equipos"],
  [0, "13:45", "14:45", "Montaje y Mantenimiento de Equipos"],
  // Martes
  [1, "08:15", "09:15", "Montaje y Mantenimiento de Equipos"],
  [1, "09:15", "10:15", "Sistemas Operativos Monopuesto"],
  [1, "10:15", "11:15", "Sistemas Operativos Monopuesto"],
  [1, "11:45", "12:45", "Aplicaciones Ofimáticas"],
  [1, "12:45", "13:45", "Itinerario Personal para la Empleabilidad I"],
  [1, "13:45", "14:45", "Redes Locales"],
  // Miércoles
  [2, "08:15", "09:15", "Montaje y Mantenimiento de Equipos"],
  [2, "09:15", "10:15", "Sistemas Operativos Monopuesto"],
  [2, "10:15", "11:15", "Aplicaciones Ofimáticas"],
  [2, "11:45", "12:45", "Aplicaciones Ofimáticas"],
  [2, "12:45", "13:45", "Redes Locales"],
  [2, "13:45", "14:45", "Redes Locales"],
  // Jueves
  [3, "08:15", "09:15", "Aplicaciones Ofimáticas"],
  [3, "09:15", "10:15", "Aplicaciones Ofimáticas"],
  [3, "10:15", "11:15", "Redes Locales"],
  [3, "11:45", "12:45", "Itinerario Personal para la Empleabilidad I"],
  [3, "12:45", "13:45", "Montaje y Mantenimiento de Equipos"],
  [3, "13:45", "14:45", "Montaje y Mantenimiento de Equipos"],
  // Viernes
  [4, "08:15", "09:15", "Sostenibilidad Aplicada al Sistema Productivo"],
  [4, "09:15", "10:15", "Digitalización Aplicada a los Sectores Productivos"],
  [4, "10:15", "11:15", "Redes Locales"],
  [4, "11:45", "12:45", "Itinerario Personal para la Empleabilidad I"],
  [4, "12:45", "13:45", "Sistemas Operativos Monopuesto"],
  [4, "13:45", "14:45", "Sistemas Operativos Monopuesto"],
];

export interface LocalTimetableInput {
  course_id: string | null;
  title: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function normalizeEntry(value: unknown): TimetableEntry | null {
  if (!isRecord(value)) return null;

  const id = cleanText(value.id);
  if (!id) return null;

  const day = value.day_of_week;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) {
    return null;
  }

  const start = typeof value.start_time === "string" ? value.start_time.slice(0, 5) : "";
  const end = typeof value.end_time === "string" ? value.end_time.slice(0, 5) : "";
  if (!isTime(start) || !isTime(end) || toMinutes(end) <= toMinutes(start)) {
    return null;
  }

  return {
    id,
    course_id: cleanText(value.course_id),
    title: cleanText(value.title),
    day_of_week: day,
    start_time: start,
    end_time: end,
    location: cleanText(value.location),
  };
}

function sortEntries(entries: TimetableEntry[]): TimetableEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.day_of_week - b.day_of_week ||
      toMinutes(a.start_time) - toMinutes(b.start_time) ||
      toMinutes(a.end_time) - toMinutes(b.end_time),
  );
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function courseIdForSubject(subject: string, courses: Course[]): string | null {
  const target = normalizeName(subject);
  const match = courses.find((course) => normalizeName(course.name) === target);
  return match?.id ?? null;
}

/**
 * Devuelve el horario guardado en este navegador o `null` si nunca se ha
 * personalizado. Un array vacío es válido: significa que el usuario borró
 * todas las franjas y no debe recuperarse el horario del servidor.
 */
export function loadCustomTimetable(): TimetableEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOM_TIMETABLE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const entries = parsed
      .map(normalizeEntry)
      .filter((entry): entry is TimetableEntry => entry !== null);

    // Si había datos pero ninguno es válido, es preferible volver al servidor
    // antes que mostrar un horario vacío por un JSON corrupto.
    if (parsed.length > 0 && entries.length === 0) return null;
    return sortEntries(entries);
  } catch {
    // localStorage puede estar bloqueado o contener JSON corrupto.
    return null;
  }
}

/** Guarda el horario completo. Devuelve false si el navegador no lo permite. */
export function saveCustomTimetable(entries: TimetableEntry[], notify = true): boolean {
  if (typeof window === "undefined") return false;

  let stored = false;
  try {
    window.localStorage.setItem(CUSTOM_TIMETABLE_KEY, JSON.stringify(sortEntries(entries)));
    stored = true;
  } catch {
    // Cuota llena o almacenamiento bloqueado: la sesión actual sigue en memoria.
  }

  if (stored && notify) {
    window.dispatchEvent(new CustomEvent(CUSTOM_TIMETABLE_EVENT));
  }
  return stored;
}

/** Elimina la personalización para volver al horario que sirve la API. */
export function clearCustomTimetable(notify = true): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CUSTOM_TIMETABLE_KEY);
    if (notify) window.dispatchEvent(new CustomEvent(CUSTOM_TIMETABLE_EVENT));
  } catch {
    // Nada que limpiar.
  }
}

/** Construye las 30 franjas oficiales de 1.º SMR. */
export function buildOfficialTimetable(courses: Course[] = []): TimetableEntry[] {
  return OFFICIAL_SMR_SCHEDULE.map(([day, start, end, subject], index) => ({
    id: `official-${index}`,
    course_id: courseIdForSubject(subject, courses),
    title: subject,
    day_of_week: day,
    start_time: start,
    end_time: end,
    location: null,
  }));
}

/** Restaura y persiste el horario oficial de 1.º SMR. */
export function resetCustomTimetable(courses: Course[] = []): TimetableEntry[] {
  const entries = buildOfficialTimetable(courses);
  if (!saveCustomTimetable(entries)) {
    throw new Error("No se pudo guardar el horario en este navegador.");
  }
  return entries;
}

/** Crea una franja nueva con un id local estable. */
export function createLocalTimetableEntry(input: LocalTimetableInput): TimetableEntry {
  return {
    id: createLocalId(),
    course_id: input.course_id,
    title: input.title,
    day_of_week: input.day_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    location: input.location,
  };
}

/** Las franjas oficiales y las creadas en local no existen en el backend. */
export function isLocalTimetableEntry(entry: Pick<TimetableEntry, "id">): boolean {
  return entry.id.startsWith("local-") || entry.id.startsWith("official-");
}

/**
 * Rellena `course_id` cuando la franja se guardó solo con el nombre (por
 * ejemplo, al restablecer el horario desde Ajustes sin conexión).
 */
export function hydrateTimetableCourses(
  entries: TimetableEntry[],
  courses: Course[],
): TimetableEntry[] {
  if (courses.length === 0) return entries;

  let changed = false;
  const next = entries.map((entry) => {
    if (entry.course_id) return entry;
    const title = entry.title?.trim();
    if (!title) return entry;

    const courseId = courseIdForSubject(title, courses);
    if (!courseId) return entry;

    changed = true;
    return { ...entry, course_id: courseId };
  });

  return changed ? next : entries;
}
