import type { Variants } from "framer-motion";

export const STATS_STAGGER: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

export const DASHBOARD_STAGGER: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.14 },
  },
};

export const DASHBOARD_ITEM: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 28 },
  },
};

export const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ff453a",
  long_project: "#bf5af2",
  short_task: "#0a84ff",
};

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function localDateKey(date = new Date()): string {
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function gradeOverTen(percent: number | null | undefined): string {
  return percent === null || percent === undefined || !Number.isFinite(percent)
    ? "—"
    : (percent / 10).toFixed(1);
}

export function parseGradeInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function dayHeading(iso: string): string {
  const target = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  const diff = Math.round((targetDay.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return capitalize(
    target.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );
}

export function isNow(item: { start_at: string; end_at: string }): boolean {
  const now = Date.now();
  return now >= new Date(item.start_at).getTime() && now <= new Date(item.end_at).getTime();
}

export function groupByDay<T extends { start_at: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = new Date(item.start_at).toDateString();
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries());
}
