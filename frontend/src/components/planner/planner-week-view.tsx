"use client";

import type * as React from "react";
import type { Dispatch, SetStateAction } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import type { Course, Grade, ImportantDate, Task, TimetableEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WEEKDAYS, courseColor, subjectName, timeLabel, timeToMinutes, type EnrichedClassEvent } from "@/lib/planner";

type Props = {
  weekDays: { date: Date; key: string; weekday: number; }[];
  tasksByDay: Map<string, Task[]>;
  eventsByDay: Map<string, EnrichedClassEvent[]>;
  examsByDay: Map<string, Grade[]>;
  importantByDay: Map<string, ImportantDate[]>;
  entries: TimetableEntry[];
  todayKey: string;
  selectDay: (key: string) => void;
  setViewMode: Dispatch<SetStateAction<"month" | "week" | "day">>;
  courseById: Map<string, Course>;
};

export function PlannerWeekView({
  weekDays,
  tasksByDay,
  eventsByDay,
  examsByDay,
  importantByDay,
  entries,
  todayKey,
  selectDay,
  setViewMode,
  courseById,
}: Props) {
  return (
<div className="animate-planner-in mt-5 overflow-x-auto pb-1">
              <div className="grid min-w-[680px] grid-cols-5 gap-2 sm:min-w-0 sm:gap-2.5 xl:gap-3">
                {weekDays.map((day) => {
                  const dayTasks = tasksByDay.get(day.key) ?? [];
                  const dayEvents = eventsByDay.get(day.key) ?? [];
                  const dayExams = examsByDay.get(day.key) ?? [];
                  const dayImportant = importantByDay.get(day.key) ?? [];
                  const hasClassExam = dayEvents.some((event) => event.is_exam);
                  const dayClasses = entries
                    .filter((entry) => entry.day_of_week === day.weekday)
                    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
                  const dayIsToday = day.key === todayKey;
                  return (
                    <button
                      key={day.key}
                      type="button"
                                            aria-current={dayIsToday ? "date" : undefined}
                      onClick={() => {
                        selectDay(day.key);
                        setViewMode("day");
                      }}
                      className={cn(
                        "group relative flex min-h-[360px] min-w-0 flex-col rounded-2xl border p-2 text-left backdrop-blur-sm transition-all duration-200 ease-mac sm:min-h-[410px] sm:p-2.5",
                        dayIsToday
                          ? "border-[#0066FF]/30 bg-[#0066FF]/[0.065] ring-1 ring-[#0066FF]/15 shadow-[0_0_38px_-18px_rgba(0,102,255,0.7)] dark:border-[#0066FF]/25 dark:bg-[#0066FF]/[0.09]"
                          : "border-white/50 bg-white/25 hover:border-white/70 hover:bg-white/40 dark:border-white/[0.06] dark:bg-white/[0.018] dark:hover:border-white/10 dark:hover:bg-white/[0.04]",
                        dayExams.length > 0 && !dayIsToday && "ring-1 ring-inset ring-[#FF3B30]/25",
                      )}
                    >
                      <span className="flex items-center justify-between gap-1.5 px-0.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-white/35">
                            {WEEKDAYS[day.weekday]}
                          </span>
                          {dayIsToday && (
                            <span className="rounded-full border border-[#0066FF]/20 bg-[#0066FF]/10 px-1.5 py-0.5 text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#0066FF] dark:border-[#0066FF]/25 dark:bg-[#0066FF]/15 dark:text-[#8ab9ff]">
                              Hoy
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums",
                            dayIsToday
                              ? "bg-[#0066FF] text-white"
                              : dayExams.length > 0
                                ? "bg-[#FF3B30]/12 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                                : "text-slate-500 dark:text-white/45",
                          )}
                        >
                          {day.date.getDate()}
                        </span>
                      </span>
                      {dayExams.length > 0 && (
                        <span className="mt-1 flex min-w-0 items-center gap-1 rounded-full bg-[#FF3B30]/10 px-1.5 py-0.5 text-[8.5px] font-semibold text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]">
                          <CalendarClock className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {dayExams.length === 1 ? dayExams[0].title : `${dayExams.length} exámenes`}
                          </span>
                        </span>
                      )}
                      {dayImportant.length > 0 && (
                        <span className="mt-1 flex min-w-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                          <Sparkles className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {dayImportant.length === 1 ? dayImportant[0].title : `${dayImportant.length} fechas`}
                          </span>
                        </span>
                      )}
                      <span className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5">
                        {dayClasses.length === 0 ? (
                          <span className="rounded-lg border border-dashed border-slate-900/[0.06] bg-white/20 px-1.5 py-2.5 text-center text-[9px] leading-3 text-slate-400 dark:border-white/[0.07] dark:bg-white/[0.018] dark:text-white/25">
                            Sin clases
                          </span>
                        ) : (
                          dayClasses.map((entry) => {
                            const course = entry.course_id
                              ? courseById.get(entry.course_id)
                              : undefined;
                            const color = courseColor(entry, course);
                            const name = subjectName(entry, course);
                            return (
                              <span
                                key={entry.id}
                                title={`${name} · ${timeLabel(entry.start_time)}–${timeLabel(entry.end_time)}`}
                                className="min-w-0 overflow-hidden rounded-xl border border-white/60 bg-white/55 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md transition-colors group-hover:bg-white/65 dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:group-hover:bg-white/[0.075]"
                                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                              >
                                <span className="block text-[9px] font-semibold tabular-nums text-slate-400 dark:text-white/35">
                                  {timeLabel(entry.start_time)}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block break-words text-[10.5px] font-semibold leading-4 text-slate-700 dark:text-white/80">
                                  {name}
                                </span>
                              </span>
                            );
                          })
                        )}
                      </span>
                      {(dayTasks.length > 0 || dayEvents.length > 0 || dayExams.length > 0 || dayImportant.length > 0) && (
                        <span className="mt-1 flex flex-wrap items-center gap-1 pt-1 text-[8.5px] font-medium text-slate-500 dark:text-white/35">
                          {dayExams.length > 0 && (
                            <span className="rounded-full bg-[#FF3B30]/10 px-1.5 py-0.5 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]">
                              {dayExams.length === 1 ? "1 examen" : `${dayExams.length} exámenes`}
                            </span>
                          )}
                          {dayImportant.length > 0 && (
                            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                              {dayImportant.length} fecha{dayImportant.length === 1 ? "" : "s"}
                            </span>
                          )}
                          {dayTasks.length > 0 && (
                            <span className="rounded-full bg-[#0066FF]/10 px-1.5 py-0.5 text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#8ab9ff]">
                              {dayTasks.length} tarea{dayTasks.length === 1 ? "" : "s"}
                            </span>
                          )}
                          {dayEvents.length > 0 && (
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5",
                                hasClassExam
                                  ? "bg-[#FF3B30]/10 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                                  : "bg-[#30B0C7]/10 text-[#1f8fa3] dark:bg-[#30B0C7]/15 dark:text-[#6ed4e5]",
                              )}
                            >
                              {dayEvents.length} evento{dayEvents.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
  );
}
