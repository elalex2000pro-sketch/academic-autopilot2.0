"use client";

import type * as React from "react";
import type { Dispatch, SetStateAction } from "react";
import { ChevronRight, Loader2, Trash2 } from "lucide-react";
import { type ExamDialogMode } from "@/components/exam-dialog";
import { Button } from "@/components/ui/button";
import { examDateKey } from "@/lib/exams";
import type { Course, Grade, ImportantDate, Task } from "@/lib/types";
import { MONTHS, longDate, parseKey } from "@/lib/planner";

type Props = {
  selectedDay: string;
  setViewMode: Dispatch<SetStateAction<"month" | "week" | "day">>;
  selectedExams: Grade[];
  selectedTasks: Task[];
  selectedImportantDates: ImportantDate[];
  importantDates: ImportantDate[];
  removeImportantDate: (id: string) => Promise<void>;
  deletingImportantId: string | null;
  upcomingExams: Grade[];
  today: Date;
  courseById: Map<string, Course>;
  openExamDialog: (mode: ExamDialogMode, exam: Grade) => void;
};

export function PlannerOverview({
  selectedDay,
  setViewMode,
  selectedExams,
  selectedTasks,
  selectedImportantDates,
  importantDates,
  removeImportantDate,
  deletingImportantId,
  upcomingExams,
  today,
  courseById,
  openExamDialog,
}: Props) {
  return (
<>
<section className="app-glass-soft rounded-[26px] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                  Día seleccionado
                </p>
                <h3 className="mt-1 truncate text-[14px] font-semibold text-slate-800 dark:text-white/90">
                  {longDate(selectedDay)}
                </h3>
              </div>
              <Button variant="outline" size="sm" className="h-7 shrink-0 px-2" onClick={() => setViewMode("day")}>
                Ver agenda
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-xl bg-[#FF3B30]/[0.07] px-1 py-2 dark:bg-[#FF3B30]/10">
                <p className="text-[15px] font-semibold tabular-nums text-[#d92b22] dark:text-[#ff8a80]">{selectedExams.length}</p>
                <p className="mt-0.5 text-[8.5px] font-medium uppercase tracking-[0.06em] text-slate-400 dark:text-white/30">Exámenes</p>
              </div>
              <div className="rounded-xl bg-[#0066FF]/[0.07] px-1 py-2 dark:bg-[#0066FF]/10">
                <p className="text-[15px] font-semibold tabular-nums text-[#0066FF] dark:text-[#8ab9ff]">{selectedTasks.length}</p>
                <p className="mt-0.5 text-[8.5px] font-medium uppercase tracking-[0.06em] text-slate-400 dark:text-white/30">Tareas</p>
              </div>
              <div className="rounded-xl bg-amber-500/[0.08] px-1 py-2 dark:bg-amber-400/10">
                <p className="text-[15px] font-semibold tabular-nums text-amber-600 dark:text-amber-300">{selectedImportantDates.length}</p>
                <p className="mt-0.5 text-[8.5px] font-medium uppercase tracking-[0.06em] text-slate-400 dark:text-white/30">Fechas</p>
              </div>
            </div>
          </section>

          <section className="app-glass-soft rounded-[26px] p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-600/80 dark:text-amber-300/70">
                  Fechas importantes
                </p>
                <h3 className="mt-1 text-[14px] font-semibold text-slate-800 dark:text-white/90">No se te pasen</h3>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                {importantDates.length}
              </span>
            </div>
            {importantDates.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-900/[0.025] px-2.5 py-3 text-[10.5px] leading-4 text-slate-400 dark:bg-white/[0.025] dark:text-white/30">
                Aún no hay fechas señaladas. Añade una desde el formulario de arriba.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-1">
                {importantDates.slice(0, 5).map((event) => (
                  <li key={event.id} className="group flex items-center gap-2 rounded-xl px-1.5 py-2 hover:bg-white/35 dark:hover:bg-white/[0.03]">
                    <span className="flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-500/10 text-[8px] font-semibold uppercase leading-none text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                      <span className="text-[11px] tabular-nums">{event.date.slice(8, 10)}</span>
                      <span>{MONTHS[Number(event.date.slice(5, 7)) - 1]?.slice(0, 3)}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-slate-700 dark:text-white/75">
                      {event.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeImportantDate(event.id)}
                      disabled={deletingImportantId === event.id}
                      aria-label={`Eliminar ${event.title}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-70 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-30 dark:text-white/30 dark:hover:text-rose-300"
                    >
                      {deletingImportantId === event.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Próximos exámenes: sustituye al mini calendario, que ya vive en la
              columna principal del calendario mensual. */}
          <section className="app-glass-soft rounded-[26px] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d92b22]/80 dark:text-[#ff8a80]/80">
                  Próximos exámenes
                </p>
                <h3 className="mt-1 text-[14px] font-semibold text-slate-800 dark:text-white/90">
                  Lo que viene
                </h3>
              </div>
              <span className="rounded-full bg-[#FF3B30]/10 px-2 py-1 text-[10px] font-semibold text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]">
                {upcomingExams.length}
              </span>
            </div>

            {upcomingExams.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-900/[0.025] px-2.5 py-3 text-[10.5px] leading-4 text-slate-400 dark:bg-white/[0.025] dark:text-white/30">
                No hay exámenes próximos. Añade uno desde el formulario de arriba o desde Académico.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-1">
                {upcomingExams.map((exam) => {
                  const key = examDateKey(exam) ?? "";
                  const date = parseKey(key);
                  const days = date
                    ? Math.round(
                        (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
                          new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
                          86400000,
                      )
                    : null;
                  const when =
                    days === null
                      ? ""
                      : days <= 0
                        ? "Hoy"
                        : days === 1
                          ? "Mañana"
                          : `En ${days} días`;
                  const course = exam.course_id ? courseById.get(exam.course_id) : undefined;
                  return (
                    <li key={exam.id}>
                      <button
                        type="button"
                        onClick={() => openExamDialog("edit", exam)}
                        className="group flex w-full items-center gap-2 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-white/35 dark:hover:bg-white/[0.03]"
                      >
                        <span className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg bg-[#FF3B30]/10 text-[8px] font-semibold uppercase leading-none text-[#d92b22] dark:bg-[#FF3B30]/12 dark:text-[#ff8a80]">
                          <span className="text-[12px] tabular-nums">{key.slice(8, 10)}</span>
                          <span>{MONTHS[Number(key.slice(5, 7)) - 1]?.slice(0, 3)}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] font-medium text-slate-700 dark:text-white/75">
                            {exam.title}
                          </span>
                          <span className="block truncate text-[9.5px] text-slate-400 dark:text-white/30">
                            {[course?.name, when].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {exam.score === null ? (
                          <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.05em] text-amber-700 dark:text-amber-300">
                            Sin nota
                          </span>
                        ) : null}
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-white/20" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
</>
  );
}
