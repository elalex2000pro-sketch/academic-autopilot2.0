"use client";

import type * as React from "react";
import type { Dispatch, SetStateAction } from "react";
import { Check, CheckCircle2, Clock, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDueLabel } from "@/lib/task-utils";
import type { Course, Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { PRIORITY_COLOR, PRIORITY_LABEL, longDate, selectClass } from "@/lib/planner";

type Props = {
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
  selectedDay: string;
  addingTask: boolean;
  selectedTasks: Task[];
  courseById: Map<string, Course>;
  busyTaskId: string | null;
  confirmDeleteId: string | null;
  completeTask: (id: string) => Promise<void>;
  setEditingTask: Dispatch<SetStateAction<Task | null>>;
  setConfirmDeleteId: Dispatch<SetStateAction<string | null>>;
  removeTask: (id: string) => Promise<void>;
};

export function PlannerTasksPanel({
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
  selectedDay,
  addingTask,
  selectedTasks,
  courseById,
  busyTaskId,
  confirmDeleteId,
  completeTask,
  setEditingTask,
  setConfirmDeleteId,
  removeTask,
}: Props) {
  return (
<div className="mt-5 border-t border-slate-900/[0.05] pt-4 dark:border-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                    Entregas
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
                    Tareas del día
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] text-slate-400 dark:text-white/30">
                    {pendingSelected} pendiente{pendingSelected === 1 ? "" : "s"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTaskForm((value) => !value)}
                    className="h-8"
                  >
                    {showTaskForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showTaskForm ? "Cerrar" : "Nueva"}
                  </Button>
                </div>
              </div>

              {showTaskForm && (
                <form
                  onSubmit={addTask}
                  className="mt-3 space-y-2.5 rounded-2xl bg-slate-900/[0.025] p-3 dark:bg-white/[0.03]"
                >
                  <Input
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="Título de la tarea o entrega"
                    maxLength={500}
                    aria-label="Título de la tarea"
                  />
                  <div className="grid gap-2 md:grid-cols-3">
                    <select
                      className={selectClass}
                      value={taskCourseId}
                      onChange={(event) => setTaskCourseId(event.target.value)}
                      aria-label="Asignatura"
                    >
                      <option value="">Sin asignatura</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="time"
                      value={taskTime}
                      onChange={(event) => setTaskTime(event.target.value)}
                      aria-label="Hora de entrega"
                      className="tabular"
                    />
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={taskMinutes}
                      onChange={(event) => setTaskMinutes(Number(event.target.value))}
                      aria-label="Minutos estimados"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-400 dark:text-white/30">
                      Se guarda para el {longDate(selectedDay).toLowerCase()}.
                    </p>
                    <Button type="submit" size="sm" disabled={!taskTitle.trim() || addingTask}>
                      {addingTask ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Añadir
                    </Button>
                  </div>
                </form>
              )}

              {selectedTasks.length === 0 ? (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-slate-900/[0.025] px-3 py-4 text-[11.5px] text-slate-500 dark:bg-white/[0.025] dark:text-white/35">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34C759]" />
                  Sin entregas para este día. Buen momento para adelantar trabajo.
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  {selectedTasks.map((task) => {
                    const course = task.course_id ? courseById.get(task.course_id) : undefined;
                    const completed = task.status === "completed";
                    const busy = busyTaskId === task.id;
                    const confirming = confirmDeleteId === task.id;
                    return (
                      <div key={task.id}>
                        <div className="group flex items-start gap-2.5 rounded-2xl px-1.5 py-2.5 transition-colors hover:bg-white/30 dark:hover:bg-white/[0.03]">
                          <button
                            type="button"
                            onClick={() => void completeTask(task.id)}
                            disabled={completed || busy}
                            aria-label={completed ? "Tarea completada" : `Completar ${task.title}`}
                            title={completed ? "Completada" : "Completar tarea"}
                            className={cn(
                              "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                              completed
                                ? "border-[#34C759]/60 bg-[#34C759]/15 text-[#1a9e3a] dark:text-[#5be07c]"
                                : "border-slate-300 text-transparent hover:border-[#34C759]/70 hover:bg-[#34C759]/10 hover:text-[#1a9e3a] dark:border-white/20 dark:hover:text-[#5be07c]",
                            )}
                          >
                            {busy ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Check className="h-2.5 w-2.5" strokeWidth={3} />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-[12.5px] font-medium text-slate-700 dark:text-white/80">
                                {task.title}
                              </p>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-slate-500 dark:text-white/35">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDueLabel(task.due_at)}
                              </span>
                              <span className="text-slate-300 dark:text-white/20">·</span>
                              <span>{formatMinutes(task.estimated_minutes)}</span>
                              {course && (
                                <>
                                  <span className="text-slate-300 dark:text-white/20">·</span>
                                  <span className="inline-flex min-w-0 items-center gap-1">
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{ backgroundColor: course.color ?? "#8E8E93" }}
                                    />
                                    <span className="max-w-[130px] truncate">{course.name}</span>
                                  </span>
                                </>
                              )}
                              <span className="text-slate-300 dark:text-white/20">·</span>
                              <span style={{ color: PRIORITY_COLOR[task.priority] }}>
                                {PRIORITY_LABEL[task.priority] ?? task.priority}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingTask(task)}
                            disabled={busy}
                            aria-label={`Editar ${task.title}`}
                            title="Editar tarea"
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-[#0066FF]/10 hover:text-[#0066FF] disabled:opacity-40 dark:text-white/30 dark:hover:text-[#8ab9ff]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(confirming ? null : task.id)}
                            disabled={busy}
                            aria-label={`Quitar ${task.title}`}
                            title="Quitar tarea"
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 dark:text-white/30 dark:hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {confirming && (
                          <div className="ml-8 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/70 bg-rose-50/70 px-2.5 py-2 dark:border-rose-400/20 dark:bg-rose-500/10">
                            <p className="text-[11px] font-medium text-rose-700 dark:text-rose-200">
                              ¿Quitar esta tarea?
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => void removeTask(task.id)}
                                disabled={busy}
                              >
                                Quitar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
  );
}
