"use client";

import { CalendarClock, Clock } from "lucide-react";

import { PriorityBadge } from "@/components/priority";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OptimizedPlan, OptimizedPlanItem } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeading(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function groupByDay(items: OptimizedPlanItem[]) {
  const groups = new Map<string, OptimizedPlanItem[]>();
  for (const item of items) {
    const key = new Date(item.start_at).toDateString();
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries());
}

/** Planificador horario: reparto de las sesiones de estudio por dia. */
export function SchedulePlanner({ plan }: { plan: OptimizedPlan | null }) {
  if (!plan || plan.scheduled.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan horario</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          Sin sesiones programadas. Anade disponibilidad en Ajustes y sincroniza.
        </CardContent>
      </Card>
    );
  }

  const groups = groupByDay(plan.scheduled);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Plan horario</CardTitle>
        <span className="text-xs text-muted-foreground">
          {plan.scheduled.length} sesiones · {formatMinutes(plan.total_scheduled_minutes)}
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map(([dayKey, items]) => (
          <div key={dayKey} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {formatDayHeading(items[0].start_at)}
            </h3>
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={`${item.task_id}-${item.start_at}`}
                  className="flex items-center gap-3 rounded-md border border-border/60 bg-secondary/30 px-3 py-2"
                >
                  <div className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(item.start_at)}–{formatTime(item.end_at)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.title}</p>
                    {item.course_name && (
                      <p className="truncate text-xs text-muted-foreground">{item.course_name}</p>
                    )}
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {formatMinutes(item.estimated_minutes)}
                  </span>
                  <PriorityBadge priority={item.priority} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
