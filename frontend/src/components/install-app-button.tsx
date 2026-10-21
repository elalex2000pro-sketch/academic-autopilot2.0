"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Download,
  HardDrive,
  Loader2,
  MonitorDown,
  ShieldAlert,
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

type DevicePlatform = "windows" | "mac" | "ios" | "android" | "other";

const WINDOWS_INSTALLER_URL =
  "https://github.com/elalex2000pro-sketch/academic-autopilot2.0/releases/latest/download/Academic-Autopilot-Setup.exe";
const DESKTOP_RELEASE_URL =
  "https://github.com/elalex2000pro-sketch/academic-autopilot2.0/releases/latest";
const INSTALLER_SIZE = "107 MB";

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
  const [webAppInstalled, setWebAppInstalled] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>("other");
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null);
  const [savingCopy, setSavingCopy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [stats, setStats] = useState<LocalCacheStats>(EMPTY_STATS);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    setStats(await getLocalCacheStats());
  }, []);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const desktopMatch = userAgent.match(/AcademicAutopilotDesktop\/([\d.]+)/i);
    const isIosDevice =
      /iphone|ipad|ipod/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setPlatform(
      /windows/i.test(userAgent)
        ? "windows"
        : isIosDevice
          ? "ios"
          : /android/i.test(userAgent)
            ? "android"
            : /macintosh|mac os x/i.test(userAgent)
              ? "mac"
              : "other",
    );
    setIsDesktopApp(Boolean(desktopMatch));
    setDesktopVersion(desktopMatch?.[1] ?? null);

    const standalone =
      !desktopMatch &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setWebAppInstalled(standalone);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setWebAppInstalled(true);
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

  async function installWebApp() {
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
      setWebAppInstalled(true);
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

  const isWindows = platform === "windows";
  const triggerLabel = label ?? (isDesktopApp ? "App de escritorio" : "Descargar app");

  const installCard = isDesktopApp ? (
    <div>
      <p className="flex items-start gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
        Ya estás usando la app de escritorio
        {desktopVersion ? ` (versión ${desktopVersion})` : ""}.
      </p>
      <p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
        No necesitas instalar nada más. Las mejoras de la web se aplican automáticamente. Si quieres
        reparar o volver a instalar la app, descarga el instalador de nuevo.
      </p>
      <Button variant="secondary" size="sm" className="mt-3" asChild>
        <a href={WINDOWS_INSTALLER_URL}>
          <MonitorDown className="h-4 w-4" />
          Descargar instalador de Windows
        </a>
      </Button>
    </div>
  ) : isWindows ? (
    <div>
      <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-50">
        Instalador para Windows 10 y 11
      </p>
      <p className="mt-1 text-xs leading-5 text-indigo-900/80 dark:text-indigo-100/80">
        Descarga el archivo, ábrelo y sigue los pasos. Tendrás Academic Autopilot en su propia ventana,
        con acceso directo en el escritorio y sin abrir el navegador.
      </p>
      <Button
        asChild
        size="lg"
        className="mt-3 w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700 sm:w-auto"
      >
        <a href={WINDOWS_INSTALLER_URL}>
          <MonitorDown className="h-4 w-4" />
          Descargar instalador para Windows
        </a>
      </Button>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-indigo-800/75 dark:text-indigo-200/75">
        <span>64 bits</span>
        <span aria-hidden="true">·</span>
        <span>{INSTALLER_SIZE}</span>
        <span aria-hidden="true">·</span>
        <span>Versión 1.0.0</span>
        <span aria-hidden="true">·</span>
        <a
          href={DESKTOP_RELEASE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-indigo-950 dark:hover:text-white"
        >
          Notas de la versión
        </a>
      </div>
      <div className="mt-3 flex gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Windows puede avisar de que el editor es desconocido porque el instalador no está firmado.
          Pulsa <strong>Más información → Ejecutar de todas formas</strong>.
        </span>
      </div>
    </div>
  ) : (
    <div>
      <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-50">
        El instalador es para Windows
      </p>
      <p className="mt-1 text-xs leading-5 text-indigo-900/80 dark:text-indigo-100/80">
        En este dispositivo puedes usar Autopilot como app web instalable, con su propia ventana y
        acceso directo. Tus datos y tu cuenta son los mismos.
      </p>
      <p className="mt-2 text-[11px] leading-5 text-indigo-800/75 dark:text-indigo-200/75">
        {platform === "ios"
          ? "En iPhone o iPad: abre esta página en Safari y pulsa Compartir → Añadir a pantalla de inicio."
          : platform === "mac"
            ? "En Mac: en Safari, Compartir → Añadir al Dock. En Chrome o Edge, menú → Instalar aplicación."
            : platform === "android"
              ? "En Android: abre el menú de Chrome y pulsa Instalar aplicación o Añadir a pantalla de inicio."
              : "En Chrome o Edge: abre el menú y pulsa Instalar aplicación."}
      </p>
      <a
        href={WINDOWS_INSTALLER_URL}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-950 dark:text-indigo-200 dark:hover:text-white"
      >
        <MonitorDown className="h-3.5 w-3.5" />
        También puedes descargar el instalador para un PC con Windows
      </a>
    </div>
  );

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
                Instala Autopilot en tu ordenador
              </h2>
              <p className="text-xs text-muted-foreground">
                Un programa propio para Windows, sin abrir el navegador.
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
          {installCard}
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

        {!isDesktopApp && (
          <div className="mt-4 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Download className="h-4 w-4 text-indigo-500" /> Otra opción: instalar como app web
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Si no quieres descargar el instalador, puedes abrir Autopilot como una app web en este
              dispositivo. Es la misma cuenta y los mismos datos.
            </p>
            {webAppInstalled ? (
              <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                Ya tienes la app web instalada. Ábrela desde tu escritorio o menú de aplicaciones.
              </p>
            ) : promptEvent ? (
              <Button className="mt-3" size="sm" onClick={() => void installWebApp()}>
                <Download className="h-4 w-4" />
                Instalar app web en este dispositivo
              </Button>
            ) : (
              <div className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                <p>
                  <strong>Chrome o Edge:</strong> pulsa el icono de instalar de la barra de direcciones o
                  abre el menú y busca <strong>Instalar aplicación</strong>.
                </p>
                <p>
                  <strong>Safari en Mac:</strong> menú <strong>Compartir → Añadir al Dock</strong>.
                </p>
                <p>
                  <strong>iPhone o iPad:</strong> <strong>Compartir → Añadir a pantalla de inicio</strong>.
                </p>
              </div>
            )}
          </div>
        )}

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
            {isDesktopApp || webAppInstalled ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" /> Instalada
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" /> Necesita conexión para sincronizar
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
