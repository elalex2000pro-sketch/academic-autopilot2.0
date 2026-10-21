"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoveHorizontal, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course, TimetableEntry } from "@/lib/types";

const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TONE_COUNT = 8;
const MINUTE_HEIGHT = 1.12; // px por minuto: una hora ocupa ~67 px

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

function toMinutes(value: string | null | undefined): number {
  if (!value) return 0;
  const [h, m] = String(value).split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function isBreak(entry: TimetableEntry, name: string): boolean {
  return /recreo|descanso|break|patio/i.test(name);
}

interface PlacedBlock {
  entry: TimetableEntry;
  name: string;
  tone: string;
  breakEntry: boolean;
  start: number;
  end: number;
  /** Columna dentro del día cuando hay clases que se solapan. */
  lane: number;
  lanes: number;
  /** Continúa un bloque del mismo color justo encima / debajo. */
  joinsAbove: boolean;
  joinsBelow: boolean;
}

/**
 * Reparte las clases de un día en carriles cuando se solapan en el tiempo.
 * Antes, dos clases a la misma hora rompían la tabla entera.
 */
function layoutDay(entries: TimetableEntry[], courseNames: Map<string, string>): PlacedBlock[] {
  const items = entries
    .map((entry) => {
      const name = subjectName(entry, courseNames);
      return {
        entry,
        name,
        start: toMinutes(entry.start_time),
        end: toMinutes(entry.end_time),
        tone: isBreak(entry, name)
          ? "tt-tone-break"
          : `tt-tone-${toneIndex(subjectKey(entry, name))}`,
        breakEntry: isBreak(entry, name),
      };
    })
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: PlacedBlock[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.end);
      } else {
        laneEnds[lane] = item.end;
      }
      return { ...item, lane };
    });
    const lanes = Math.max(1, laneEnds.length);
    placed.push(...assigned.map((item) => ({ ...item, lanes, joinsAbove: false, joinsBelow: false })));
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();

  // Une visualmente las clases seguidas de la misma asignatura.
  for (const block of placed) {
    block.joinsAbove = placed.some(
      (other) =>
        other !== block &&
        other.lane === block.lane &&
        other.tone === block.tone &&
        other.end === block.start,
    );
    block.joinsBelow = placed.some(
      (other) =>
        other !== block &&
        other.lane === block.lane &&
        other.tone === block.tone &&
        other.start === block.end,
    );
  }

  return placed;
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

  const validEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          visibleDays.includes(entry.day_of_week) &&
          toMinutes(entry.end_time) > toMinutes(entry.start_time),
      ),
    [entries, visibleDays],
  );

  // Franja visible: de la hora en punto anterior a la primera clase hasta la
  // posterior a la última, para que la rejilla respete el reloj.
  const range = useMemo(() => {
    if (validEntries.length === 0) return null;
    const starts = validEntries.map((entry) => toMinutes(entry.start_time));
    const ends = validEntries.map((entry) => toMinutes(entry.end_time));
    const start = Math.floor(Math.min(...starts) / 60) * 60;
    const end = Math.ceil(Math.max(...ends) / 60) * 60;
    return { start, end, height: (end - start) * MINUTE_HEIGHT };
  }, [validEntries]);

  const days = useMemo(
    () =>
      visibleDays.map((day) => ({
        day,
        blocks: layoutDay(
          validEntries.filter((entry) => entry.day_of_week === day),
          courseNames,
        ),
      })),
    [visibleDays, validEntries, courseNames],
  );

  const hours = useMemo(() => {
    if (!range) return [];
    const list: number[] = [];
    for (let m = range.start; m <= range.end; m += 60) list.push(m);
    return list;
  }, [range]);

  const legend = useMemo(() => {
    const seen = new Map<string, { name: string; tone: string }>();
    for (const entry of validEntries) {
      const name = subjectName(entry, courseNames);
      if (isBreak(entry, name)) continue;
      const key = subjectKey(entry, name);
      if (!seen.has(key)) {
        seen.set(key, { name, tone: `tt-tone-${toneIndex(key)}` });
      }
    }
    return Array.from(seen.values());
  }, [validEntries, courseNames]);

  const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  // Muestra la pista de desplazamiento solo si la semana no cabe entera.
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

  if (!range) return null;

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        role="region"
        aria-label="Horario semanal"
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-[640px]">
          {/* Cabecera de días */}
          <div
            className="sticky top-0 z-20 grid border-b border-border bg-card"
            style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            <div className="sticky left-0 z-30 border-r border-border bg-card" aria-hidden />
            {visibleDays.map((day) => (
              <div
                key={day}
                className={cn(
                  "border-r border-border px-2 py-2 text-center last:border-r-0",
                  day === today && "bg-accent/60",
                )}
              >
                <span
                  className={cn(
                    "block text-[11px] font-semibold uppercase tracking-[0.1em]",
                    day === today ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {DAY_SHORT[day]}
                </span>
                <span className="sr-only">{DAY_LONG[day]}</span>
              </div>
            ))}
          </div>

          {/* Rejilla */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            {/* Columna de horas (fija al desplazar en horizontal) */}
            <div
              className="relative sticky left-0 z-10 border-r border-border bg-card"
              style={{ height: range.height }}
              aria-hidden
            >
              {hours.map((hour) => {
                const isFirst = hour === range.start;
                const isLast = hour === range.end;
                return (
                  <span
                    key={hour}
                    className="tabular absolute right-0 block pr-2 text-[11px] font-medium text-muted-foreground"
                    style={{
                      top: (hour - range.start) * MINUTE_HEIGHT,
                      transform: isFirst
                        ? "translateY(2px)"
                        : isLast
                          ? "translateY(calc(-100% - 2px))"
                          : "translateY(-50%)",
                      width: "100%",
                      textAlign: "right",
                    }}
                  >
                    {formatTime(hour)}
                  </span>
                );
              })}
            </div>

            {days.map(({ day, blocks }) => (
              <div
                key={day}
                className={cn(
                  "relative border-r border-border last:border-r-0",
                  day === today ? "bg-accent/25" : "bg-card",
                )}
                style={{
                  height: range.height,
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, hsl(var(--border)) 0 1px, transparent 1px " +
                    `${(60 * MINUTE_HEIGHT) / 2}px)`,
                }}
              >
                {blocks.map((block) => {
                  const top = (block.start - range.start) * MINUTE_HEIGHT;
                  const height = Math.max((block.end - block.start) * MINUTE_HEIGHT - 2, 20);
                  const width = 100 / block.lanes;
                  const compact = height < 46;
                  return (
                    <div
                      key={block.entry.id}
                      className={cn(
                        "group absolute overflow-hidden border border-black/5 px-2 py-1.5 text-left transition-shadow hover:z-10 hover:shadow-md dark:border-white/10",
                        block.tone,
                        block.joinsAbove ? "rounded-t-none" : "rounded-md",
                        block.joinsBelow ? "rounded-b-none" : "rounded-md",
                        block.breakEntry && "border-dashed",
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${block.lane * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        borderLeft: "3px solid var(--tone-bar)",
                        backgroundColor: "var(--tone-bg)",
                        color: "var(--tone-text)",
                      }}
                      title={`${block.name} · ${formatTime(block.start)}-${formatTime(block.end)}`}
                    >
                      <span className="tabular block text-[10px] font-medium opacity-70">
                        {formatTime(block.start)}–{formatTime(block.end)}
                      </span>
                      <span
                        className={cn(
                          "block font-semibold leading-tight",
                          compact ? "text-[11px]" : "text-[12.5px]",
                          block.breakEntry && "uppercase tracking-[0.08em]",
                        )}
                      >
                        {block.name}
                      </span>
                      {!compact && block.entry.location && (
                        <span className="mt-0.5 block truncate text-[10.5px] opacity-70">
                          {block.entry.location}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(block.entry.id)}
                        title={`Eliminar ${block.name}`}
                        aria-label={`Eliminar ${block.name} de ${DAY_LONG[day]}`}
                        className="absolute right-1 top-1 rounded border border-black/10 bg-card/90 p-1 text-muted-foreground opacity-100 transition-opacity hover:text-destructive focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:border-white/15"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {legend.map((item) => (
            <span
              key={item.name}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                className={cn("h-2.5 w-2.5 rounded-sm", item.tone)}
                style={{ backgroundColor: "var(--tone-bar)" }}
                aria-hidden
              />
              {item.name}
            </span>
          ))}
        </div>
        {overflows && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MoveHorizontal className="h-3.5 w-3.5" aria-hidden />
            Desliza para ver todos los días
          </span>
        )}
      </div>
    </div>
  );
}
