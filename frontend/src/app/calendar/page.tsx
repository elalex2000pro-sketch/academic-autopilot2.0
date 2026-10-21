"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import type { Course, Task } from "@/lib/types";

const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
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

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "border-l-4 border-l-red-500",
  long_project: "border-l-4 border-l-amber-500",
  short_task: "border-l-4 border-l-blue-500",
};

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

  function changeMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDay(null);
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDay || !title.trim()) return;
    setNotice(null);
    try {
      // Mediodia LOCAL del dia elegido: la tarea nunca se desplaza de dia.
      await api.createTask({
        title: title.trim(),
        due_at: new Date(`${selectedDay}T12:00:00`).toISOString(),
        estimated_minutes: minutes,
        course_id: courseId || undefined,
      });
      setTitle("");
      setCourseId("");
      setMinutes(60);
      await load();
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }

  async function completeTask(id: string) {
    try {
      await api.completeTask(id);
      await load();
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Vista mensual de tus entregas. Pulsa un dia para anadir una tarea.
        </p>
      </header>

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base capitalize">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            >
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
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDay(isSelected ? null : key);
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
                            if (!done) completeTask(task.id);
                          }}
                          title={`${task.title} · ${task.estimated_minutes} min${done ? " (hecha)" : ""}`}
                          className={`truncate rounded bg-secondary/60 px-1.5 py-0.5 text-[11px] leading-tight text-left transition-opacity hover:opacity-80 ${
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
                        +{dayTasks.length - 3} mas
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Nueva tarea para el {selectedDay}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDay(null)} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={addTask} className="grid gap-3 sm:grid-cols-4 sm:items-end">
              <div className="space-y-2 sm:col-span-2">
                <Label>Titulo</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Estudiar tema 3"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Asignatura</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
              <div className="space-y-2">
                <Label>Minutos</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit" disabled={!title.trim()}>
                  <Plus className="h-4 w-4" /> Anadir tarea
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
