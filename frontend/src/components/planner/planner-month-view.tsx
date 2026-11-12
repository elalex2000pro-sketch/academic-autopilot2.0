"use client";

import type * as React from "react";
import { Clock } from "lucide-react";
import type { Grade, ImportantDate, Task, TimetableEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PRIORITY_COLOR, WEEKDAYS, longDate, weekdayIndex, type EnrichedClassEvent } from "@/lib/planner";

type Props = {
  monthCells: ({ day: number; key: string; } | null)[];
  tasksByDay: Map<string, Task[]>;
  eventsByDay: Map<string, EnrichedClassEvent[]>;
  examsByDay: Map<string, Grade[]>;
  importantByDay: Map<string, ImportantDate[]>;
  entries: TimetableEntry[];
  cursor: Date;
  selectedDay: string;
  todayKey: string;
  selectDay: (key: string) => void;
};

export function PlannerMonthView({
  monthCells,
  tasksByDay,
  eventsByDay,
  examsByDay,
  importantByDay,
  entries,
  cursor,
  selectedDay,
  todayKey,
  selectDay,
}: Props) {
  return (
<div className="animate-planner-in mt-5 pb-1">
              <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-1.5">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="pb-1 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30"
                  >
                    {day}
                  </div>
                ))}
                {monthCells.map((cell, index) => {
                  if (!cell) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="min-h-[58px] rounded-2xl border border-transparent sm:min-h-[112px] md:min-h-[128px]"
                      />
                    );
                  }
                  const dayTasks = tasksByDay.get(cell.key) ?? [];
                  const dayEvents = eventsByDay.get(cell.key) ?? [];
                  const dayExams = examsByDay.get(cell.key) ?? [];
                  const dayImportant = importantByDay.get(cell.key) ?? [];
                  const dayClasses = entries.filter(
                    (entry) =>
                      entry.day_of_week ===
                      weekdayIndex(new Date(cursor.getFullYear(), cursor.getMonth(), cell.day)),
                  );
                  const chips = [
                    ...dayExams.map((exam) => ({
                      id: `exam-${exam.id}`,
                      label: exam.title,
                      color: "#FF3B30",
                    })),
                    ...dayImportant.map((event) => ({
                      id: `important-${event.id}`,
                      label: event.title,
                      color: "#C77700",
                    })),
                    ...dayTasks.map((task) => ({
                      id: `task-${task.id}`,
                      label: task.title,
                      color: PRIORITY_COLOR[task.priority] ?? "#0066FF",
                    })),
                    ...dayEvents.map((event) => ({
                      id: `class-event-${event.id}`,
                      label: event.title,
                      color: event.is_exam ? "#FF3B30" : "#30B0C7",
                    })),
                  ];
                  const visible = chips.slice(0, 3);
                  const extra = chips.length - visible.length;
                  const selected = cell.key === selectedDay;
                  const todayCell = cell.key === todayKey;
                  const weekendCell =
                    weekdayIndex(new Date(cursor.getFullYear(), cursor.getMonth(), cell.day)) >= 5;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => selectDay(cell.key)}
                      aria-pressed={selected}
                      aria-current={todayCell ? "date" : undefined}
                      aria-label={`${longDate(cell.key)}: ${dayExams.length} exámenes, ${dayTasks.length} tareas, ${dayImportant.length} fechas importantes`}
                      title={
                        chips.length > 0
                          ? chips.map((chip) => chip.label).join(" · ")
                          : undefined
                      }
                      className={cn(
                        "group flex min-h-[58px] min-w-0 flex-col rounded-2xl border p-1.5 text-left transition-all duration-200 ease-mac sm:min-h-[112px] sm:p-2.5 md:min-h-[128px]",
                        selected
                          ? "border-[#0066FF] bg-[#0066FF]/[0.055] shadow-[0_0_0_1px_rgba(0,102,255,0.14)] dark:bg-[#0066FF]/[0.08]"
                          : todayCell
                            ? "border-[#0066FF]/30 bg-[#0066FF]/[0.035] hover:bg-[#0066FF]/[0.06] dark:border-[#0066FF]/25 dark:bg-[#0066FF]/[0.055]"
                            : weekendCell
                              ? "border-white/35 bg-slate-900/[0.018] hover:border-white/60 hover:bg-white/30 dark:border-white/[0.05] dark:bg-white/[0.012] dark:hover:border-white/10 dark:hover:bg-white/[0.03]"
                              : "border-white/50 bg-white/25 hover:border-white/70 hover:bg-white/40 dark:border-white/[0.06] dark:bg-white/[0.018] dark:hover:border-white/10 dark:hover:bg-white/[0.04]",
                      )}
                    >
                      <span className="flex items-center justify-between gap-1.5">
                        <span
                          className={cn(
                            "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums sm:h-7 sm:min-w-7 sm:text-[12px]",
                            todayCell
                              ? "bg-[#0066FF] text-white"
                              : selected
                                ? "bg-[#0066FF]/12 text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#8ab9ff]"
                                : "text-slate-600 dark:text-white/60",
                          )}
                        >
                          {cell.day}
                        </span>
                        {todayCell && (
                          <span className="hidden rounded-full bg-[#0066FF]/10 px-1.5 py-0.5 text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#0066FF] dark:bg-[#0066FF]/15 dark:text-[#8ab9ff] sm:inline">
                            Hoy
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 hidden min-h-0 flex-1 flex-col gap-1 sm:flex">
                        {visible.map((chip) => (
                          <span
                            key={chip.id}
                            className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[9.5px] font-medium leading-3"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${chip.color} 11%, transparent)`,
                              color: chip.color,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: chip.color }}
                            />
                            <span className="truncate">{chip.label}</span>
                          </span>
                        ))}
                        {extra > 0 && (
                          <span className="px-1.5 text-[8.5px] font-medium text-slate-400 dark:text-white/30">
                            +{extra} más
                          </span>
                        )}
                        {chips.length === 0 && (
                          <span className="px-1 text-[9px] text-slate-300 dark:text-white/15">—</span>
                        )}
                      </span>
                      {chips.length > 0 && (
                        <span
                          aria-hidden="true"
                          className="mt-1 flex flex-wrap items-center gap-0.5 sm:hidden"
                        >
                          {chips.slice(0, 4).map((chip) => (
                            <span
                              key={chip.id}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: chip.color }}
                            />
                          ))}
                          {chips.length > 4 && (
                            <span className="text-[7px] font-semibold text-slate-400 dark:text-white/30">
                              +{chips.length - 4}
                            </span>
                          )}
                        </span>
                      )}
                      {dayClasses.length > 0 && (
                        <span className="mt-1 hidden items-center gap-1 truncate border-t border-slate-900/[0.045] pt-1 text-[8.5px] font-medium text-slate-400 dark:border-white/[0.05] dark:text-white/30 sm:flex">
                          <Clock className="h-2.5 w-2.5 shrink-0" />
                          {dayClasses.length} clase{dayClasses.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
  );
}
