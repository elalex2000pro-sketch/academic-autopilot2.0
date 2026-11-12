"use client";

import type * as React from "react";
import type { Dispatch, SetStateAction } from "react";
import { PlannerTasksPanel } from "@/components/planner/planner-tasks-panel";
import { CalendarClock, Clock, Loader2, MapPin, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { ExamCard } from "@/components/exam-card";
import { type ExamDialogMode } from "@/components/exam-dialog";
import { Button } from "@/components/ui/button";
import type { Course, Grade, ImportantDate, Task, TimetableEntry } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { courseColor, durationMinutes, formatEventRange, subjectName, subjectSubtitle, timeLabel, timeToMinutes, type EnrichedClassEvent } from "@/lib/planner";
import { MonthEmpty } from "@/components/planner/month-empty";

type Props = {
  selectedDay: string;
  isWeekend: boolean;
  loading: boolean;
  selectedClasses: TimetableEntry[];
  selectedExams: Grade[];
  courseById: Map<string, Course>;
  isToday: boolean;
  nowMinutes: number;
  selectedClassId: string | null;
  confirmDeleteClassId: string | null;
  setSelectedClassId: Dispatch<SetStateAction<string | null>>;
  setConfirmDeleteClassId: Dispatch<SetStateAction<string | null>>;
  startEditClass: (entry: TimetableEntry) => void;
  deletingClassId: string | null;
  removeClass: (id: string) => Promise<void>;
  openCreateExam: () => void;
  deletingExamId: string | null;
  openExamDialog: (mode: ExamDialogMode, exam: Grade) => void;
  removeExam: (exam: Grade) => Promise<void>;
  selectedImportantDates: ImportantDate[];
  selectedEvents: EnrichedClassEvent[];
  pendingSelected: number;
  setShowTaskForm: Dispatch<SetStateAction<boolean>>;
  showTaskForm: boolean;
  addTask: (event: React.FormEvent) => Promise<void>;
  taskTitle: string;
  setTaskTitle: Dispatch<SetStateAction<string>>;
  taskCourseId: string;
  setTaskCourseId: Dispatch<SetStateAction<string>>;
  courses: Course[];
  taskTime: string;
  setTaskTime: Dispatch<SetStateAction<string>>;
  taskMinutes: number;
  setTaskMinutes: Dispatch<SetStateAction<number>>;
  addingTask: boolean;
  selectedTasks: Task[];
  busyTaskId: string | null;
  confirmDeleteId: string | null;
  completeTask: (id: string) => Promise<void>;
  setEditingTask: Dispatch<SetStateAction<Task | null>>;
  setConfirmDeleteId: Dispatch<SetStateAction<string | null>>;
  removeTask: (id: string) => Promise<void>;
};

export function PlannerDayView({
  selectedDay,
  isWeekend,
  loading,
  selectedClasses,
  selectedExams,
  courseById,
  isToday,
  nowMinutes,
  selectedClassId,
  confirmDeleteClassId,
  setSelectedClassId,
  setConfirmDeleteClassId,
  startEditClass,
  deletingClassId,
  removeClass,
  openCreateExam,
  deletingExamId,
  openExamDialog,
  removeExam,
  selectedImportantDates,
  selectedEvents,
  pendingSelected,
  setShowTaskForm,
  showTaskForm,
  addTask,
  taskTitle,
  setTaskTitle,
  taskCourseId,
  setTaskCourseId,
  courses,
  taskTime,
  setTaskTime,
  taskMinutes,
  setTaskMinutes,
  addingTask,
  selectedTasks,
  busyTaskId,
  confirmDeleteId,
  completeTask,
  setEditingTask,
  setConfirmDeleteId,
  removeTask,
}: Props) {
  return (
<div key={selectedDay} className="animate-planner-in mt-5">
            {isWeekend ? (
              <MonthEmpty weekend />
            ) : loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex animate-pulse items-center gap-3">
                    <span className="h-3 w-10 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-900/[0.08] dark:bg-white/[0.09]" />
                    <span className="h-14 flex-1 rounded-2xl bg-slate-900/[0.04] dark:bg-white/[0.05]" />
                  </div>
                ))}
              </div>
            ) : selectedClasses.length === 0 ? (
              selectedExams.length > 0 ? (
                <div className="flex items-center gap-2.5 rounded-xl bg-[#FF3B30]/[0.05] px-3 py-4 text-[11.5px] text-slate-500 dark:bg-[#FF3B30]/[0.06] dark:text-white/40">
                  <CalendarClock className="h-4 w-4 shrink-0 text-[#d92b22] dark:text-[#ff8a80]" />
                  Sin clases lectivas, pero tienes{" "}
                  {selectedExams.length === 1
                    ? "1 examen"
                    : `${selectedExams.length} exámenes`}{" "}
                  este día.
                </div>
              ) : (
                <MonthEmpty weekend={false} />
              )
            ) : (
              <div className="relative">
                <span className="absolute bottom-4 left-[65px] top-4 w-px bg-slate-200/80 dark:bg-white/10" />
                <div className="space-y-2.5">
                  {selectedClasses.map((entry) => {
                    const course = entry.course_id ? courseById.get(entry.course_id) : undefined;
                    const color = courseColor(entry, course);
                    const name = subjectName(entry, course);
                    const subtitle = subjectSubtitle(entry, course);
                    const current =
                      isToday &&
                      nowMinutes >= timeToMinutes(entry.start_time) &&
                      nowMinutes <= timeToMinutes(entry.end_time);
                    const selected = selectedClassId === entry.id;
                    const confirming = confirmDeleteClassId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className="group grid grid-cols-[44px_18px_minmax(0,1fr)] items-start gap-x-3"
                      >
                        <div className="pt-1.5 text-right">
                          <p className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-white/80">
                            {timeLabel(entry.start_time)}
                          </p>
                          <p className="mt-0.5 text-[9.5px] tabular-nums text-slate-400 dark:text-white/30">
                            {timeLabel(entry.end_time)}
                          </p>
                        </div>
                        <div className="relative flex justify-center pt-2.5">
                          <span
                            className="relative z-10 h-2.5 w-2.5 rounded-full ring-4 ring-white/80 dark:ring-[#0b0f18]"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                        <div
                          onClick={() => {
                            setSelectedClassId(selected ? null : entry.id);
                            setConfirmDeleteClassId(null);
                          }}
                          className={cn(
                            "min-w-0 cursor-pointer rounded-xl border border-white/60 bg-white/45 p-3 backdrop-blur-md transition-colors dark:border-white/10 dark:bg-white/[0.045]",
                            current
                              ? "border-[#0066FF]/25 bg-[#0066FF]/[0.08] dark:bg-[#0066FF]/10"
                              : "hover:border-white/80 hover:bg-white/60 dark:hover:border-white/15 dark:hover:bg-white/[0.065]",
                            selected && "ring-2 ring-[#0066FF]/30",
                          )}
                          style={{
                            borderLeftColor: color,
                            borderLeftWidth: 3,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <p title={name} className="truncate text-[13px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
                                  {name}
                                </p>
                                {current && (
                                  <span className="shrink-0 rounded-full bg-[#30d158]/15 px-2 py-0.5 text-[9px] font-semibold text-[#1a9e3a] dark:text-[#5be07c]">
                                    Ahora
                                  </span>
                                )}
                              </div>
                              {subtitle && (
                                <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                                  {subtitle}
                                </p>
                              )}
                            </div>
                            <div
                              className="flex shrink-0 items-center gap-1"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <span
                                className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                                style={{
                                  backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`,
                                  color,
                                }}
                              >
                                {formatMinutes(durationMinutes(entry.start_time, entry.end_time))}
                              </span>
                              <button
                                type="button"
                                onClick={() => startEditClass(entry)}
                                aria-label={`Editar ${name}`}
                                title="Editar asignatura"
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 opacity-100 transition-colors hover:bg-[#0066FF]/10 hover:text-[#0066FF] disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:text-white/30 dark:hover:text-[#8ab9ff]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteClassId(confirming ? null : entry.id)}
                                disabled={deletingClassId === entry.id}
                                aria-label={`Quitar ${name}`}
                                title="Quitar clase"
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:text-white/30 dark:hover:text-rose-300"
                              >
                                {deletingClassId === entry.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-slate-500 dark:text-white/35">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeLabel(entry.start_time)}–{timeLabel(entry.end_time)}
                            </span>
                            {entry.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {entry.location}
                              </span>
                            )}
                          </div>
                          {selected && (
                            <div
                              className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-900/[0.05] pt-2 dark:border-white/[0.06]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => startEditClass(entry)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
                                onClick={() => setConfirmDeleteClassId(entry.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Eliminar
                              </Button>
                            </div>
                          )}
                          {confirming && (
                            <div
                              className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/70 bg-rose-50/70 px-2.5 py-2 dark:border-rose-400/20 dark:bg-rose-500/10"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <p className="text-[11px] font-medium text-rose-700 dark:text-rose-200">
                                ¿Eliminar esta asignatura del horario?
                              </p>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => void removeClass(entry.id)}
                                  disabled={deletingClassId === entry.id}
                                >
                                  Eliminar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => setConfirmDeleteClassId(null)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 border-t border-slate-900/[0.05] pt-4 dark:border-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d92b22] dark:text-[#ff8a80]">
                    Evaluaciones
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
                    Exámenes del día
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] text-slate-400 dark:text-white/30">
                    {selectedExams.length}
                  </span>
                  <Button variant="outline" size="sm" onClick={openCreateExam} className="h-8">
                    <Plus className="h-3.5 w-3.5" /> Añadir examen
                  </Button>
                </div>
              </div>
              {selectedExams.length === 0 ? (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-slate-900/[0.025] px-3 py-4 text-[11.5px] text-slate-500 dark:bg-white/[0.025] dark:text-white/35">
                  <CalendarClock className="h-4 w-4 shrink-0 text-[#FF3B30]" />
                  Sin exámenes este día. Pulsa «Añadir examen» para vincularlo a una asignatura.
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedExams.map((exam) => (
                    <ExamCard
                      key={exam.id}
                      exam={exam}
                      course={exam.course_id ? courseById.get(exam.course_id) : undefined}
                      busy={deletingExamId === exam.id}
                      onEdit={() => openExamDialog("edit", exam)}
                      onGrade={() => openExamDialog("grade", exam)}
                      onDelete={() => removeExam(exam)}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedImportantDates.length > 0 && (
              <div className="mt-5 border-t border-slate-900/[0.05] pt-4 dark:border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-600/80 dark:text-amber-300/70">
                    Fechas importantes
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-white/30">
                    {selectedImportantDates.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {selectedImportantDates.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.055] p-2.5 dark:border-amber-400/15 dark:bg-amber-400/[0.06]"
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-slate-700 dark:text-white/80">
                          {event.title}
                        </p>
                        {event.notes && (
                          <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                            {event.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedEvents.length > 0 && (
              <div className="mt-5 border-t border-slate-900/[0.05] pt-4 dark:border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                    Eventos de clase
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-white/30">
                    {selectedEvents.length}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {selectedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2.5 rounded-xl bg-slate-900/[0.025] p-2.5 dark:bg-white/[0.025]"
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          event.is_exam ? "bg-[#FF3B30]" : "bg-[#30B0C7]",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-[12.5px] font-medium text-slate-700 dark:text-white/80">
                            {event.title}
                          </p>
                          {event.is_exam && (
                            <span className="shrink-0 rounded-full bg-[#FF3B30]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#d92b22] dark:text-[#ff8a80]">
                              Examen
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                          {event.class_name ? `${event.class_name} · ` : ""}
                          {formatEventRange(event)}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tareas del día seleccionado */}
            <PlannerTasksPanel
          pendingSelected={pendingSelected}
          setShowTaskForm={setShowTaskForm}
          showTaskForm={showTaskForm}
          addTask={addTask}
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskCourseId={taskCourseId}
          setTaskCourseId={setTaskCourseId}
          courses={courses}
          taskTime={taskTime}
          setTaskTime={setTaskTime}
          taskMinutes={taskMinutes}
          setTaskMinutes={setTaskMinutes}
          selectedDay={selectedDay}
          addingTask={addingTask}
          selectedTasks={selectedTasks}
          courseById={courseById}
          busyTaskId={busyTaskId}
          confirmDeleteId={confirmDeleteId}
          completeTask={completeTask}
          setEditingTask={setEditingTask}
          setConfirmDeleteId={setConfirmDeleteId}
          removeTask={removeTask}
        />
          </div>
  );
}
