"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Download,
  HardDrive,
  Loader2,
  MonitorDown,
  ShieldCheck,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  clearLocalAppData,
  getLocalCacheStats,
  markLocalBackupNow,
  requestPersistentLocalStorage,
  type LocalCacheStats,
} from "@/lib/local-cache";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallWindow = Window & {
  __autopilotInstallPrompt?: BeforeInstallPromptEvent | null;
};

interface InstallAppButtonProps {
  compact?: boolean;
  className?: string;
  label?: string;
}

const EMPTY_STATS: LocalCacheStats = {
  entries: 0,
  drafts: 0,
  lastSavedAt: null,
  usageBytes: null,
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return "todavía no hay copia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "todavía no hay copia";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InstallAppButton({ compact = false, className, label }: InstallAppButtonProps) {
  const [open, setOpen] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [stats, setStats] = useState<LocalCacheStats>(EMPTY_STATS);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    setStats(await getLocalCacheStats());
  }, []);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      (window as InstallWindow).__autopilotInstallPrompt = null;
    };
    const syncCapturedPrompt = () => {
      const captured = (window as InstallWindow).__autopilotInstallPrompt;
      if (captured) setPromptEvent(captured);
    };
    syncCapturedPrompt();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("autopilot-install-ready", syncCapturedPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("autopilot-install-ready", syncCapturedPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshStats();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, refreshStats]);

  async function installNow() {
    if (!promptEvent) {
      setNotice(
        "Tu navegador no muestra el instalador automático. Usa las instrucciones de abajo o abre la web en Chrome o Edge.",
      );
      return;
    }
    setNotice(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setOpen(false);
    } else {
      setNotice("Instalación cancelada. Puedes intentarlo de nuevo cuando quieras.");
    }
    (window as InstallWindow).__autopilotInstallPrompt = null;
    setPromptEvent(null);
  }

  async function saveLocalCopy() {
    setSavingCopy(true);
    setNotice(null);
    try {
      await requestPersistentLocalStorage();
      const tasks: Array<() => Promise<unknown>> = [
        () => api.me(),
        () => api.tasks({ status: "pending" }),
        () => api.optimizedPlan(),
        () => api.today(),
        () => api.courses(),
        () => api.grades(),
        () => api.gradeSummary(),
        () => api.timetable(),
        () => api.notebooks(),
        () => api.files(),
        () => api.books(),
        () => api.classes(),
        () => api.scheduleBlocks(),
        () => api.focusStats(),
        () => api.focusSessions(20),
        () => api.flashcardStats(),
        () => api.quizzes(),
        () => api.getReminders(),
        () => api.assistantStatus(),
        () => api.syncStatus(),
      ];
      const results = await Promise.allSettled(tasks.map((call) => call()));
      let saved = results.filter((result) => result.status === "fulfilled").length;

      const classes = await api.classes().catch(() => []);
      for (const sharedClass of classes) {
        const calls: Array<() => Promise<unknown>> = [
          () => api.classDetail(sharedClass.id),
          () => api.classAssignments(sharedClass.id),
          () => api.classEvents(sharedClass.id),
          () => api.classFiles(sharedClass.id),
          () => api.classMessages(sharedClass.id),
          () => api.classNotebooks(sharedClass.id),
        ];
        const classResults = await Promise.allSettled(calls.map((call) => call()));
        saved += classResults.filter((result) => result.status === "fulfilled").length;
      }

      markLocalBackupNow();
      await refreshStats();
      if (saved === 0) {
        setNotice(
          "No se pudo guardar nada. Comprueba la conexión e inténtalo de nuevo cuando el servidor responda.",
        );
      } else {
        setNotice(
          `Copia local actualizada: ${saved} bloques de datos guardados en este dispositivo.`,
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo guardar la copia local.",
      );
    } finally {
      setSavingCopy(false);
    }
  }

  async function clearCopy() {
    if (
      !window.confirm(
        "¿Borrar la copia local de este dispositivo? Tus datos seguirán en tu cuenta, pero no podrás consultarlos sin conexión.",
      )
    ) {
      return;
    }
    setClearing(true);
    setNotice(null);
    try {
      await clearLocalAppData();
      await refreshStats();
      setNotice("Copia local borrada. Los datos de tu cuenta no se han tocado.");
    } finally {
      setClearing(false);
    }
  }

  const triggerLabel = label ?? (installed ? "App instalada" : "Descargar app");

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-app-title"
        className="my-auto w-full max-w-lg rounded-3xl border border-white/70 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25">
              <MonitorDown className="h-5 w-5" />
            </span>
            <div>
              <h2 id="install-app-title" className="text-lg font-bold tracking-tight">
                Lleva Autopilot a tu escritorio
              </h2>
              <p className="text-xs text-muted-foreground">
                Una ventana propia, acceso directo y tus datos a mano.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-fuchsia-50/60 p-4 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:to-fuchsia-500/10">
          {installed ? (
            <p className="flex items-start gap-2 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              Ya tienes la app instalada en este dispositivo. Ábrela desde tu escritorio o desde el menú
              de aplicaciones. No hace falta volver a instalarla.
            </p>
          ) : promptEvent ? (
            <div>
              <p className="text-xs leading-5 text-indigo-900 dark:text-indigo-100">
                El navegador puede instalarla ahora mismo. Se abrirá como una app independiente y podrás
                anclarla a la barra de tareas.
              </p>
              <Button className="mt-3 w-full sm:w-auto" onClick={() => void installNow()}>
                <Download className="h-4 w-4" />
                Instalar en este dispositivo
              </Button>
            </div>
          ) : (
            <div className="space-y-2 text-xs leading-5 text-indigo-900 dark:text-indigo-100">
              <p className="font-semibold">
                {isIos
                  ? "Para instalarla en iPhone o iPad:"
                  : "Tu navegador no muestra el instalador automático. Puedes hacerlo así:"}
              </p>
              <p>
                <strong>Chrome o Edge:</strong> pulsa el icono de instalar de la barra de direcciones
                (un monitor con una flecha) o abre el menú y busca{" "}
                <strong>Instalar aplicación</strong>.
              </p>
              <p>
                <strong>Safari en Mac:</strong> menú <strong>Compartir → Añadir al Dock</strong>.
              </p>
              <p>
                <strong>iPhone o iPad:</strong> <strong>Compartir → Añadir a pantalla de inicio</strong>.
              </p>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-200/80">
                Si no aparece la opción, abre esta web en Chrome o Edge actualizado.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <HardDrive className="h-4 w-4 text-indigo-500" /> Copia local en este dispositivo
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Guarda tus tareas, cuadernos, clases y la información de tu biblioteca para consultarlas sin
            conexión. Los apuntes que edites sin internet se guardan aquí y se sincronizan al volver la
            conexión.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{stats.entries} bloques guardados</span>
            <span>{stats.drafts} borradores locales</span>
            <span>{formatBytes(stats.usageBytes)} usados</span>
            <span>Última actualización: {formatDate(stats.lastSavedAt)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void saveLocalCopy()}
              disabled={savingCopy}
            >
              {savingCopy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {savingCopy ? "Guardando copia..." : "Guardar copia local ahora"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void clearCopy()}
              disabled={clearing || (stats.entries === 0 && stats.drafts === 0)}
              className="text-rose-500 hover:text-rose-700"
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Borrar copia local
            </Button>
          </div>
        </div>

        {notice && (
          <p
            role="status"
            className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs leading-5 text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-100"
          >
            {notice}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {installed ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" /> Instalada
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" /> Funciona mejor con conexión
              </>
            )}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "default"}
        size={compact ? "icon" : "default"}
        className={cn(!compact && "justify-start", className)}
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        title={triggerLabel}
      >
        <Download className="h-4 w-4" />
        {compact ? <span className="sr-only">{triggerLabel}</span> : <span>{triggerLabel}</span>}
      </Button>

      {open && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
