"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { PriorityBadge } from "@/components/priority";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DailyAgenda, DailyAgendaItem } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function isNow(item: DailyAgendaItem): boolean {
  const now = Date.now();
  return now >= new Date(item.start_at).getTime() && now <= new Date(item.end_at).getTime();
}

/**
 * Modo Enfoque: muestra solo lo que toca hoy, a que hora, con progreso.
 * El reloj local actualiza cada 30s para resaltar el bloque en curso.
 */
export function DailyFocus({
  agenda,
  loading,
  onComplete,
  onReplan,
}: {
  agenda: DailyAgenda | null;
  loading: boolean;
  onComplete: (id: string) => void;
  onReplan: () => void;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const today = new Date().toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Card data-spotlight>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Plan de hoy · <span className="font-normal text-muted-foreground">{today}</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onReplan} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Replanificar
          </Button>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatMinutes(agenda?.completed_minutes ?? 0)} de{" "}
              {formatMinutes(agenda?.total_minutes ?? 0)}
            </span>
            <span>{Math.round(agenda?.progress_percent ?? 0)}%</span>
          </div>
          <Progress value={agenda?.progress_percent ?? 0} />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Cargando plan...</p>}
        {!loading && (agenda?.items.length ?? 0) === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay bloques para hoy. Disfruta el descanso o anade tareas.
          </p>
        )}

        {agenda?.items.map((item) => {
          const current = isNow(item);
          return (
            <div
              key={item.task_id}
              className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
                current
                  ? "border-primary/50 bg-primary/[0.07]"
                  : "border-white/50 bg-white/30 dark:border-white/10 dark:bg-white/[0.04]"
              }`}
            >
              <button
                aria-label="Completar sesion"
                onClick={() => onComplete(item.task_id)}
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {item.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <Circle className="h-6 w-6" />
                )}
              </button>

              <div className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatTime(item.start_at)}
                <span className="mx-1">–</span>
                {formatTime(item.end_at)}
              </div>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${item.completed ? "line-through opacity-60" : ""}`}>
                  {item.title}
                </p>
                {item.course_name && (
                  <p className="truncate text-xs text-muted-foreground">{item.course_name}</p>
                )}
              </div>

              {current && (
                <span className="hidden text-xs font-medium text-primary sm:block">Ahora</span>
              )}
              <PriorityBadge priority={item.priority} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
