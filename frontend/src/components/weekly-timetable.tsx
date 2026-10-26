"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MoveHorizontal, Pencil, Trash2 } from "lucide-react";

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
  onEdit,
  selectedId,
  onSelect,
}: {
  entries: TimetableEntry[];
  courses: Course[];
  onDelete: (id: string) => void;
  /** Si se indica, cada franja muestra un lápiz para editarla. */
  onEdit?: (entry: TimetableEntry) => void;
  /** Franja seleccionada desde el planificador. */
  selectedId?: string | null;
  /** Permite seleccionar una franja al pulsarla. */
  onSelect?: (id: string) => void;
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
        className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
      >
        <div className="min-w-[640px]">
          {/* Cabecera de días */}
          <div
            className="sticky top-0 z-20 grid border-b border-separator bg-card"
            style={{ gridTemplateColumns: `52px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            <div className="sticky left-0 z-30 border-r border-separator bg-card" aria-hidden />
            {visibleDays.map((day) => (
              <div
                key={day}
                className={cn(
                  "border-r border-separator px-2 py-2.5 text-center last:border-r-0",
                  day === today && "bg-primary/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "block text-[11px] font-semibold uppercase tracking-[0.06em]",
                    day === today ? "text-[#ff3b30]" : "text-muted-foreground",
                  )}
                >
                  {DAY_SHORT[day]}
                </span>
                {day === today && (
                  <span className="mx-auto mt-1 block h-1 w-1 rounded-full bg-[#ff3b30]" />
                )}
                <span className="sr-only">{DAY_LONG[day]}</span>
              </div>
            ))}
          </div>

          {/* Rejilla */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `52px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            {/* Columna de horas (fija al desplazar en horizontal) */}
            <div
              className="relative sticky left-0 z-10 border-r border-separator bg-card"
              style={{ height: range.height }}
              aria-hidden
            >
              {hours.map((hour) => {
                const isFirst = hour === range.start;
                const isLast = hour === range.end;
                return (
                  <span
                    key={hour}
                    className="tabular absolute right-0 block pr-2 text-[10.5px] font-normal text-muted-foreground/85"
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
                  "relative border-r border-separator last:border-r-0",
                  day === today ? "bg-primary/[0.035]" : "bg-card",
                )}
                style={{
                  height: range.height,
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, hsl(var(--border) / 0.55) 0 1px, transparent 1px " +
                    `${(60 * MINUTE_HEIGHT) / 2}px), repeating-linear-gradient(to bottom, hsl(var(--border) / 0.95) 0 1px, transparent 1px ${60 * MINUTE_HEIGHT}px)`,
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
                      onClick={() => onSelect?.(block.entry.id)}
                      className={cn(
                        "group absolute overflow-hidden border px-1.5 py-1 text-left transition-shadow hover:z-10 hover:shadow-md",
                        block.tone,
                        "border-black/[0.06] dark:border-white/10",
                        block.joinsAbove ? "rounded-t-none" : "rounded-[5px]",
                        block.joinsBelow ? "rounded-b-none" : "rounded-[5px]",
                        block.breakEntry && "border-dashed border-white/25",
                        onSelect && "cursor-pointer",
                        selectedId === block.entry.id &&
                          "z-10 ring-2 ring-white/90 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.65)]",
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${block.lane * width}% + 1.5px)`,
                        width: `calc(${width}% - 3px)`,
                        backgroundColor: "var(--tone-bg)",
                        color: "var(--tone-text)",
                      }}
                      title={`${block.name} · ${formatTime(block.start)}-${formatTime(block.end)}`}
                    >
                      <span className="tabular block text-[10px] font-medium opacity-80">
                        {formatTime(block.start)}–{formatTime(block.end)}
                      </span>
                      <span
                        className={cn(
                          "block font-semibold leading-tight",
                          compact ? "text-[11px]" : "text-[12px]",
                          block.breakEntry && "uppercase tracking-[0.06em]",
                        )}
                      >
                        {block.name}
                      </span>
                      {!compact && block.entry.location && (
                        <span className="mt-0.5 block truncate text-[10.5px] opacity-80">
                          {block.entry.location}
                        </span>
                      )}
                      <div
                        className={cn(
                          "absolute right-1 top-1 flex items-center gap-0.5 transition-opacity",
                          selectedId === block.entry.id
                            ? "opacity-100"
                            : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                        )}
                      >
                        {onEdit && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEdit(block.entry);
                            }}
                            title={`Editar ${block.name}`}
                            aria-label={`Editar ${block.name} de ${DAY_LONG[day]}`}
                            className="rounded-[4px] bg-black/15 p-1 text-white/80 transition-colors hover:bg-black/30 hover:text-white focus:opacity-100"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(block.entry.id);
                          }}
                          title={`Eliminar ${block.name}`}
                          aria-label={`Eliminar ${block.name} de ${DAY_LONG[day]}`}
                          className="rounded-[4px] bg-black/15 p-1 text-white/80 transition-colors hover:bg-black/30 hover:text-white focus:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
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
                className={cn("h-2 w-2 rounded-full", item.tone)}
                style={{ backgroundColor: "var(--tone-bg)" }}
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
