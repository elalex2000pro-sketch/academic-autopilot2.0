import { ApiError } from "@/lib/api";
import type { ClassEvent, Course, TimetableEntry } from "@/lib/types";

export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DAYS_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#FF3B30",
  long_project: "#AF52DE",
  short_task: "#0066FF",
};

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  long_project: "Proyecto",
  short_task: "Tarea corta",
};

const SUBJECT_TONES = [
  "#0066FF",
  "#AF52DE",
  "#FF9500",
  "#34C759",
  "#FF2D55",
  "#30B0C7",
  "#5856D6",
  "#8E8E93",
];

export const selectClass =
  "flex h-9 w-full rounded-xl bg-slate-900/[0.035] px-3 text-[13px] text-slate-800 backdrop-blur-3xl transition-[background-color,box-shadow] duration-150 focus-visible:bg-slate-900/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/25 dark:bg-white/[0.055] dark:text-white/90 dark:focus-visible:bg-white/[0.08]";

export type Notice = { tone: "success" | "error" | "info"; text: string };
export type EnrichedClassEvent = ClassEvent & { class_name?: string };

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function keyOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function parseKey(key: string): Date | null {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dayKey(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso.slice(0, 10);
  return keyOf(date.getFullYear(), date.getMonth(), date.getDate());
}

export function longDate(key: string): string {
  const date = parseKey(key);
  if (!date) return key;
  const formatted = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function durationMinutes(start: string, end: string): number {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

export function timeLabel(value: string): string {
  return value.slice(0, 5);
}

export function formatEventRange(event: ClassEvent): string {
  if (event.all_day) return "Todo el día";
  const start = new Date(event.start_at);
  if (!Number.isFinite(start.getTime())) return "";
  const startLabel = start.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!event.end_at) return startLabel;
  const end = new Date(event.end_at);
  if (!Number.isFinite(end.getTime())) return startLabel;
  return `${startLabel}–${end.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function toneFor(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return SUBJECT_TONES[hash % SUBJECT_TONES.length];
}

export function courseColor(entry: TimetableEntry, course: Course | undefined): string {
  return course?.color?.trim() || toneFor(entry.course_id || entry.title || entry.id);
}

function isGenericClassTitle(value: string | null | undefined): boolean {
  const title = (value ?? "").trim();
  return !title || /^clase( lectiva)?$/i.test(title) || title === "Asignatura";
}

export function subjectName(entry: TimetableEntry, course: Course | undefined): string {
  const courseName = course?.name?.trim();
  if (courseName) return courseName;
  if (!isGenericClassTitle(entry.title)) return entry.title!.trim();
  return "Asignatura";
}

export function subjectSubtitle(entry: TimetableEntry, course: Course | undefined): string | null {
  const name = subjectName(entry, course);
  const title = entry.title?.trim();
  if (title && !isGenericClassTitle(title) && title !== name) return title;
  return course?.code?.trim() || null;
}
