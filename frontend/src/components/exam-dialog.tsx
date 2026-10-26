"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Check,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { notifyGradeChange } from "@/lib/grade-events";
import type { Course, Grade } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ExamDialogMode = "create" | "edit" | "grade";

interface ExamDialogProps {
  open: boolean;
  mode: ExamDialogMode;
  exam: Grade | null;
  courses: Course[];
  defaultDate: string;
  onClose: () => void;
  onSaved: (exam: Grade, message: string) => void;
  onDeleted?: (id: string) => void;
}

const fieldClass =
  "flex h-9 w-full rounded-xl border border-slate-300/45 bg-slate-100/55 px-3 text-[13px] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.32)] backdrop-blur-xl transition-[border-color,box-shadow,background-color] duration-150 focus-visible:border-[#0066FF] focus-visible:bg-slate-100/75 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0066FF]/20 dark:border-white/10 dark:bg-white/[0.055] dark:text-white/90 dark:focus-visible:bg-white/[0.08]";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value: number): string {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

export function ExamDialog({
  open,
  mode,
  exam,
  courses,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
}: ExamDialogProps) {
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [weight, setWeight] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(exam?.title ?? "");
    setCourseId(exam?.course_id ?? "");
    setDate(exam?.graded_at?.slice(0, 10) ?? defaultDate);
    setWeight(exam?.weight !== null && exam?.weight !== undefined ? String(exam.weight) : "");
    setMaxScore(exam ? String(exam.max_score) : "10");
    setScore(exam?.score !== null && exam?.score !== undefined ? String(exam.score) : "");
    setNotes(exam?.notes ?? "");
    setError(null);
    setConfirmDelete(false);
    setSaving(false);
    setDeleting(false);
  }, [open, exam, defaultDate]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !deleting) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, saving, deleting, onClose]);

  useEffect(() => {
    if (!open || mode !== "grade") return;
    const timer = window.setTimeout(() => scoreRef.current?.focus(), 90);
    return () => window.clearTimeout(timer);
  }, [open, mode]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) ?? null,
    [courses, courseId],
  );

  const parsedMax = toNumber(maxScore) ?? 10;
  const parsedScore = toNumber(score);
  const parsedWeight = toNumber(weight);
  const previewPercent =
    parsedScore !== null && parsedMax > 0
      ? Math.round((parsedScore / parsedMax) * 10000) / 100
      : null;

  const heading =
    mode === "create"
      ? "Nuevo examen"
      : mode === "grade"
        ? exam?.score === null
          ? "Registrar nota"
          : "Corregir nota"
        : "Editar examen";

  const submitLabel =
    mode === "create" ? "Añadir examen" : mode === "grade" ? "Guardar nota" : "Guardar cambios";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || deleting) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Ponle un título al examen.");
      return;
    }
    if (!courseId) {
      setError("Elige la asignatura a la que pertenece el examen.");
      return;
    }
    if (!date) {
      setError("Indica la fecha del examen para verlo en el calendario.");
      return;
    }

    const max = toNumber(maxScore);
    if (max === null || max <= 0) {
      setError("La puntuación máxima debe ser mayor que 0.");
      return;
    }
    const scoreValue = toNumber(score);
    if (scoreValue !== null && scoreValue > max) {
      setError("La nota no puede superar la puntuación máxima.");
      return;
    }
    const weightValue = toNumber(weight);
    if (weightValue !== null && (weightValue < 0 || weightValue > 100)) {
      setError("El peso debe estar entre 0 y 100.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        title: cleanTitle,
        course_id: courseId,
        score: scoreValue,
        max_score: max,
        weight: weightValue,
        graded_at: date,
        notes: notes.trim() || null,
        is_exam: true,
      };
      const saved = exam
        ? await api.updateGrade(exam.id, body)
        : await api.createGrade(body);
      if (!saved || typeof saved.id !== "string" || saved.id.length === 0) {
        throw new Error("El servidor no devolvió el examen guardado.");
      }
      notifyGradeChange();
      const message =
        scoreValue === null
          ? exam
            ? "Examen actualizado. Sigue pendiente de nota."
            : "Examen añadido al calendario."
          : exam
            ? "Nota del examen actualizada. La media se ha recalculado."
            : "Examen añadido con nota. La media se ha recalculado.";
      onSaved(saved, message);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!exam || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteGrade(exam.id);
      notifyGradeChange();
      onDeleted?.(exam.id);
      onClose();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6"
      onClick={() => {
        if (!saving && !deleting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-dialog-title"
        className="animate-pop my-4 w-full max-w-2xl rounded-3xl border border-slate-300/45 bg-slate-100/90 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/92"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-300/40 p-5 dark:border-white/10">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF3B30] to-[#d92b22] text-white shadow-lg">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d92b22] dark:text-[#ff8a80]">
                Planificador · Examen
              </p>
              <h2
                id="exam-dialog-title"
                className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/95"
              >
                {heading}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100/70 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#FF3B30]/20 bg-[#FF3B30]/[0.06] px-3 py-2.5 dark:border-[#FF3B30]/20 dark:bg-[#FF3B30]/10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3B30] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-white shadow-sm">
              <CalendarClock className="h-3 w-3" /> Examen
            </span>
            <p className="min-w-0 flex-1 text-[10.5px] leading-4 text-slate-600 dark:text-white/50">
              Se verá destacado en el calendario y su nota entrará en la media ponderada de la
              asignatura.
            </p>
          </div>

          {courses.length === 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50/70 px-3 py-2.5 text-[11px] leading-5 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Todavía no tienes asignaturas.{" "}
                <Link href="/academics" className="font-semibold underline underline-offset-2">
                  Crea una en Académico
                </Link>{" "}
                para vincular el examen y calcular su media.
              </span>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exam-title">Título del examen</Label>
              <Input
                id="exam-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  selectedCourse ? `Examen de ${selectedCourse.name}` : "Ej. Examen del Tema 3"
                }
                required
                maxLength={300}
                autoFocus
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exam-course">Asignatura de 1.º de SMR</Label>
              <select
                id="exam-course"
                className={fieldClass}
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                required
              >
                <option value="">Selecciona una asignatura</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
              {selectedCourse && (
                <p className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-white/35">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: selectedCourse.color ?? "#FF3B30" }}
                  />
                  La nota se sumará a la media de {selectedCourse.name}.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam-date">Fecha del examen</Label>
              <Input
                id="exam-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
                className="tabular"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam-weight">Peso sobre la nota final</Label>
              <div className="relative">
                <Input
                  id="exam-weight"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  placeholder="30"
                  className="pr-8 tabular"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 dark:text-white/30">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam-max">Puntuación máxima</Label>
              <Input
                id="exam-max"
                type="number"
                min={0.01}
                step="0.01"
                value={maxScore}
                onChange={(event) => setMaxScore(event.target.value)}
                className="tabular"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam-score">Nota (opcional)</Label>
              <Input
                ref={scoreRef}
                id="exam-score"
                type="number"
                min={0}
                max={parsedMax}
                step="0.01"
                value={score}
                onChange={(event) => setScore(event.target.value)}
                placeholder="Pendiente"
                className="tabular"
              />
              <p className="text-[10px] text-slate-400 dark:text-white/30">
                Déjalo vacío si aún no has hecho el examen.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exam-notes">Notas (opcional)</Label>
              <Input
                id="exam-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Temario, aula o comentarios para repasar"
                maxLength={500}
              />
            </div>
          </div>

          {previewPercent !== null && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#34C759]/25 bg-[#34C759]/[0.08] px-3 py-2.5 text-[11px] text-[#1a7f3a] dark:text-[#7ee69a]">
              <span className="font-medium">Vista previa de la nota</span>
              <span className="font-semibold tabular-nums">
                {(previewPercent / 10).toFixed(1)}/10 · {formatPercent(previewPercent)}%
                {parsedWeight !== null ? ` · peso ${formatPercent(parsedWeight)}%` : ""}
              </span>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-300/50 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-5 text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300/40 p-5 dark:border-white/10">
          <div className="min-w-0">
            {exam ? (
              confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10.5px] font-medium text-rose-700 dark:text-rose-200">
                    ¿Eliminar este examen de la media?
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void handleDelete()}
                    disabled={deleting || saving}
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Eliminar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting || saving}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar examen
                </Button>
              )
            ) : (
              <p className="text-[10.5px] leading-4 text-slate-400 dark:text-white/30">
                Se guarda en el calendario y en Académico.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || deleting || courses.length === 0}
              className={cn(
                mode === "grade" && "bg-[#FF3B30] text-white hover:brightness-110",
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "create" ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving ? "Guardando..." : submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
