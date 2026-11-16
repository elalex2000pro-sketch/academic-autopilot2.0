import type { Task } from "@/lib/types";
export const TASK_REMINDER_EVENT = "atlantium-task-reminder-changed";
export const REMINDER_ZONE = "Europe/Madrid";
export function reminderDay(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: REMINDER_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function reminderDateAfter(days: number, now = Date.now()): string {
  const date = new Date(`${reminderDay(now)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function isSnoozed(task: Pick<Task, "snoozed_until">, now = Date.now()): boolean {
  return !!task.snoozed_until && reminderDay(Date.parse(task.snoozed_until)) > reminderDay(now);
}
export function isOverdueReminder(task: Task, now = Date.now()): boolean {
  return !task.parent_task_id && task.status !== "completed" && task.status !== "archived" &&
    (!task.delivery_status || task.delivery_status === "none") && isPastSchoolDay(task, now);
}
export function isPastSchoolDay(task: Pick<Task, "due_at">, now = Date.now()): boolean {
  return !!task.due_at && reminderDay(Date.parse(task.due_at)) < reminderDay(now);
}
export function snoozeLabel(task: Task): string | null {
  return task.snoozed_until ? `Aplazada hasta ${reminderDay(Date.parse(task.snoozed_until)).split("-").reverse().join("/")}` : null;
}
