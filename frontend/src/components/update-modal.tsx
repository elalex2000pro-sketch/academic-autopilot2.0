"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_SNOOZE_HOURS,
  UPDATE_CHECK_EVENT,
  checkForUpdates,
  formatBytes,
  getCurrentVersion,
  markVersionInstalled,
  shouldShowUpdate,
  snoozeUpdates,
  type AppUpdate,
  type UpdateChannel,
} from "@/lib/app-update";
import {
  getDesktopUpdater,
  type DesktopUpdaterState,
} from "@/lib/desktop-updater";
import { cn } from "@/lib/utils";

type Phase =
  | "hidden"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "done"
  | "current"
  | "error";

const CHECK_DELAY_MS = 2400;
const DOWNLOAD_DURATION_MS = 5600;

/**
 * Punto de entrada único de las actualizaciones.
 *
 * En Electron usa el puente `electron-updater`: la descarga ocurre en segundo
 * plano y solo aparece un aviso discreto cuando está lista. En web/PWA se
 * mantiene el modal con la comprobación de GitHub o `/version.json`.
 */
export function UpdateModal() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(getDesktopUpdater() !== null);
  }, []);

  if (desktop) return <DesktopUpdateToast />;
  return <WebUpdateModal />;
}

/**
 * Modal de actualizaciones con estética Apple Glass. Se monta en el layout
 * raíz para que también pueda aparecer sobre la pantalla de carga o login.
 */
function WebUpdateModal() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("hidden");
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [channel, setChannel] = useState<UpdateChannel>("web");
  const [currentVersion, setCurrentVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const checkingRef = useRef(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const runCheck = useCallback(async (force: boolean) => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const result = await checkForUpdates();

      if (!result.update) {
        if (force) {
          setChannel(result.channel);
          setCurrentVersion(result.currentVersion);
          setUpdate(null);
          setError("");
          setPhase("current");
        }
        return;
      }

      if (!force && !shouldShowUpdate(result.update)) return;

      setChannel(result.channel);
      setCurrentVersion(result.currentVersion);
      setUpdate(result.update);
      setProgress(0);
      setError("");
      setPhase("available");
    } catch {
      if (force) {
        setError(
          "No hemos podido comprobar si hay una versión nueva. Revisa tu conexión e inténtalo de nuevo.",
        );
        setPhase("error");
      }
      // En la comprobación automática, un fallo de red no molesta al usuario.
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // Comprobación automática al abrir la app, con una pequeña espera para no
  // competir con la carga inicial ni con la petición del perfil.
  useEffect(() => {
    if (!mounted) return;
    const timer = window.setTimeout(() => {
      void runCheck(false);
    }, CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [mounted, runCheck]);

  // Comprobación manual: se puede lanzar con requestUpdateCheck() o con el
  // evento desde Ajustes sin acoplar el modal a esa pantalla.
  useEffect(() => {
    if (!mounted) return;
    const handleCheck = () => {
      void runCheck(true);
    };
    window.addEventListener(UPDATE_CHECK_EVENT, handleCheck);
    return () => window.removeEventListener(UPDATE_CHECK_EVENT, handleCheck);
  }, [mounted, runCheck]);

  const closeModal = useCallback(() => {
    setPhase("hidden");
    setProgress(0);
    setError("");
  }, []);

  const handleLater = useCallback(() => {
    if (update) snoozeUpdates(update.channel, DEFAULT_SNOOZE_HOURS);
    closeModal();
  }, [closeModal, update]);

  const handleUpdate = useCallback(() => {
    setProgress(0);
    setPhase("downloading");
  }, []);

  const handleInstall = useCallback(() => {
    if (!update) return;

    markVersionInstalled(update.channel, update.version);
    setPhase("installing");

    if (update.channel === "desktop") {
      // En Electron este window.open lo intercepta main.js y lo abre en el
      // navegador del sistema, donde el instalador se descarga.
      window.open(update.downloadUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => setPhase("done"), 900);
      return;
    }

    // Web / PWA: activa el service worker nuevo si está esperando y recarga.
    try {
      void navigator.serviceWorker
        ?.getRegistration()
        .then((registration) => {
          registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
        })
        .catch(() => {
          // Si no hay service worker, la recarga normal es suficiente.
        });
    } catch {
      // Navegadores sin serviceWorker.
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 1500);
  }, [update]);

  const handleRetry = useCallback(() => {
    closeModal();
    void runCheck(true);
  }, [closeModal, runCheck]);

  const handleDismiss = useCallback(() => {
    if (phase === "installing") return;
    if (phase === "available" || phase === "ready" || phase === "downloading") {
      handleLater();
      return;
    }
    closeModal();
  }, [closeModal, handleLater, phase]);

  const handleBackdrop = useCallback(() => {
    if (phase === "downloading" || phase === "installing") return;
    handleDismiss();
  }, [handleDismiss, phase]);

  // Bloquea el scroll de la página mientras el modal está abierto.
  useEffect(() => {
    if (phase === "hidden") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  // Escape cierra o cancela y Tab queda atrapado dentro del diálogo.
  useEffect(() => {
    if (phase === "hidden") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.offsetParent !== null);

        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (event.key !== "Escape") return;
      if (phase === "installing") return;
      event.preventDefault();
      handleDismiss();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDismiss, phase]);

  // Lleva el foco al botón principal (o al diálogo si está descargando).
  useEffect(() => {
    if (phase === "hidden") return;
    const timer = window.setTimeout(() => {
      const primary = primaryRef.current;
      const target = primary && !primary.disabled ? primary : dialogRef.current;
      target?.focus();
    }, 90);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Progreso simulado: la descarga real del instalador la gestiona el
  // navegador / Electron. Aquí damos feedback inmediato y continuo.
  useEffect(() => {
    if (phase !== "downloading") return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 1400 : DOWNLOAD_DURATION_MS;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 2.6);
      const next = Math.min(99, Math.round(eased * 100));
      setProgress(next);

      if (elapsed >= 1) {
        setProgress(100);
        setPhase("ready");
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // Si la recarga web no llega a producirse, deja una salida manual.
  useEffect(() => {
    if (phase !== "installing") return;
    const timer = window.setTimeout(() => {
      setPhase((current) => (current === "installing" ? "done" : current));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const notes = useMemo(() => {
    if (update?.notes.length) return update.notes;
    return ["Mejoras de rendimiento y correcciones de errores."];
  }, [update]);

  if (!mounted || phase === "hidden") return null;

  const isDesktop = channel === "desktop";
  const totalSize = update?.sizeBytes ?? 0;
  const downloadedBytes = totalSize > 0 ? Math.round((totalSize * progress) / 100) : 0;

  const badge =
    phase === "available"
      ? "Actualización disponible"
      : phase === "downloading"
        ? "Descargando"
        : phase === "ready"
          ? "Lista para instalar"
          : phase === "installing"
            ? "Instalando"
            : phase === "done"
              ? isDesktop
                ? "Descarga iniciada"
                : "Lista para aplicar"
              : phase === "current"
                ? "Todo al día"
                : "No se pudo comprobar";

  const title =
    phase === "available" && update
      ? `Nueva actualización disponible (v${update.version})`
      : phase === "downloading"
        ? "Descargando la actualización"
        : phase === "ready"
          ? "Actualización lista para instalar"
          : phase === "installing"
            ? "Aplicando la actualización"
            : phase === "done"
              ? "Actualización preparada"
              : phase === "current"
                ? "Estás al día"
                : "No se pudo comprobar la actualización";

  const description =
    phase === "available" && update
      ? `Tienes la versión ${currentVersion}. La versión ${update.version} ya está disponible para ${
          isDesktop ? "Windows" : "la web y la PWA"
        }.`
      : phase === "downloading"
        ? "Mantén la app abierta mientras preparamos la nueva versión."
        : phase === "ready"
          ? isDesktop
            ? "El instalador está listo. Se abrirá en tu navegador para que lo ejecutes."
            : "La nueva versión se aplicará al reiniciar la app."
          : phase === "installing"
            ? isDesktop
              ? "Abriendo la descarga del instalador. No cierres esta ventana."
              : "Reiniciando para aplicar los cambios. No cierres esta ventana."
            : phase === "done"
              ? isDesktop
                ? "Hemos abierto la descarga del instalador en tu navegador. Ejecútalo para completar la actualización."
                : "La actualización está lista. Recarga la app para aplicar los cambios."
              : phase === "current"
                ? `Ya tienes la última versión disponible (v${currentVersion}).`
                : error;

  const progressLabel =
    phase === "downloading"
      ? totalSize > 0
        ? `${formatBytes(downloadedBytes)} de ${formatBytes(totalSize)}`
        : "Descargando paquete…"
      : phase === "ready"
        ? totalSize > 0
          ? `${formatBytes(totalSize)} descargados`
          : "Descarga completada"
        : "Aplicando cambios…";

  const badgeClass =
    phase === "ready" || phase === "done" || phase === "current"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : phase === "error"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-primary/20 bg-primary/10 text-primary";

  const iconShellClass = cn(
    "relative flex h-16 w-16 items-center justify-center rounded-[22px] text-white",
    phase === "ready" || phase === "done" || phase === "current"
      ? "bg-gradient-to-br from-[#30D158] via-[#28B84B] to-[#149A3C] shadow-[0_18px_40px_-14px_rgba(48,209,88,0.65),inset_0_1px_0_rgba(255,255,255,0.45)]"
      : phase === "error"
        ? "bg-gradient-to-br from-[#FF9F0A] via-[#FF8A00] to-[#E06D00] shadow-[0_18px_40px_-14px_rgba(255,159,10,0.6),inset_0_1px_0_rgba(255,255,255,0.45)]"
        : "bg-gradient-to-br from-[#0A84FF] via-[#1E7BFF] to-[#5E5CE6] shadow-[0_18px_40px_-14px_rgba(10,132,255,0.75),inset_0_1px_0_rgba(255,255,255,0.45)]",
  );

  const icon =
    phase === "downloading" ? (
      <Download className="update-icon-bob h-7 w-7" strokeWidth={1.9} />
    ) : phase === "ready" || phase === "done" ? (
      <Check className="animate-check-pop h-7 w-7" strokeWidth={2.7} />
    ) : phase === "installing" ? (
      <Loader2 className="h-7 w-7 animate-spin" strokeWidth={2} />
    ) : phase === "current" ? (
      <ShieldCheck className="h-7 w-7" strokeWidth={2} />
    ) : phase === "error" ? (
      <RefreshCw className="h-7 w-7" strokeWidth={2} />
    ) : (
      <Download className="update-icon-bob h-7 w-7" strokeWidth={1.9} />
    );

  const badgeIcon =
    phase === "ready" || phase === "done" || phase === "current" ? (
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    ) : phase === "error" ? (
      <RefreshCw className="h-2.5 w-2.5" strokeWidth={2.6} />
    ) : (
      <Sparkles className="h-2.5 w-2.5" strokeWidth={2.4} />
    );

  const primaryButtonClass =
    "h-10 rounded-2xl bg-[#0A84FF] px-5 text-[13px] text-white shadow-[0_12px_28px_-12px_rgba(10,132,255,0.85),inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-[#0077ED]";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="animate-fade-in absolute inset-0 bg-slate-950/20 backdrop-blur-md dark:bg-black/55"
        onClick={handleBackdrop}
        aria-hidden
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
        aria-describedby="update-modal-description"
        tabIndex={-1}
        className="animate-update-in relative max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-[30px] border border-slate-300/40 bg-gradient-to-br from-[#eef1f5]/92 via-[#e8ecf1]/88 to-[#dfe5ec]/82 p-6 text-foreground shadow-[0_0_0_0.5px_rgba(32,39,48,0.08),0_28px_90px_-30px_rgba(32,39,48,0.38),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-3xl focus:outline-none dark:border-white/[0.12] dark:from-[#20222b]/95 dark:via-[#14161e]/92 dark:to-[#090b10]/90 dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.08),0_28px_90px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] sm:max-h-[calc(100dvh-3rem)] sm:p-7"
      >
        <div className="pointer-events-none absolute -top-20 left-1/2 h-48 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl dark:bg-primary/30" />

        {phase !== "installing" && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar"
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-slate-200/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative">
          <div className="relative mx-auto flex h-[72px] w-[72px] items-center justify-center">
            <span className="update-icon-ring absolute inset-0 rounded-[26px] border border-primary/30 bg-primary/10" />
            <span
              className="update-icon-ring absolute inset-0 rounded-[26px] border border-primary/20 bg-primary/5"
              style={{ animationDelay: "0.7s" }}
            />
            <span className={iconShellClass}>
              {icon}
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300/40 bg-slate-100 text-primary shadow-sm dark:border-white/20 dark:bg-[#1c1e26]">
                {badgeIcon}
              </span>
            </span>
          </div>

          <div className="mt-5 text-center">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.09em]",
                badgeClass,
              )}
            >
              {badge}
            </span>
            <h2
              id="update-modal-title"
              className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.03em] text-foreground"
            >
              {title}
            </h2>
            <p
              id="update-modal-description"
              className="mx-auto mt-2 max-w-[380px] text-[13px] leading-relaxed text-muted-foreground"
            >
              {description}
            </p>

            {update && (phase === "available" || phase === "ready") && (
              <div className="mt-3 flex items-center justify-center gap-2 text-[11.5px]">
                <span className="rounded-full border border-slate-300/40 bg-slate-100/60 px-2.5 py-1 font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]">
                  v{currentVersion}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                  v{update.version}
                </span>
              </div>
            )}

            {phase === "current" && (
              <div className="mt-3 flex items-center justify-center">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                  v{currentVersion}
                </span>
              </div>
            )}
          </div>

          {phase === "available" && (
            <div className="mt-5 rounded-2xl border border-slate-300/40 bg-slate-100/55 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Novedades
                </p>
                <div className="flex items-center gap-2">
                  {update?.sizeBytes ? (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {formatBytes(update.sizeBytes)}
                    </span>
                  ) : null}
                  {update?.releaseUrl ? (
                    <a
                      href={update.releaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-primary transition-opacity hover:opacity-80"
                    >
                      Ver release <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : null}
                </div>
              </div>

              <ul className="mt-2.5 max-h-[174px] space-y-2 overflow-y-auto pr-1">
                {notes.map((note, index) => (
                  <li
                    key={`${note}-${index}`}
                    className="flex gap-2.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-white/70"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(phase === "downloading" || phase === "ready" || phase === "installing") && (
            <div className="mt-5 rounded-2xl border border-slate-300/40 bg-slate-100/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium text-foreground">
                    {phase === "ready"
                      ? "Descarga completada"
                      : phase === "installing"
                        ? "Preparando instalación"
                        : "Descargando actualización…"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {phase === "ready"
                      ? isDesktop
                        ? "Instalador listo"
                        : "Listo para reiniciar"
                      : phase === "installing"
                        ? "Aplicando los últimos cambios"
                        : "Conexión segura"}
                  </p>
                </div>
                <span className="tabular text-[24px] font-semibold leading-none text-foreground">
                  {progress}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-valuetext={
                  phase === "downloading"
                    ? `${progress}% descargado`
                    : phase === "ready"
                      ? "Descarga completada"
                      : "Aplicando la actualización"
                }
                aria-label="Progreso de la descarga"
                className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-slate-900/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white/10"
              >
                <div
                  className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#0A84FF] via-[#2F7BFF] to-[#5E5CE6] transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                >
                  <span className="update-progress-shine absolute inset-y-0 left-0 w-1/2" />
                </div>
              </div>

              <span className="sr-only" aria-live="polite">
                {phase === "downloading"
                  ? `Descarga al ${Math.floor(progress / 25) * 25} por ciento`
                  : phase === "ready"
                    ? "Descarga completada"
                    : "Aplicando la actualización"}
              </span>

              <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground">
                <span className="tabular">{progressLabel}</span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Verificado
                </span>
              </div>
            </div>
          )}

          <div className="mt-6">
            {phase === "available" && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLater}
                  className="h-10 rounded-2xl px-4"
                >
                  Recordar más tarde
                </Button>
                <Button
                  ref={primaryRef}
                  type="button"
                  onClick={handleUpdate}
                  className={primaryButtonClass}
                >
                  <Download className="h-4 w-4" /> Actualizar ahora
                </Button>
              </div>
            )}

            {phase === "downloading" && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLater}
                  className="h-10 rounded-2xl px-4"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled
                  className={cn(primaryButtonClass, "disabled:opacity-100")}
                >
                  <Loader2 className="h-4 w-4 animate-spin" /> Descargando… {progress}%
                </Button>
              </div>
            )}

            {phase === "ready" && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLater}
                  className="h-10 rounded-2xl px-4"
                >
                  Más tarde
                </Button>
                <Button
                  ref={primaryRef}
                  type="button"
                  onClick={handleInstall}
                  className={primaryButtonClass}
                >
                  <RefreshCw className="h-4 w-4" />
                  {isDesktop ? "Abrir instalador" : "Reiniciar e instalar"}
                </Button>
              </div>
            )}

            {phase === "installing" && (
              <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isDesktop ? "Abriendo el instalador…" : "Reiniciando…"}
              </div>
            )}

            {phase === "done" && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {isDesktop ? (
                  update ? (
                    <Button
                      type="button"
                      variant="outline"
                      asChild
                      className="h-10 rounded-2xl px-4"
                    >
                      <a href={update.downloadUrl} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" /> Descargar instalador
                      </a>
                    </Button>
                  ) : null
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    className="h-10 rounded-2xl px-4"
                  >
                    Cerrar
                  </Button>
                )}
                <Button
                  ref={primaryRef}
                  type="button"
                  onClick={isDesktop ? closeModal : () => window.location.reload()}
                  className={primaryButtonClass}
                >
                  {isDesktop ? (
                    <>
                      <Check className="h-4 w-4" /> Cerrar
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" /> Recargar
                    </>
                  )}
                </Button>
              </div>
            )}

            {phase === "current" && (
              <div className="flex justify-center">
                <Button
                  ref={primaryRef}
                  type="button"
                  onClick={closeModal}
                  className={primaryButtonClass}
                >
                  <Check className="h-4 w-4" /> Cerrar
                </Button>
              </div>
            )}

            {phase === "error" && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="h-10 rounded-2xl px-4"
                >
                  Cerrar
                </Button>
                <Button
                  ref={primaryRef}
                  type="button"
                  onClick={handleRetry}
                  className={primaryButtonClass}
                >
                  <RefreshCw className="h-4 w-4" /> Reintentar
                </Button>
              </div>
            )}
          </div>

          {(phase === "available" || phase === "ready") && (
            <p className="mt-3 text-center text-[10.5px] text-muted-foreground/80">
              Se te recordará mañana si decides esperar.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Aviso no bloqueante para la app de escritorio.
 *
 * El proceso principal ya descarga la actualización; aquí solo se muestra el
 * progreso mientras ocurre y, al terminar, el aviso con el reinicio. No hay
 * modal ni descarga manual: el instalador se aplica al reiniciar.
 */
function DesktopUpdateToast() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<DesktopUpdaterState | null>(null);
  const [manual, setManual] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState("");
  const checkingRef = useRef(false);
  const currentVersion = getCurrentVersion("desktop");

  useEffect(() => {
    setMounted(true);
    const updater = getDesktopUpdater();
    if (!updater) return;

    let active = true;
    updater
      .getState()
      .then((next) => {
        // Si un evento llegó antes que la respuesta, ese estado es más nuevo.
        if (active) setState((current) => current ?? next);
      })
      .catch(() => undefined);

    const unsubscribe = updater.onState((next) => {
      if (!active) return;
      setState(next);
      if (next.status === "ready" && next.version) {
        setDismissedVersion((current) => (current === next.version ? current : null));
        setInstalling(false);
        setInstallError("");
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // La comprobación manual de Ajustes usa el mismo evento que en web, pero
  // aquí se resuelve contra electron-updater.
  useEffect(() => {
    if (!mounted) return;
    const handleCheck = () => {
      const updater = getDesktopUpdater();
      if (!updater || checkingRef.current) return;

      checkingRef.current = true;
      setManual(true);
      setInstallError("");
      setState((current) =>
        current ? { ...current, status: "checking", error: null } : current,
      );

      updater
        .check()
        .then((next) => setState(next))
        .catch((error) => {
          setState((current) =>
            current
              ? {
                  ...current,
                  status: "error",
                  error:
                    error instanceof Error && error.message.trim()
                      ? error.message
                      : "No se pudo comprobar la actualización.",
                }
              : current,
          );
        })
        .finally(() => {
          checkingRef.current = false;
        });
    };

    window.addEventListener(UPDATE_CHECK_EVENT, handleCheck);
    return () => window.removeEventListener(UPDATE_CHECK_EVENT, handleCheck);
  }, [mounted]);

  // Los avisos de "al día" o de error manual se retiran solos; el aviso de
  // versión lista permanece hasta reiniciar o descartarlo.
  useEffect(() => {
    if (!manual || !state) return;
    if (state.status !== "current" && state.status !== "disabled") return;
    const timer = window.setTimeout(() => setManual(false), 5000);
    return () => window.clearTimeout(timer);
  }, [manual, state]);

  if (!mounted || !state) return null;

  const status = state.status;
  const version = state.version ?? "";
  const isReady = status === "ready";
  const isDownloading = status === "available" || status === "downloading";
  const isChecking = status === "checking";
  const isCurrent = status === "current";
  const isError = status === "error";
  const isDisabled = status === "disabled";

  if (isReady && dismissedVersion === version) return null;
  if (
    !isReady &&
    !isDownloading &&
    !(manual && (isChecking || isCurrent || isError || isDisabled))
  ) {
    return null;
  }

  const progress = Math.max(0, Math.min(100, Math.round(state.progress || 0)));

  async function restartNow() {
    const updater = getDesktopUpdater();
    if (!updater) return;
    setInstalling(true);
    setInstallError("");
    try {
      const result = await updater.install();
      if (!result.ok) {
        setInstallError(
          result.reason === "not-ready"
            ? "La actualización todavía se está preparando. Inténtalo en unos segundos."
            : "No se pudo reiniciar la app. Ciérrala y vuelve a abrirla para aplicar la versión nueva.",
        );
        setInstalling(false);
      }
    } catch {
      setInstallError(
        "No se pudo reiniciar la app. Ciérrala y vuelve a abrirla para aplicar la versión nueva.",
      );
      setInstalling(false);
    }
  }

  return createPortal(
    <div
      className="fixed bottom-20 right-3 z-[120] w-[calc(100vw-1.5rem)] max-w-[380px] sm:bottom-5 sm:right-5"
      role="status"
      aria-live="polite"
    >
      {isReady ? (
        <div className="animate-fade-up overflow-hidden rounded-[22px] border border-emerald-500/25 bg-gradient-to-br from-white/95 to-white/85 p-4 shadow-[0_22px_60px_-24px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl dark:border-emerald-400/20 dark:from-[#18201b]/95 dark:to-[#0c120e]/90 dark:shadow-[0_22px_60px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#30D158] to-[#149A3C] text-white shadow-[0_10px_22px_-10px_rgba(48,209,88,0.8)]">
              <Check className="h-5 w-5" strokeWidth={2.7} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-5 text-slate-800 dark:text-white/90">
                Nueva versión lista. Se aplicará al reiniciar la app
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-white/40">
                {version
                  ? `v${version} descargada en segundo plano.`
                  : "Descarga completada en segundo plano."}
              </p>
              {installError && (
                <p className="mt-2 rounded-lg border border-rose-300/50 bg-rose-500/10 px-2.5 py-1.5 text-[10.5px] leading-4 text-rose-700 dark:border-rose-400/20 dark:text-rose-200">
                  {installError}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void restartNow()}
                  disabled={installing}
                  className="h-8 rounded-xl bg-[#0A84FF] px-3 text-[11.5px] text-white hover:bg-[#0077ED]"
                >
                  {installing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {installing ? "Reiniciando…" : "Reiniciar ahora"}
                </Button>
                <button
                  type="button"
                  onClick={() => setDismissedVersion(version)}
                  disabled={installing}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-50 dark:text-white/40 dark:hover:text-white/80"
                >
                  Más tarde
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedVersion(version)}
              disabled={installing}
              aria-label="Cerrar aviso de actualización"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 disabled:opacity-50 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : isDownloading ? (
        <div className="overflow-hidden rounded-[20px] border border-slate-300/45 bg-white/90 p-3.5 shadow-[0_18px_45px_-22px_rgba(15,23,42,0.4),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl dark:border-white/[0.1] dark:bg-[#12151c]/92 dark:shadow-[0_18px_45px_-18px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0A84FF]/12 text-[#0A84FF] dark:bg-[#0A84FF]/20 dark:text-[#7ab7ff]">
              <Download className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] font-medium text-slate-700 dark:text-white/80">
                  Descargando actualización…
                </p>
                <span className="tabular text-[10.5px] font-semibold text-slate-500 dark:text-white/45">
                  {progress}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-900/[0.08] dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0A84FF] to-[#5E5CE6] transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">
                Se instalará sola al reiniciar. Puedes seguir trabajando.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-slate-300/45 bg-white/92 p-3.5 shadow-[0_18px_45px_-22px_rgba(15,23,42,0.4),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl dark:border-white/[0.1] dark:bg-[#12151c]/92 dark:shadow-[0_18px_45px_-18px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                isError
                  ? "bg-amber-500/12 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                  : "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
              )}
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isError ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-medium text-slate-700 dark:text-white/80">
                {isChecking
                  ? "Buscando actualizaciones…"
                  : isError
                    ? "No se pudo comprobar la actualización"
                    : isDisabled
                      ? "Actualizaciones automáticas no disponibles"
                      : "Estás al día"}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-4 text-slate-500 dark:text-white/40">
                {isChecking
                  ? "Comprobando si hay una versión nueva."
                  : isError
                    ? state.error || "Revisa tu conexión e inténtalo de nuevo."
                    : isDisabled
                      ? "Esta función solo está activa en la app instalada."
                      : `Ya tienes la última versión${
                          currentVersion ? ` (v${currentVersion})` : ""
                        }.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManual(false)}
              aria-label="Cerrar aviso"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
