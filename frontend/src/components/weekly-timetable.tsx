"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoveHorizontal, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course, TimetableEntry } from "@/lib/types";

const DAY_LABELS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
const TONE_COUNT = 8;

function subjectName(entry: TimetableEntry, courseNames: Map<string, string>): string {
  const courseName = entry.course_id ? courseNames.get(entry.course_id) : null;
  return courseName?.trim() || entry.title?.trim() || "Clase";
}

function subjectKey(entry: TimetableEntry, name: string): string {
  return entry.course_id ?? name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toneIndex(key: string): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash % TONE_COUNT;
}

function shortTime(value: string): string {
  const [hour, minute] = value.split(":");
  return `${Number(hour)}:${minute}`;
}

function rangeLabel(start: string, end: string): string {
  return `${shortTime(start)}-${shortTime(end)}`;
}

function isBreak(entry: TimetableEntry, name: string): boolean {
  return /recreo|descanso|break/i.test(name);
}

export function WeeklyTimetable({
  entries,
  courses,
  onDelete,
}: {
  entries: TimetableEntry[];
  courses: Course[];
  onDelete: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  const courseNames = useMemo(
    () => new Map(courses.map((course) => [course.id, course.name])),
    [courses],
  );

  const visibleDays = useMemo(() => {
    const days = [0, 1, 2, 3, 4];
    if (entries.some((entry) => entry.day_of_week === 5)) days.push(5);
    if (entries.some((entry) => entry.day_of_week === 6)) days.push(6);
    return days;
  }, [entries]);

  const rows = useMemo(() => {
    const grouped = new Map<
      string,
      { start: string; end: string; entries: TimetableEntry[] }
    >();
    for (const entry of entries) {
      if (!visibleDays.includes(entry.day_of_week)) continue;
      const key = `${entry.start_time}|${entry.end_time}`;
      const row = grouped.get(key);
      if (row) row.entries.push(entry);
      else grouped.set(key, { start: entry.start_time, end: entry.end_time, entries: [entry] });
    }
    return Array.from(grouped.values()).sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
    );
  }, [entries, visibleDays]);

  const legend = useMemo(() => {
    const seen = new Map<string, { name: string; tone: number }>();
    for (const entry of entries) {
      const name = subjectName(entry, courseNames);
      if (isBreak(entry, name)) continue;
      const key = subjectKey(entry, name);
      if (!seen.has(key)) seen.set(key, { name, tone: toneIndex(key) });
    }
    return Array.from(seen.values());
  }, [entries, courseNames]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const update = () => setOverflows(node.scrollWidth > node.clientWidth + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [entries, visibleDays.length]);

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        role="region"
        aria-label="Horario semanal"
        tabIndex={0}
        className="overflow-x-auto rounded-2xl border-2 border-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-500 dark:focus-visible:ring-offset-background [scrollbar-width:thin]"
      >
        <table
          className="w-full border-collapse bg-white text-sm dark:bg-card"
          style={{ minWidth: `${88 + visibleDays.length * 112}px` }}
        >
          <caption className="sr-only">Horario semanal por días y franjas horarias</caption>
          <thead>
            <tr>
              <th
                scope="col"
                aria-label="Hora"
                className="sticky left-0 z-20 w-[88px] min-w-[88px] border border-slate-300 bg-slate-100 px-1.5 py-3 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.25)] dark:border-slate-600 dark:bg-slate-800"
              />
              {visibleDays.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="border border-slate-300 bg-slate-50 px-2 py-3 text-center text-[11px] font-extrabold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:text-xs"
                >
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.start}-${row.end}`}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-[88px] min-w-[88px] whitespace-nowrap border border-slate-300 bg-slate-50 px-1.5 py-2 text-center text-[11px] font-semibold text-slate-600 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.25)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {rangeLabel(row.start, row.end)}
                </th>
                {visibleDays.map((day) => {
                  const cellEntries = row.entries.filter((entry) => entry.day_of_week === day);
                  return (
                    <td
                      key={day}
                      className="border border-slate-300 p-0 align-middle dark:border-slate-600"
                    >
                      {cellEntries.length === 0 ? (
                        <div className="min-h-[64px] bg-white dark:bg-card" />
                      ) : (
                        cellEntries.map((entry) => {
                          const name = subjectName(entry, courseNames);
                          const breakEntry = isBreak(entry, name);
                          const tone = breakEntry
                            ? "tt-tone-break"
                            : `tt-tone-${toneIndex(subjectKey(entry, name))}`;
                          return (
                            <div
                              key={entry.id}
                              className={cn(
                                "group relative flex min-h-[64px] flex-col items-center justify-center gap-0.5 px-1.5 py-2 text-center",
                                tone,
                              )}
                            >
                              <span
                                className={cn(
                                  "break-words leading-tight",
                                  breakEntry
                                    ? "text-[11px] font-extrabold uppercase tracking-[0.12em]"
                                    : "text-[12px] font-medium sm:text-[13px]",
                                )}
                              >
                                {name}
                              </span>
                              {entry.location && (
                                <span className="text-[10px] font-medium opacity-70">
                                  {entry.location}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onDelete(entry.id)}
                                title={`Eliminar ${name}`}
                                aria-label={`Eliminar ${name}`}
                                className="absolute right-0.5 top-0.5 rounded-md bg-white/80 p-0.5 text-slate-600 opacity-60 shadow-sm transition-opacity hover:bg-white hover:opacity-100 focus:opacity-100 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900 lg:opacity-0 lg:group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {legend.map((item) => (
            <span
              key={item.name}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", `tt-tone-${item.tone}`)} />
              {item.name}
            </span>
          ))}
        </div>
        {overflows && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <MoveHorizontal className="h-3.5 w-3.5" aria-hidden />
            Desliza para ver todos los días
          </span>
        )}
      </div>
    </div>
  );
}
