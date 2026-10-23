"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, api } from "@/lib/api";
import {
  TASK_EXCLUSIONS_EVENT,
  applyTaskExclusions,
  getTaskExclusions,
  markTaskCompleted,
  markTaskDeleted,
  partitionTasks,
  restoreTaskExclusion,
  type TaskExclusions,
} from "@/lib/task-store";
import type { Task } from "@/lib/types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "No se pudieron actualizar las tareas.";
}

export interface UseTaskManagerOptions {
  /** Si es false, el consumidor llama a `refresh` dentro de su propia carga. */
  autoLoad?: boolean;
  /** Frecuencia con la que se recalcula que tareas han vencido. */
  clockIntervalMs?: number;
}

export interface TaskManager {
  /** Todas las tareas visibles tras aplicar las exclusiones locales. */
  tasks: Task[];
  activeTasks: Task[];
  overdueTasks: Task[];
  completedTasks: Task[];
  exclusions: TaskExclusions;
  loading: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<Task[]>;
  completeTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

/**
 * Gestor unico del estado de tareas en el cliente.
 *
 * - Descarga la lista no archivada del backend.
 * - Aplica las exclusiones persistentes de localStorage.
 * - Separa activas, vencidas y completadas.
 * - Actualiza la UI de forma optimista y revierte si la API falla.
 * - Escucha cambios de otra pestaña o de otros componentes.
 */
export function useTaskManager({
  autoLoad = true,
  clockIntervalMs = 60_000,
}: UseTaskManagerOptions = {}): TaskManager {
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [exclusions, setExclusions] = useState<TaskExclusions>(() => getTaskExclusions());
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncExclusions = useCallback(() => {
    setExclusions(getTaskExclusions());
  }, []);

  useEffect(() => {
    const handleChange = () => syncExclusions();
    window.addEventListener(TASK_EXCLUSIONS_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(TASK_EXCLUSIONS_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, [syncExclusions]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), clockIntervalMs);
    return () => clearInterval(timer);
  }, [clockIntervalMs]);

  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    setError(null);
    try {
      const fetched = await api.tasks();
      setRawTasks(fetched);
      // La copia offline puede venir de antes de completar/eliminar: se vuelve
      // a leer localStorage y se filtra en el render derivado.
      syncExclusions();
      setNow(Date.now());
      return fetched;
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [syncExclusions]);

  useEffect(() => {
    if (!autoLoad) return;
    void refresh({ silent: true }).catch(() => undefined);
  }, [autoLoad, refresh]);

  const tasks = useMemo(
    () => applyTaskExclusions(rawTasks, exclusions),
    [rawTasks, exclusions],
  );

  const partition = useMemo(() => partitionTasks(tasks, now), [tasks, now]);

  const completeTask = useCallback(async (id: string) => {
    const alreadyCompleted = getTaskExclusions().completedTaskIds.includes(id);
    // Persistencia inmediata: cualquier refresh posterior ya no la mostrara.
    markTaskCompleted(id);
    setExclusions(getTaskExclusions());
    try {
      await api.completeTask(id);
    } catch (cause) {
      if (!alreadyCompleted) {
        restoreTaskExclusion("completed", id);
        setExclusions(getTaskExclusions());
      }
      throw cause;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const alreadyDeleted = getTaskExclusions().deletedTaskIds.includes(id);
    markTaskDeleted(id);
    setExclusions(getTaskExclusions());
    try {
      await api.deleteTask(id);
    } catch (cause) {
      if (!alreadyDeleted) {
        restoreTaskExclusion("deleted", id);
        setExclusions(getTaskExclusions());
      }
      throw cause;
    }
  }, []);

  return {
    tasks,
    activeTasks: partition.active,
    overdueTasks: partition.overdue,
    completedTasks: partition.completed,
    exclusions,
    loading,
    error,
    refresh,
    completeTask,
    deleteTask,
  };
}
