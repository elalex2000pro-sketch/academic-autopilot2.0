"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Brain,
  Coffee,
  Flame,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  TimerReset,
} from "lucide-react";

import { DailyFocus } from "@/components/daily-focus";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { markTaskCompleted, restoreTaskExclusion } from "@/lib/task-store";
import type { DailyAgenda, FocusStats } from "@/lib/types";
import { cn } from "@/lib/utils";

type TimerMode = "focus" | "break";

const DURATIONS: Record<TimerMode, number> = { focus: 25 * 60, break: 5 * 60 };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

/**
 * Modo Enfoque: Pomodoro con estadísticas y rachas, más el plan del día.
 */
export default function FocusPage() {
  const [agenda, setAgenda] = useState<DailyAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const [mode, setMode] = useState<TimerMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [sessionsDone, setSessionsDone] = useState(0);
  const [stats, setStats] = useState<FocusStats | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgenda(await api.today());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.focusStats());
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
    void loadStats();
  }, [load, loadStats]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const completeSession = useCallback(async () => {
    setFinishing(true);
    try {
      await api.logFocusSession(Math.round(DURATIONS[mode] / 60), mode);
      if (mode === "focus") {
        setSessionsDone((value) => value + 1);
        await loadStats();
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(
          mode === "focus" ? "Sesión completada" : "Descanso terminado",
          {
            body:
              mode === "focus"
                ? "Buen trabajo. Tómate 5 minutos antes de seguir."
                : "Vuelve al enfoque cuando estés listo.",
          },
        );
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setFinishing(false);
    }
  }, [mode, loadStats]);

  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    setRunning(false);
    void completeSession();
  }, [secondsLeft, running, completeSession]);

  const changeMode = useCallback((next: TimerMode) => {
    setRunning(false);
    setMode(next);
    setSecondsLeft(DURATIONS[next]);
  }, []);

  function reset() {
    setRunning(false);
    setSecondsLeft(DURATIONS[mode]);
  }

  async function askNotifications() {
    if (typeof Notification === "undefined") {
      setNotice("Este navegador no permite notificaciones.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotice(
      permission === "granted"
        ? "Notificaciones activadas: te avisaré al terminar cada sesión."
        : "Has rechazado las notificaciones. Puedes activarlas en el navegador.",
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / DURATIONS[mode];
  const ring = 2 * Math.PI * 86;

  const maxDay = useMemo(
    () => Math.max(1, ...(stats?.days.map((day) => day.minutes) ?? [1])),
    [stats],
  );

  const handleComplete = useCallback(
    async (id: string) => {
      markTaskCompleted(id);
      try {
        await api.completeTask(id);
        await load();
      } catch (error) {
        restoreTaskExclusion("completed", id);
        setNotice(errorMessage(error));
      }
    },
    [load],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <TimerReset className="h-6 w-6 text-indigo-600" /> Modo Enfoque
          </h1>
          <p className="text-sm text-muted-foreground">
            Pomodoro, rachas y una sola cosa a la vez.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {fullscreen ? "Salir" : "Pantalla completa"}
        </Button>
      </header>

      {notice && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {notice}
        </p>
      )}

      <section className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="rounded-3xl border border-slate-300/45 bg-slate-100/65 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => changeMode("focus")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                mode === "focus"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
            >
              <Brain className="h-3.5 w-3.5" /> Enfoque 25 min
            </button>
            <button
              type="button"
              onClick={() => changeMode("break")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                mode === "break"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
            >
              <Coffee className="h-3.5 w-3.5" /> Descanso 5 min
            </button>
          </div>

          <div className="relative mx-auto mt-6 flex h-52 w-52 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r="86"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-indigo-50 dark:text-slate-800"
              />
              <circle
                cx="100"
                cy="100"
                r="86"
                fill="none"
                stroke={mode === "focus" ? "url(#focusGradient)" : "#10b981"}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - progress)}
                className="transition-all duration-700"
              />
              <defs>
                <linearGradient id="focusGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
            </svg>
            <div className="relative text-center">
              <p className="font-mono text-5xl font-bold tabular-nums tracking-tight text-slate-800">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {running ? (mode === "focus" ? "Concentrado" : "Descansando") : "En pausa"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-2">
            <Button
              onClick={() => setRunning((value) => !value)}
              disabled={finishing}
              className="min-w-32"
            >
              {finishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : running ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {running ? "Pausar" : secondsLeft === DURATIONS[mode] ? "Empezar" : "Continuar"}
            </Button>
            <Button variant="secondary" onClick={reset} aria-label="Reiniciar temporizador">
              <RotateCcw className="h-4 w-4" /> Reiniciar
            </Button>
            <Button variant="ghost" onClick={askNotifications} title="Activar notificaciones">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Cada sesión completada se suma a tus estadísticas y racha diaria.
            {sessionsDone > 0 ? ` Hoy llevas ${sessionsDone} en esta sesión.` : ""}
          </p>
        </div>

        <div className="space-y-3">
          <StatCard
            icon={<TimerReset className="h-4 w-4 text-indigo-500" />}
            label="Hoy"
            value={`${stats?.today_minutes ?? 0} min`}
            tone="indigo"
          />
          <StatCard
            icon={<Flame className="h-4 w-4 text-orange-500" />}
            label="Racha"
            value={`${stats?.streak_days ?? 0} días`}
            tone="orange"
          />
          <StatCard
            icon={<Brain className="h-4 w-4 text-violet-500" />}
            label="Esta semana"
            value={`${stats?.week_minutes ?? 0} min`}
            tone="violet"
          />
          <StatCard
            icon={<Coffee className="h-4 w-4 text-emerald-500" />}
            label="Sesiones totales"
            value={`${stats?.total_sessions ?? 0}`}
            tone="emerald"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-300/45 bg-slate-100/65 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Últimos 7 días
          </h2>
          <span className="text-xs text-muted-foreground">minutos de enfoque</span>
        </div>
        <div className="mt-4 flex h-36 items-end gap-2">
          {(stats?.days ?? []).map((day) => {
            const height = Math.max(4, Math.round((day.minutes / maxDay) * 100));
            const label = new Date(`${day.date}T12:00:00`).toLocaleDateString("es-ES", {
              weekday: "short",
            });
            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-slate-500">{day.minutes}</span>
                <div className="flex h-24 w-full items-end rounded-lg bg-slate-50">
                  <div
                    className="w-full rounded-lg bg-gradient-to-t from-indigo-500 to-violet-400 transition-all duration-500"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-[10px] capitalize text-slate-400">{label}</span>
              </div>
            );
          })}
          {!stats && (
            <div className="flex w-full justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            </div>
          )}
        </div>
      </section>

      <DailyFocus agenda={agenda} loading={loading} onComplete={handleComplete} onReplan={load} />
    </div>
  );

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "indigo" | "orange" | "violet" | "emerald";
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-50 to-slate-100 border-indigo-100",
    orange: "from-orange-50 to-slate-100 border-orange-100",
    violet: "from-violet-50 to-slate-100 border-violet-100",
    emerald: "from-emerald-50 to-slate-100 border-emerald-100",
  };
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-4 shadow-sm", tones[tone])}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
