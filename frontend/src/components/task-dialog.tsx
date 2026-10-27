"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Loader2,
  Pencil,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { Course, Task, TaskPriority } from "@/lib/types";

interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  courses: Course[];
  onClose: () => void;
  onSaved: (task: Task, message: string) => void;
}

const fieldClass =
  "flex h-9 w-full rounded-xl border border-slate-300/40 bg-slate-100/70 px-3 text-[13px] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-3xl transition-[border-color,box-shadow,background-color] duration-150 focus-visible:border-[#0066FF] focus-visible:bg-slate-100/85 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0066FF]/20 dark:border-white/10 dark:bg-white/[0.055] dark:text-white/90 dark:focus-visible:bg-white/[0.08]";

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "urgent", label: "Urgente" },
  { value: "long_project", label: "Proyecto largo" },
  { value: "short_task", label: "Tarea corta" },
];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "No se pudo guardar la tarea.";
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function localDateValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso.slice(0, 10);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTimeValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function todayValue(): string {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

export function TaskDialog({
  open,
  task,
  courses,
  onClose,
  onSaved,
}: TaskDialogProps) {
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("23:59");
  const [minutes, setMinutes] = useState("60");
  const [priority, setPriority] = useState<TaskPriority>("short_task");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setCourseId(task.course_id ?? "");
    setDate(localDateValue(task.due_at));
    setTime(localTimeValue(task.due_at) || "23:59");
    setMinutes(String(task.estimated_minutes));
    setPriority(task.priority);
    setSaving(false);
    setError(null);
  }, [open, task]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, saving, onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!task || saving) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Ponle un título a la tarea.");
      return;
    }

    const estimated = Number(minutes);
    if (!Number.isFinite(estimated) || estimated < 5 || estimated > 2400) {
      setError("Los minutos estimados deben estar entre 5 y 2400.");
      return;
    }

    let dueAt: string | null = null;
    if (date) {
      const due = new Date(`${date}T${time || "23:59"}:00`);
      if (Number.isNaN(due.getTime())) {
        setError("La fecha u hora de entrega no es válida.");
        return;
      }
      dueAt = due.toISOString();
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await api.updateTask(task.id, {
        title: cleanTitle,
        course_id: courseId || null,
        due_at: dueAt,
        estimated_minutes: Math.round(estimated),
        priority,
      });
      onSaved(saved, "Tarea actualizada. La planificación se ha recalculado.");
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  if (!open || !task) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        className="animate-pop my-4 w-full max-w-xl rounded-3xl border border-slate-300/40 bg-slate-100/85 shadow-[0_28px_80px_-36px_rgba(32,39,48,0.45)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/92"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-300/40 p-5 dark:border-white/10">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#004fbf] text-white shadow-lg">
              <Pencil className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                Tarea · Edición
              </p>
              <h2
                id="task-dialog-title"
                className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 dark:text-white/95"
              >
                Editar tarea
              </h2>
              <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-white/40">
                Corrige el nombre, la fecha, la hora o la asignatura sin borrarla.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-title">Nombre de la tarea</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Entregar práctica de redes"
                required
                maxLength={500}
                autoFocus
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-course">Asignatura</Label>
              <select
                id="task-course"
                className={fieldClass}
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
              >
                <option value="">Sin asignatura</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-date">Fecha de entrega</Label>
              <Input
                id="task-date"
                type="date"
                value={date}
                min="2000-01-01"
                onChange={(event) => setDate(event.target.value)}
                className="tabular"
              />
              <p className="text-[10px] text-slate-400 dark:text-white/30">
                Déjala vacía si la tarea no tiene fecha límite.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-time">Hora</Label>
              <Input
                id="task-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={!date}
                className="tabular disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-minutes">Duración estimada</Label>
              <div className="relative">
                <Input
                  id="task-minutes"
                  type="number"
                  min={5}
                  max={2400}
                  step={5}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  className="pr-14 tabular"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 dark:text-white/30">
                  min
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Prioridad</Label>
              <select
                id="task-priority"
                className={fieldClass}
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#0066FF]/20 bg-[#0066FF]/[0.06] px-3 py-2.5 text-[10.5px] leading-4 text-slate-600 dark:border-[#0066FF]/20 dark:bg-[#0066FF]/10 dark:text-white/50">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0066FF] dark:text-[#8ab9ff]" />
            <span>
              Al guardar se mantiene la misma tarea, así que conserva su historial y su estado en
              el planificador.
            </span>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-300/50 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-5 text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-300/40 p-5 dark:border-white/10">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}
