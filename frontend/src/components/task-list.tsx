"use client";

import { CheckCircle2, Circle, FileSpreadsheet, ListTodo } from "lucide-react";

import { PriorityBadge } from "@/components/priority";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  moodle: "Moodle",
  google_classroom: "Classroom",
  manual: "Manual",
};

function dueLabel(iso: string | null): string {
  if (!iso) return "sin fecha";
  const date = new Date(iso);
  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return "vencida";
  if (diffDays === 0) return "vence hoy";
  if (diffDays === 1) return "vence manana";
  return `en ${diffDays} dias`;
}

/** Panel de tareas pendientes con accion de completar. */
export function TaskList({
  tasks,
  loading,
  onComplete,
}: {
  tasks: Task[];
  loading: boolean;
  onComplete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Tareas pendientes</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tasks.length} activas</span>
          <Button
            variant="ghost"
            size="sm"
            title="Descargar todas las tareas en Excel"
            onClick={() => api.exportTasksExcel().catch(() => undefined)}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Cargando tareas...</p>}
        {!loading && tasks.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListTodo className="h-4 w-4" /> No hay tareas pendientes.
          </div>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-start gap-3 rounded-md border border-border/60 px-3 py-2 transition-colors hover:bg-accent/40"
          >
            <button
              aria-label="Completar tarea"
              onClick={() => onComplete(task.id)}
              className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
            >
              {task.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{task.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{dueLabel(task.due_at)}</span>
                <span>·</span>
                <span>{formatMinutes(task.estimated_minutes)}</span>
                <Badge variant="outline">{SOURCE_LABEL[task.source] ?? task.source}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={task.priority} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
