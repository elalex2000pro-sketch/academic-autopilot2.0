"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Pause,
  Play,
  RotateCcw,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function monthGrid(base: Date): Date[] {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function formatDue(value: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Panel de contexto de escritorio: calendario compacto, próxima tarea y un
 * Pomodoro rápido. Solo se muestra en pantallas anchas (2xl) y hereda el
 * lenguaje Liquid Glass del resto de la interfaz.
 */
export function ContextPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await api.tasks({ status: "pending" }));
    } catch {
      /* Sin conexión: el panel mantiene lo último que tuviera. */
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 120_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const total = mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;

  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    setRunning(false);
    void api.logFocusSession(Math.round(total / 60), mode).catch(() => undefined);
    if (mode === "focus") setSessions((value) => value + 1);
    setNotice(mode === "focus" ? "Sesión completada. Descansa 5 minutos." : "Descanso terminado.");
  }, [mode, running, secondsLeft, total]);

  function switchMode(next: "focus" | "break") {
    setRunning(false);
    setMode(next);
    setSecondsLeft(next === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
    setNotice(null);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(total);
    setNotice(null);
  }

  const markedDays = useMemo(() => {
    const marked = new Set<string>();
    for (const task of tasks) {
      const raw = task.due_at ?? task.target_start_at;
      if (!raw) continue;
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) marked.add(dateKey(date));
    }
    return marked;
  }, [tasks]);

  const nextTask = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const left = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const right = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      return left - right;
    });
    return sorted[0] ?? null;
  }, [tasks]);

  const days = useMemo(() => monthGrid(month), [month]);
  const monthLabel = month.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const todayKey = dateKey(new Date());
  const progress = Math.round(((total - secondsLeft) / total) * 100);

  return (
    <aside
      aria-label="Panel de contexto"
      className="sticky top-10 mr-4 hidden h-[calc(100dvh-3.5rem)] w-[280px] shrink-0 flex-col gap-3 overflow-y-auto pb-1 min-[1440px]:flex"
    >
      <p className="px-2 pt-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/30">
        Contexto
      </p>

      {/* Mini-calendario */}
      <section className="rounded-[26px] border border-white/40 bg-white/45 p-3.5 shadow-[0_20px_50px_-36px_rgba(32,39,48,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.045]">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11.5px] font-semibold capitalize tracking-[-0.01em] text-slate-700 dark:text-white/80">
            {monthLabel}
          </p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
              aria-label="Mes anterior"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-black/[0.05] hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/80"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
              aria-label="Mes siguiente"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-black/[0.05] hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/80"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-7 gap-y-0.5 text-center">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="text-[8.5px] font-semibold uppercase tracking-[0.06em] text-black/30 dark:text-white/25"
            >
              {day}
            </span>
          ))}
          {days.map((day) => {
            const key = dateKey(day);
            const inMonth = day.getMonth() === month.getMonth();
            const isToday = key === todayKey;
            return (
              <span key={key} className="relative flex justify-center py-0.5">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium tabular-nums",
                    isToday
                      ? "bg-[#1b1b1f] text-white shadow-[0_6px_14px_-10px_rgba(20,20,28,0.9)] dark:bg-[#e9e4f6] dark:text-[#1b1b1f]"
                      : inMonth
                        ? "text-slate-600 dark:text-white/65"
                        : "text-slate-300 dark:text-white/20",
                  )}
                >
                  {day.getDate()}
                </span>
                {markedDays.has(key) ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-0 h-1 w-1 rounded-full",
                      isToday ? "bg-white/80 dark:bg-[#1b1b1f]/70" : "bg-[#0066FF]",
                    )}
                  />
                ) : null}
              </span>
            );
          })}
        </div>

        <Link
          href="/planner"
          className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:text-white/40 dark:hover:text-white/80"
        >
          <CalendarDays className="h-3 w-3" /> Abrir planificador
        </Link>
      </section>

      {/* Próxima tarea */}
      <Link
        href="/planner"
        className="group rounded-[26px] border border-white/40 bg-white/45 p-3.5 shadow-[0_20px_50px_-36px_rgba(32,39,48,0.45)] backdrop-blur-2xl transition-colors hover:bg-white/60 dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.07]"
      >
        <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-black/35 dark:text-white/30">
          <ListTodo className="h-3 w-3" /> Próxima tarea
        </p>
        {nextTask ? (
          <>
            <p className="mt-1.5 line-clamp-2 text-[12px] font-semibold leading-4 text-slate-800 dark:text-white/85">
              {nextTask.title}
            </p>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-white/40">
              {formatDue(nextTask.due_at)}
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-white/40">
            Nada pendiente. Buen momento para repasar.
          </p>
        )}
      </Link>

      {/* Temporizador de enfoque */}
      <section className="rounded-[26px] border border-white/40 bg-white/45 p-3.5 shadow-[0_20px_50px_-36px_rgba(32,39,48,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.045]">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-black/35 dark:text-white/30">
            <Timer className="h-3 w-3" /> Enfoque
          </p>
          <div className="flex items-center gap-0.5 rounded-full border border-black/[0.06] bg-white/40 p-0.5 dark:border-white/10 dark:bg-white/[0.05]">
            <button
              type="button"
              onClick={() => switchMode("focus")}
              aria-pressed={mode === "focus"}
              className={cn(
                "rounded-full px-2 py-0.5 text-[9.5px] font-semibold transition-colors",
                mode === "focus"
                  ? "bg-[#1b1b1f] text-white dark:bg-[#e9e4f6] dark:text-[#1b1b1f]"
                  : "text-slate-500 dark:text-white/40",
              )}
            >
              25
            </button>
            <button
              type="button"
              onClick={() => switchMode("break")}
              aria-pressed={mode === "break"}
              className={cn(
                "rounded-full px-2 py-0.5 text-[9.5px] font-semibold transition-colors",
                mode === "break"
                  ? "bg-[#1b1b1f] text-white dark:bg-[#e9e4f6] dark:text-[#1b1b1f]"
                  : "text-slate-500 dark:text-white/40",
              )}
            >
              5
            </button>
          </div>
        </div>

        <p className="mt-1 text-center text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-slate-800 dark:text-white/90">
          {clock(secondsLeft)}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[#0066FF] transition-[width] duration-500 dark:bg-[#8ab9ff]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2.5 flex gap-1.5">
          <Button
            size="sm"
            onClick={() => {
              setRunning((value) => !value);
              setNotice(null);
            }}
            className="h-8 flex-1 text-[11px]"
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Pausar" : "Empezar"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={reset}
            aria-label="Reiniciar temporizador"
            title="Reiniciar"
            className="h-8 w-8 p-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {sessions > 0 ? (
          <p className="mt-1.5 text-center text-[9.5px] text-slate-500 dark:text-white/35">
            {sessions} {sessions === 1 ? "sesión completada" : "sesiones completadas"}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-1.5 text-center text-[9.5px] font-medium text-emerald-600 dark:text-emerald-300">
            {notice}
          </p>
        ) : null}
      </section>
    </aside>
  );
}
