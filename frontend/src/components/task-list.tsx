"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  History,
  Loader2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDueLabel } from "@/lib/task-utils";
import type { Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  moodle: "Moodle",
  google_classroom: "Classroom",
  manual: "Manual",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  long_project: "Proyecto",
  short_task: "Tarea corta",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ff453a",
  long_project: "#bf5af2",
  short_task: "#0a84ff",
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "No se pudo actualizar la tarea.";
}

type TaskAction = "complete" | "delete";

interface TaskListProps {
  /** Tareas activas: ya filtradas por vencimiento y exclusiones. */
  tasks: Task[];
  /** Tareas vencidas, visibles solo al desplegar el historial. */
  historyTasks?: Task[];
  loading?: boolean;
  error?: string | null;
  /** Solo afecta al historial; la lista activa nunca muestra tachados. */
  strikeHistory?: boolean;
  onComplete: (id: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  className?: string;
}

export function TaskList({
  tasks,
  historyTasks = [],
  loading = false,
  error = null,
  strikeHistory = false,
  onComplete,
  onDelete,
  className,
}: TaskListProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState<{ id: string; action: TaskAction } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function runAction(action: TaskAction, id: string) {
    if (busy) return;
    setBusy({ id, action });
    setActionError(null);
    try {
      if (action === "complete") {
        await onComplete(id);
      } else {
        await onDelete(id);
        setConfirmDeleteId(null);
      }
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function exportExcel() {
    if (exporting) return;
    setExporting(true);
    setActionError(null);
    try {
      await api.exportTasksExcel();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setExporting(false);
    }
  }

  function renderTask(task: Task, variant: "active" | "history") {
    const busyHere = busy?.id === task.id;
    const confirming = confirmDeleteId === task.id;
    const isHistory = variant === "history";
    const color = PRIORITY_COLOR[task.priority] ?? "#8e8e93";

    return (
      <div key={task.id}>
        <div
          className={cn(
            "group flex items-start gap-2.5 rounded-xl px-1.5 py-2 transition-colors",
            isHistory
              ? "hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.03]"
              : "hover:bg-slate-900/[0.035] dark:hover:bg-white/[0.045]",
          )}
        >
          <span
            className={cn("mt-1 h-6 w-[2px] shrink-0 rounded-full", isHistory && "opacity-50")}
            style={{ backgroundColor: color }}
          />

          <button
            type="button"
            aria-label={isHistory ? `Completar ${task.title} desde el historial` : `Completar ${task.title}`}
            title="Marcar como completada"
            onClick={() => void runAction("complete", task.id)}
            disabled={busyHere}
            className="mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border border-slate-300 text-transparent transition-colors hover:border-[#30d158]/70 hover:bg-[#30d158]/10 hover:text-[#1a9e3a] disabled:opacity-40 dark:border-white/20 dark:hover:text-[#30d158]"
          >
            {busyHere && busy?.action === "complete" ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-500 dark:text-white/60" />
            ) : (
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p
                className={cn(
                  "truncate text-[12.5px]",
                  isHistory
                    ? cn(
                        "text-slate-500 dark:text-white/45",
                        strikeHistory && "line-through opacity-60",
                      )
                    : "text-slate-700 group-hover:text-slate-900 dark:text-white/80 dark:group-hover:text-white/95",
                )}
              >
                {task.title}
              </p>
              {isHistory && (
                <span className="shrink-0 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.05em] text-rose-600 dark:text-rose-300">
                  Vencida
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-white/30">
              {formatDueLabel(task.due_at)} · {formatMinutes(task.estimated_minutes)} ·{" "}
              {SOURCE_LABEL[task.source] ?? task.source}
            </p>
          </div>

          <span
            className={cn(
              "mt-1 shrink-0 text-[9px] font-medium uppercase tracking-[0.05em]",
              isHistory ? "opacity-50" : "opacity-80",
            )}
            style={{ color }}
          >
            {PRIORITY_LABEL[task.priority] ?? task.priority}
          </span>

          <button
            type="button"
            aria-label={`Eliminar ${task.title}`}
            title="Eliminar tarea"
            onClick={() => setConfirmDeleteId(confirming ? null : task.id)}
            disabled={busyHere}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 dark:text-white/25 dark:hover:text-rose-300"
          >
            {busyHere && busy?.action === "delete" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {confirming && (
          <div className="ml-8 mb-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/70 bg-rose-50/70 px-2.5 py-2 dark:border-rose-400/20 dark:bg-rose-500/10">
            <p className="text-[11px] font-medium text-rose-700 dark:text-rose-200">
              ¿Eliminar esta tarea de la lista?
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-[11px]"
                onClick={() => void runAction("delete", task.id)}
                disabled={busyHere}
              >
                Eliminar
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
  }

  const hasTasks = tasks.length > 0;
  const hasHistory = historyTasks.length > 0;
  const visibleError = actionError ?? error;

  return (
    <section className={cn("app-glass rounded-3xl p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
            Tareas pendientes
          </h2>
          <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/35">
            {tasks.length} activa{tasks.length === 1 ? "" : "s"}
            {hasHistory
              ? ` · ${historyTasks.length} en el historial`
              : ""}
          </p>
        </div>
        <button
          type="button"
          title="Descargar todas las tareas en Excel"
          aria-label="Descargar todas las tareas en Excel"
          onClick={() => void exportExcel()}
          disabled={exporting}
          className="app-glass-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white/45 hover:text-slate-800 disabled:opacity-50 dark:text-white/35 dark:hover:bg-white/[0.08] dark:hover:text-white/75"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {visibleError && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
        >
          {visibleError}
        </p>
      )}

      <div className="mt-3 space-y-0.5">
        {loading && !hasTasks && !hasHistory && (
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex animate-pulse items-center gap-2.5 py-2">
                <span className="h-3 w-[2px] rounded-full bg-slate-900/[0.07] dark:bg-white/[0.08]" />
                <span className="h-4 w-4 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07]" />
                <span className="h-3 flex-1 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.06]" />
              </div>
            ))}
          </div>
        )}

        {!loading && !hasTasks && (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#30d158]/10 text-[#1a9e3a] ring-1 ring-[#30d158]/15 dark:text-[#30d158]/80">
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <p className="mt-2 text-[12px] font-medium text-slate-600 dark:text-white/65">
              Todo al día
            </p>
            <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/30">
              {hasHistory
                ? "No hay pendientes activos. Las vencidas quedan en el historial."
                : "No hay tareas pendientes."}
            </p>
          </div>
        )}

        {tasks.map((task) => renderTask(task, "active"))}
      </div>

      {hasHistory && (
        <div className="mt-3 border-t border-slate-900/[0.06] pt-2 dark:border-white/[0.07]">
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            aria-expanded={showHistory}
            className="flex w-full items-center justify-between gap-2 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.03]"
          >
            <span className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-white/40">
              <History className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
              Historial / Vencidas
              <span className="rounded-full bg-slate-900/[0.05] px-1.5 py-0.5 text-[9.5px] tabular-nums text-slate-500 dark:bg-white/[0.07] dark:text-white/45">
                {historyTasks.length}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-white/25",
                showHistory && "rotate-180",
              )}
            />
          </button>

          {showHistory && (
            <div className="mt-1 space-y-0.5 opacity-95">
              <p className="px-1.5 pb-1 text-[9.5px] text-slate-400 dark:text-white/25">
                No cuentan como pendientes. Puedes completarlas o eliminarlas.
              </p>
              {historyTasks.map((task) => renderTask(task, "history"))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
