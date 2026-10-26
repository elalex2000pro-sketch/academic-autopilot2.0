"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  examCourseName,
  formatExamDate,
  formatExamScore,
  formatExamWeight,
  isPendingExam,
} from "@/lib/exams";
import type { Course, Grade } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ExamCardProps {
  exam: Grade;
  course?: Course;
  busy?: boolean;
  onEdit: () => void;
  onGrade: () => void;
  onDelete: () => Promise<void>;
}

export function ExamCard({ exam, course, busy = false, onEdit, onGrade, onDelete }: ExamCardProps) {
  const [confirming, setConfirming] = useState(false);
  const pending = isPendingExam(exam);
  const percent = exam.percentage;
  const courseMap = new Map<string, Course>();
  if (course) courseMap.set(course.id, course);
  const courseName = examCourseName(exam, courseMap);

  async function handleDelete() {
    await onDelete();
    setConfirming(false);
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-3 pl-4 transition-colors",
        pending
          ? "border-[#FF3B30]/30 bg-[#FF3B30]/[0.055] dark:border-[#FF3B30]/25 dark:bg-[#FF3B30]/[0.09]"
          : "border-[#34C759]/25 bg-[#34C759]/[0.04] dark:border-[#34C759]/20 dark:bg-[#34C759]/[0.06]",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          pending ? "bg-[#FF3B30]" : "bg-[#34C759]",
        )}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              pending
                ? "bg-[#FF3B30]/12 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                : "bg-[#34C759]/12 text-[#1a9e3a] dark:bg-[#34C759]/15 dark:text-[#7ee69a]",
            )}
          >
            {pending ? <CalendarClock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p className="truncate text-[12.5px] font-semibold text-slate-800 dark:text-white/85">
                {exam.title}
              </p>
              <span className="shrink-0 rounded-full bg-[#FF3B30]/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.07em] text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]">
                Examen
              </span>
              {pending ? (
                <span className="shrink-0 rounded-full bg-[#FF9500]/12 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#b26a00] dark:bg-[#FF9500]/15 dark:text-[#ffc46b]">
                  Pendiente
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-[#34C759]/12 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#1a9e3a] dark:bg-[#34C759]/15 dark:text-[#7ee69a]">
                  Calificado
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-white/35">
              <span className="inline-flex min-w-0 items-center gap-1">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: course?.color ?? "#FF3B30" }}
                />
                <span className="max-w-[180px] truncate">{courseName}</span>
              </span>
              <span className="text-slate-300 dark:text-white/20">·</span>
              <span>{formatExamDate(exam)}</span>
              <span className="text-slate-300 dark:text-white/20">·</span>
              <span>{formatExamWeight(exam.weight)}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-[16px] font-semibold tabular-nums tracking-[-0.03em]",
              pending
                ? "text-slate-400 dark:text-white/30"
                : "text-[#1a9e3a] dark:text-[#7ee69a]",
            )}
          >
            {formatExamScore(exam.score, exam.max_score)}
          </p>
          <p className="mt-0.5 text-[9.5px] font-medium tabular-nums text-slate-400 dark:text-white/30">
            {percent === null
              ? "sin nota"
              : `${percent.toLocaleString("es-ES", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}%`}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/45 pt-2 dark:border-white/5">
        <Button
          type="button"
          size="sm"
          variant={pending ? "default" : "outline"}
          className={cn(
            "h-7 px-2 text-[10.5px]",
            pending && "bg-[#FF3B30] text-white hover:brightness-110",
          )}
          onClick={onGrade}
          disabled={busy}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {pending ? "Registrar nota" : "Corregir nota"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10.5px]"
          onClick={onEdit}
          disabled={busy}
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
        <button
          type="button"
          onClick={() => setConfirming((value) => !value)}
          disabled={busy}
          aria-label={`Eliminar ${exam.title}`}
          title="Eliminar examen"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 dark:text-white/30 dark:hover:text-rose-300"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {confirming && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/70 bg-rose-50/70 px-2.5 py-2 dark:border-rose-400/20 dark:bg-rose-500/10">
          <p className="text-[10.5px] font-medium text-rose-700 dark:text-rose-200">
            ¿Eliminar este examen del calendario y de la media?
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-[10.5px]"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Eliminar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10.5px]"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
