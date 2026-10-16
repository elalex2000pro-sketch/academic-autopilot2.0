"use client";

import { useCallback, useEffect, useState } from "react";

import { DailyFocus } from "@/components/daily-focus";
import { SchedulePlanner } from "@/components/schedule-planner";
import { SyncStatus } from "@/components/sync-status";
import { TaskList } from "@/components/task-list";
import { useRealtime } from "@/components/realtime-provider";
import { api } from "@/lib/api";
import type { DailyAgenda, OptimizedPlan, Task } from "@/lib/types";

export default function DashboardPage() {
  const [plan, setPlan] = useState<OptimizedPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agenda, setAgenda] = useState<DailyAgenda | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [optimized, pending, today] = await Promise.all([
        api.optimizedPlan(),
        api.tasks({ status: "pending" }),
        api.today(),
      ]);
      setPlan(optimized);
      setTasks(pending);
      setAgenda(today);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime((event) => {
    if (event.event === "tasks" || event.event === "schedule") {
      load();
    }
  });

  const handleComplete = useCallback(
    async (id: string) => {
      await api.completeTask(id);
      await load();
    },
    [load],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Tu plan de estudio priorizado y calendarizado de forma automatica.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DailyFocus
            agenda={agenda}
            loading={loading}
            onComplete={handleComplete}
            onReplan={load}
          />
          <SchedulePlanner plan={plan} />
        </div>

        <div className="space-y-6">
          <SyncStatus onSynced={load} />
          <TaskList tasks={tasks} loading={loading} onComplete={handleComplete} />
        </div>
      </div>
    </div>
  );
}
