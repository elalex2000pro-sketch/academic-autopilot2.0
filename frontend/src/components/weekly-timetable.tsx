"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";

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

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border-2 border-slate-800 shadow-sm dark:border-slate-500">
        <table
          className="w-full border-collapse bg-white text-sm dark:bg-card"
          style={{ minWidth: `${112 + visibleDays.length * 148}px` }}
        >
          <caption className="sr-only">Horario semanal por días y franjas horarias</caption>
          <thead>
            <tr>
              <th
                scope="col"
                aria-label="Hora"
                className="w-28 border border-slate-300 bg-slate-100 px-2 py-3 dark:border-slate-600 dark:bg-slate-800"
              />
              {visibleDays.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="border border-slate-300 bg-slate-50 px-3 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const breakEntries = row.entries.filter((entry) =>
                isBreak(entry, subjectName(entry, courseNames)),
              );
              const fullBreak =
                breakEntries.length > 0 &&
                visibleDays.every((day) => breakEntries.some((entry) => entry.day_of_week === day));

              if (fullBreak) {
                return (
                  <tr key={`${row.start}-${row.end}`}>
                    <th
                      scope="row"
                      className="border border-slate-300 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {rangeLabel(row.start, row.end)}
                    </th>
                    <td
                      colSpan={visibleDays.length}
                      className="tt-tone-break border border-slate-300 px-3 py-3 text-center text-sm font-extrabold uppercase tracking-[0.18em] dark:border-slate-600"
                    >
                      Recreo
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={`${row.start}-${row.end}`}>
                  <th
                    scope="row"
                    className="border border-slate-300 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
                                  "group relative flex min-h-[64px] flex-col items-center justify-center gap-0.5 px-2 py-2 text-center",
                                  tone,
                                )}
                              >
                                <span className="text-sm font-medium leading-tight">{name}</span>
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
                                  className="absolute right-1 top-1 rounded-md bg-white/70 p-1 text-slate-600 opacity-70 shadow-sm transition-opacity hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:bg-slate-900/60 dark:text-slate-200"
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
              );
            })}
          </tbody>
        </table>
      </div>

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
        <span className="text-[11px] text-muted-foreground sm:hidden">
          Desliza para ver todos los días →
        </span>
      </div>
    </div>
  );
}
