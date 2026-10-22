"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import type { Course, Task } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "border-l-4 border-l-red-500",
  long_project: "border-l-4 border-l-amber-500",
  short_task: "border-l-4 border-l-blue-500",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  long_project: "Proyecto",
  short_task: "Tarea corta",
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

// Devuelve la clave YYYY-MM-DD en hora LOCAL del navegador, para agrupar por dia.
// (Con ISO en UTC, una entrega de medianoche local caia en el dia anterior.)
function dayKey(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return keyOf(date.getFullYear(), date.getMonth(), date.getDate());
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function keyOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function longDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return key;
  const formatted = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [courseId, setCourseId] = useState("");
  const [adding, setAdding] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([api.tasks(), api.courses()]);
    setTasks(t);
    setCourses(c);
  }, []);

  useEffect(() => {
    load().catch((e) => setNotice(errorMessage(e)));
  }, [load]);

  useRealtime((event) => {
    if (event.event === "tasks" || event.event === "courses") {
      load().catch(() => undefined);
    }
  });

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = dayKey(task.due_at);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const courseById = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of courses) map.set(c.id, c);
    return map;
  }, [courses]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7; // Lunes = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedTasks = useMemo(
    () => (selectedDay ? tasksByDay.get(selectedDay) ?? [] : []),
    [selectedDay, tasksByDay],
  );
  const orderedSelectedTasks = useMemo(
    () =>
      [...selectedTasks].sort(
        (a, b) => Number(a.status === "completed") - Number(b.status === "completed"),
      ),
    [selectedTasks],
  );
  const pendingSelected = selectedTasks.filter((task) => task.status !== "completed").length;

  function scrollToPanel() {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1279px)").matches) return;
    window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function openDay(key: string) {
    setSelectedDay(key);
    setConfirmDeleteId(null);
    setTitle("");
    setCourseId("");
    setMinutes(60);
    scrollToPanel();
  }

  function toggleDay(key: string) {
    if (selectedDay === key) {
      setSelectedDay(null);
      setConfirmDeleteId(null);
      return;
    }
    openDay(key);
  }

  function focusDay(key: string) {
    if (selectedDay !== key) {
      openDay(key);
      return;
    }
    scrollToPanel();
  }

  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(null);
    setConfirmDeleteId(null);
  }

  function changeMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDay(null);
    setConfirmDeleteId(null);
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDay || !title.trim() || adding) return;
    setAdding(true);
    setNotice(null);
    try {
      // Mediodia LOCAL del dia elegido: la tarea nunca se desplaza de dia.
      await api.createTask({
        title: title.trim(),
        due_at: new Date(`${selectedDay}T12:00:00`).toISOString(),
        estimated_minutes: Math.max(5, Number(minutes) || 60),
        course_id: courseId || undefined,
      });
      setTitle("");
      setCourseId("");
      setMinutes(60);
      await load();
      setNotice(`Tarea añadida al ${longDate(selectedDay).toLowerCase()}.`);
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setAdding(false);
    }
  }

  async function completeTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === "completed" || completingId) return;
    setCompletingId(id);
    setNotice(null);
    try {
      await api.completeTask(id);
      await load();
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setCompletingId(null);
    }
  }

  async function removeTask(task: Task) {
    if (deletingId) return;
    setDeletingId(task.id);
    setNotice(null);
    try {
      await api.deleteTask(task.id);
      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      setConfirmDeleteId(null);
      setNotice("Tarea quitada del calendario.");
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Selecciona un día para añadir, completar o quitar tareas. Todo se sincroniza con tu cuenta.
        </p>
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-border/60 bg-background/40 px-4 py-2.5 text-sm text-muted-foreground"
        >
          {notice}
        </p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base capitalize">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>
                Hoy
              </Button>
              <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-xs font-medium uppercase text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-1 py-2 text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="min-h-[104px] rounded-md bg-secondary/10" />;
                }
                const key = keyOf(cursor.getFullYear(), cursor.getMonth(), day);
                const dayTasks = tasksByDay.get(key) ?? [];
                const isToday = key === todayKey;
                const isSelected = key === selectedDay;
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={key}
                    aria-label={`${longDate(key)}, ${dayTasks.length} tareas`}
                    onClick={() => toggleDay(key)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleDay(key);
                      }
                    }}
                    className={`flex min-h-[104px] cursor-pointer flex-col gap-1 rounded-md border p-1.5 text-left align-top transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-accent/50"
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="flex flex-col gap-1">
                      {dayTasks.slice(0, 3).map((task) => {
                        const course = task.course_id ? courseById.get(task.course_id) : undefined;
                        const done = task.status === "completed";
                        return (
                          <button
                            type="button"
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              focusDay(key);
                            }}
                            title={`${task.title} · ${formatMinutes(task.estimated_minutes)}${done ? " (hecha)" : ""} · Pulsa para gestionar`}
                            aria-label={`Gestionar ${task.title}`}
                            className={`truncate rounded bg-secondary/60 px-1.5 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-80 ${
                              PRIORITY_STYLE[task.priority] ?? ""
                            } ${done ? "text-muted-foreground line-through" : ""}`}
                            style={course?.color ? { borderLeftColor: course.color } : undefined}
                          >
                            {task.title}
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <span className="px-1 text-[11px] text-muted-foreground">
                          +{dayTasks.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div ref={panelRef} className="xl:sticky xl:top-6">
          {selectedDay ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-base">{longDate(selectedDay)}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedTasks.length} {selectedTasks.length === 1 ? "tarea" : "tareas"} ·{" "}
                    {pendingSelected} {pendingSelected === 1 ? "pendiente" : "pendientes"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedDay(null);
                    setConfirmDeleteId(null);
                  }}
                  aria-label="Cerrar panel del día"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <form
                  onSubmit={addTask}
                  className="space-y-3 rounded-2xl border border-border/60 bg-background/40 p-3.5"
                >
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Plus className="h-4 w-4 text-primary" /> Nueva tarea
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="calendar-task-title">Título</Label>
                    <Input
                      id="calendar-task-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Estudiar tema 3"
                      maxLength={500}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="calendar-task-course">Asignatura</Label>
                      <select
                        id="calendar-task-course"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                      >
                        <option value="" className="bg-background">
                          Sin asignatura
                        </option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id} className="bg-background">
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="calendar-task-minutes">Minutos</Label>
                      <Input
                        id="calendar-task-minutes"
                        type="number"
                        min={5}
                        step={5}
                        value={minutes}
                        onChange={(e) => setMinutes(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={!title.trim() || adding}>
                    {adding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {adding ? "Añadiendo..." : "Añadir tarea"}
                  </Button>
                </form>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Tareas del día</p>
                    <span className="text-[11px] text-muted-foreground">
                      {pendingSelected} pendientes
                    </span>
                  </div>
                  {orderedSelectedTasks.length === 0 ? (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      No hay tareas para este día.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {orderedSelectedTasks.map((task) => {
                        const course = task.course_id ? courseById.get(task.course_id) : undefined;
                        const done = task.status === "completed";
                        const confirming = confirmDeleteId === task.id;
                        const deleting = deletingId === task.id;
                        const completing = completingId === task.id;
                        return (
                          <div
                            key={task.id}
                            className={`rounded-xl border border-border/60 bg-background/45 ${
                              PRIORITY_STYLE[task.priority] ?? ""
                            }`}
                            style={course?.color ? { borderLeftColor: course.color } : undefined}
                          >
                            <div className="flex items-start gap-2.5 p-2.5">
                              <button
                                type="button"
                                onClick={() => void completeTask(task.id)}
                                disabled={done || completing}
                                aria-label={done ? "Tarea completada" : `Completar ${task.title}`}
                                className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary disabled:cursor-default"
                              >
                                {completing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : done ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-sm leading-5 ${
                                    done ? "text-muted-foreground line-through" : ""
                                  }`}
                                >
                                  {task.title}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatMinutes(task.estimated_minutes)}
                                  </span>
                                  {course && (
                                    <span className="inline-flex items-center gap-1">
                                      <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ backgroundColor: course.color ?? "#6366f1" }}
                                      />
                                      <span className="max-w-[120px] truncate">{course.name}</span>
                                    </span>
                                  )}
                                  <span>{PRIORITY_LABEL[task.priority] ?? task.priority}</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-500"
                                onClick={() => setConfirmDeleteId(confirming ? null : task.id)}
                                disabled={deleting}
                                aria-label={`Quitar ${task.title}`}
                                title="Quitar tarea"
                              >
                                {deleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            {confirming && (
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rose-200/70 bg-rose-50/70 px-2.5 py-2 dark:border-rose-400/20 dark:bg-rose-500/10">
                                <p className="text-[11px] font-medium text-rose-800 dark:text-rose-200">
                                  ¿Quitar esta tarea?
                                </p>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => void removeTask(task)}
                                    disabled={deleting}
                                  >
                                    Quitar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => setConfirmDeleteId(null)}
                                    disabled={deleting}
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <p className="mt-3 font-semibold">Selecciona un día</p>
                <p className="mt-1 max-w-[250px] text-xs leading-5 text-muted-foreground">
                  Pulsa cualquier día del calendario para añadir una tarea nueva o quitar las que ya
                  tienes.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => openDay(todayKey)}>
                  Gestionar hoy
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
