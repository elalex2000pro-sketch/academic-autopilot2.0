"use client";

// Avisos del sistema en segundo plano.
//
// Se monta una vez dentro del shell (solo con sesion iniciada) y reutiliza
// `buildNotifications`, el mismo calculo que alimenta el centro de avisos: asi
// el aviso nativo y el panel nunca dicen cosas distintas. Cada elemento se
// avisa como maximo una vez al dia.

import { useEffect } from "react";

import { api } from "@/lib/api";
import { buildNotifications } from "@/lib/notifications";
import { isPastSchoolDay, TASK_REMINDER_EVENT } from "@/lib/task-snooze";
import {
  ensureSystemNotificationPermission,
  notifyOnce,
  supportsSystemNotifications,
  systemNotificationPermission,
} from "@/lib/system-notifications";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const PROMPTED_KEY = "autopilot_notify_prompted_v1";

function wasPrompted(): boolean {
  try {
    return window.localStorage.getItem(PROMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markPrompted(): void {
  try {
    window.localStorage.setItem(PROMPTED_KEY, "1");
  } catch {
    // Si no hay localStorage se volvera a preguntar en la proxima sesion.
  }
}

export function SystemNotifications() {
  useEffect(() => {
    if (!supportsSystemNotifications()) return;

    let cancelled = false;
    let checking = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function check(): Promise<void> {
      if (checking || cancelled) return;
      checking = true;
      try {
        const [tasks, grades, courses] = await Promise.all([
          api.tasks(),
          api.grades(),
          api.courses(),
        ]);
        if (cancelled) return;

        for (const item of buildNotifications({ tasks, grades, courses })) {
          if (cancelled) return;
          // Los avisos "task" son novedades recientes; el sistema solo debe
          // interrumpir por examenes y entregas.
          if (item.kind === "task") continue;
          // El dialogo de la app se encarga de las vencidas por dia local.
          if (item.kind === "deadline" && tasks.some((task) => item.id === `deadline:${task.id}` && isPastSchoolDay(task))) continue;
          await notifyOnce(item.id, {
            title: item.kind === "exam" ? "Examen proximo" : "Entrega por vencer",
            body: `${item.title} · ${item.meta}`,
            tag: item.id,
            url: item.href,
          });
        }
      } catch {
        // Sin red o sin sesion: se reintenta en el siguiente ciclo.
      } finally {
        checking = false;
      }
    }

    async function start(): Promise<void> {
      if (!wasPrompted()) {
        markPrompted();
        const granted = await ensureSystemNotificationPermission();
        if (!granted || cancelled) return;
      } else if (systemNotificationPermission() !== "granted") {
        return;
      }

      await check();
      if (cancelled) return;
      timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    }

    void start();
    const changed = () => { if (systemNotificationPermission() === "granted") void check(); };
    window.addEventListener(TASK_REMINDER_EVENT, changed);

    return () => {
      cancelled = true;
      window.removeEventListener(TASK_REMINDER_EVENT, changed);
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}
