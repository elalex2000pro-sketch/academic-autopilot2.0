"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  CalendarClock,
  ChevronRight,
  Clock3,
  ListTodo,
  Loader2,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { lockBodyScroll } from "@/lib/scroll-lock";
import { useRealtime } from "@/components/realtime-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  GRADE_CHANGE_EVENT,
  GRADE_CHANGE_STORAGE_KEY,
} from "@/lib/grade-events";
import {
  NOTIFICATIONS_SEEN_KEY,
  buildNotifications,
  formatNotificationAge,
  mergeSeenNotificationIds,
  readSeenNotificationIds,
  unreadNotificationIds,
  writeSeenNotificationIds,
  type AppNotification,
  type NotificationKind,
  type NotificationTone,
} from "@/lib/notifications";
import {
  COMPLETED_TASK_IDS_KEY,
  DELETED_TASK_IDS_KEY,
  TASK_EXCLUSIONS_EVENT,
  applyTaskExclusions,
} from "@/lib/task-store";
import type { Course, Grade, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 10 * 60_000;
const INITIAL_LOAD_DELAY_MS = 2_200;

interface NotificationCenterValue {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  items: AppNotification[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  unreadCount: number;
  updatedAt: number | null;
  refresh: () => Promise<void>;
}

const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

/**
 * Proveedor global del centro de avisos.
 *
 * Descarga tareas, notas y asignaturas una sola vez para toda la app, mantiene
 * el estado de leído en localStorage y expone `NotificationBell` a la barra
 * superior de escritorio, a la cabecera móvil y a las vistas inmersivas.
 */
export function NotificationCenter({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>(() => readSeenNotificationIds());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const requestRef = useRef(0);
  const loadStartedRef = useRef(false);

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!user) return;
      loadStartedRef.current = true;
      const requestId = ++requestRef.current;

      if (options.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [tasksResult, gradesResult, coursesResult] = await Promise.allSettled([
          api.tasks(),
          api.grades(),
          api.courses(),
        ]);

        if (requestId !== requestRef.current) return;

        let loadedSomething = false;
        if (tasksResult.status === "fulfilled") {
          setTasks(applyTaskExclusions(tasksResult.value));
          loadedSomething = true;
        }
        if (gradesResult.status === "fulfilled") {
          setGrades(gradesResult.value);
          loadedSomething = true;
        }
        if (coursesResult.status === "fulfilled") {
          setCourses(coursesResult.value);
        }

        if (!loadedSomething) {
          setError("No se pudieron cargar los avisos. Revisa tu conexión e inténtalo de nuevo.");
        } else {
          setUpdatedAt(Date.now());
        }
        setNow(Date.now());
      } catch {
        if (requestId === requestRef.current) {
          setError("No se pudieron cargar los avisos. Inténtalo de nuevo.");
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [user],
  );

  // Primera carga diferida para no competir con el dashboard. Después se
  // actualiza cada diez minutos y cuando llega un cambio por WebSocket.
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadStartedRef.current = false;
    const timer = window.setTimeout(() => {
      if (!loadStartedRef.current) void load();
    }, INITIAL_LOAD_DELAY_MS);
    const interval = window.setInterval(() => {
      void load({ silent: true });
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load, user]);

  useRealtime((event) => {
    if (event.event === "tasks" || event.event === "grades" || event.event === "courses") {
      void load({ silent: true });
    }
  });

  // Cambios locales (tareas completadas/eliminadas, notas) y sincronización
  // entre pestañas. El evento "storage" no se dispara en la pestaña actual.
  useEffect(() => {
    const refresh = () => void load({ silent: true });
    const onStorage = (event: StorageEvent) => {
      if (event.key === NOTIFICATIONS_SEEN_KEY) {
        setSeenIds(readSeenNotificationIds());
        return;
      }
      if (
        event.key === COMPLETED_TASK_IDS_KEY ||
        event.key === DELETED_TASK_IDS_KEY ||
        event.key === GRADE_CHANGE_STORAGE_KEY
      ) {
        refresh();
      }
    };

    window.addEventListener(TASK_EXCLUSIONS_EVENT, refresh);
    window.addEventListener(GRADE_CHANGE_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TASK_EXCLUSIONS_EVENT, refresh);
      window.removeEventListener(GRADE_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [load]);

  // Recalcula "Vence en 2 h" sin volver a pedir datos.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const items = useMemo(
    () => buildNotifications({ tasks, grades, courses, now }),
    [tasks, grades, courses, now],
  );

  const unreadIds = useMemo(
    () => unreadNotificationIds(items, seenIds),
    [items, seenIds],
  );

  const markAllSeen = useCallback(() => {
    setSeenIds((current) => {
      const next = mergeSeenNotificationIds(
        current,
        items.map((item) => item.id),
      );
      if (
        next.length === current.length &&
        next.every((id, index) => id === current[index])
      ) {
        return current;
      }
      writeSeenNotificationIds(next);
      return next;
    });
  }, [items]);

  // Al abrir el panel, todo lo visible queda marcado como leído. Si llega un
  // aviso nuevo mientras sigue abierto, también se marca: el usuario lo está
  // viendo en ese momento.
  useEffect(() => {
    if (!open) return;
    markAllSeen();
  }, [open, items, markAllSeen]);

  const openPanel = useCallback(() => {
    setOpen(true);
    if (!loading && !refreshing) void load({ silent: true });
  }, [load, loading, refreshing]);

  const closePanel = useCallback(() => setOpen(false), []);

  const refresh = useCallback(() => load({ silent: true }), [load]);

  const value = useMemo<NotificationCenterValue>(
    () => ({
      open,
      openPanel,
      closePanel,
      items,
      loading,
      refreshing,
      error,
      unreadCount: unreadIds.length,
      updatedAt,
      refresh,
    }),
    [
      closePanel,
      error,
      items,
      loading,
      open,
      openPanel,
      refresh,
      refreshing,
      unreadIds.length,
      updatedAt,
    ],
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(
            <NotificationPanel
              items={items}
              loading={loading}
              refreshing={refreshing}
              error={error}
              updatedAt={updatedAt}
              onClose={closePanel}
              onRefresh={() => void refresh()}
            />,
            document.body,
          )
        : null}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter(): NotificationCenterValue {
  const context = useContext(NotificationCenterContext);
  if (!context) {
    throw new Error("useNotificationCenter debe usarse dentro de <NotificationCenter>");
  }
  return context;
}

export function NotificationBell({ className }: { className?: string }) {
  const { open, openPanel, unreadCount } = useNotificationCenter();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openPanel}
      aria-label={
        unreadCount > 0
          ? `Notificaciones, ${unreadCount} ${unreadCount === 1 ? "aviso" : "avisos"} sin leer`
          : "Notificaciones"
      }
      aria-haspopup="dialog"
      aria-expanded={open}
      title="Notificaciones"
      className={cn(
        "relative text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white",
        className,
      )}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span
          aria-hidden
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#FF3B30] shadow-[0_0_0_2px_rgba(255,255,255,0.9)] dark:shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
        />
      )}
    </Button>
  );
}

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  exam: CalendarClock,
  deadline: Clock3,
  task: ListTodo,
};

const TONE_STYLES: Record<NotificationTone, { icon: string; meta: string }> = {
  blue: {
    icon: "bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#0066FF]/15 dark:text-[#8ab9ff]",
    meta: "text-[#0066FF] dark:text-[#8ab9ff]",
  },
  green: {
    icon: "bg-[#34C759]/10 text-[#1A9E3A] dark:bg-[#34C759]/15 dark:text-[#79D997]",
    meta: "text-[#1A9E3A] dark:text-[#79D997]",
  },
  amber: {
    icon: "bg-[#FF9500]/10 text-[#B36400] dark:bg-[#FF9500]/15 dark:text-[#FFB656]",
    meta: "text-[#B36400] dark:text-[#FFB656]",
  },
  red: {
    icon: "bg-[#FF3B30]/10 text-[#D92B22] dark:bg-[#FF3B30]/15 dark:text-[#FF8A80]",
    meta: "text-[#D92B22] dark:text-[#FF8A80]",
  },
  purple: {
    icon: "bg-[#AF52DE]/10 text-[#7A339E] dark:bg-[#AF52DE]/15 dark:text-[#CC96F3]",
    meta: "text-[#7A339E] dark:text-[#CC96F3]",
  },
};

interface NotificationPanelProps {
  items: AppNotification[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  updatedAt: number | null;
  onClose: () => void;
  onRefresh: () => void;
}

function NotificationPanel({
  items,
  loading,
  refreshing,
  error,
  updatedAt,
  onClose,
  onRefresh,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScrollLock = lockBodyScroll();
    const timer = window.setTimeout(() => closeRef.current?.focus(), 80);

    return () => {
      window.clearTimeout(timer);
      releaseScrollLock();
      previousFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const upcoming = items.filter((item) => item.kind !== "task");
  const recent = items.filter((item) => item.kind === "task");
  const updatedLabel = updatedAt
    ? `Actualizado ${formatNotificationAge(updatedAt).toLowerCase()}`
    : "Sin actualizar";

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <div
        className="animate-fade-in absolute inset-0 bg-slate-950/35 backdrop-blur-[2px] dark:bg-black/55"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-center-title"
        tabIndex={-1}
        className="animate-in slide-in-from-right-4 fade-in duration-300 absolute right-0 top-0 flex h-dvh w-full max-w-[400px] flex-col overflow-hidden border-l border-slate-300/40 bg-slate-100/90 shadow-[-24px_0_80px_-40px_rgba(32,39,48,0.45)] backdrop-blur-3xl focus:outline-none dark:border-white/10 dark:bg-[#0b0f18]/[0.92] dark:shadow-[-24px_0_80px_-40px_rgba(0,0,0,0.9)] sm:max-w-[380px] sm:rounded-l-[28px]"
      >
        <div className="shrink-0 border-b border-slate-300/40 px-5 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#0066FF] dark:text-[#8ab9ff]">
                <Bell className="h-3 w-3" />
                Centro de avisos
              </p>
              <h2
                id="notification-center-title"
                className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/95"
              >
                Notificaciones
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/40">
                {loading
                  ? "Buscando novedades…"
                  : items.length > 0
                    ? `${items.length} ${items.length === 1 ? "aviso" : "avisos"} · ${updatedLabel}`
                    : "Todo al día"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Actualizar avisos"
                title="Actualizar avisos"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Cerrar notificaciones"
                title="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {loading ? (
            <NotificationSkeleton />
          ) : error && items.length === 0 ? (
            <NotificationError message={error} onRetry={onRefresh} />
          ) : items.length === 0 ? (
            <NotificationEmpty />
          ) : (
            <>
              {error && (
                <div className="mb-2 flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-[10.5px] leading-4 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {upcoming.length > 0 && (
                <NotificationSection
                  title="Próximos"
                  items={upcoming}
                  onNavigate={onClose}
                />
              )}
              {recent.length > 0 && (
                <NotificationSection
                  title="Recién añadido"
                  items={recent}
                  onNavigate={onClose}
                />
              )}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-300/40 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] dark:border-white/10">
          <Link
            href="/planner"
            onClick={onClose}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#0066FF] text-[12px] font-medium text-white shadow-[0_10px_24px_-12px_rgba(0,102,255,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition-[filter] hover:brightness-[1.06]"
          >
            Abrir planificador
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotificationSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: AppNotification[];
  onNavigate: () => void;
}) {
  return (
    <section className="mb-3 last:mb-0">
      <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
        <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
          {title}
        </h3>
        <span className="text-[9.5px] tabular-nums text-slate-400 dark:text-white/25">
          {items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <NotificationRow key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

function NotificationRow({
  item,
  onNavigate,
}: {
  item: AppNotification;
  onNavigate: () => void;
}) {
  const Icon = KIND_ICONS[item.kind];
  const tone = TONE_STYLES[item.tone];

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="group flex items-start gap-2.5 rounded-2xl border border-transparent px-2.5 py-2.5 transition-colors hover:border-white/40 hover:bg-white/40 dark:hover:border-white/5 dark:hover:bg-white/[0.04]"
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          tone.icon,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-[12px] font-semibold leading-4 text-slate-800 dark:text-white/85">
            {item.title}
          </span>
          <span className={cn("shrink-0 text-[9.5px] font-semibold leading-4", tone.meta)}>
            {item.meta}
          </span>
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-4 text-slate-500 dark:text-white/40">
          {item.description}
        </span>
      </span>

      <ChevronRight className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-white/20 dark:group-hover:text-white/50" />
    </Link>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-2" aria-label="Cargando notificaciones" role="status">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex animate-pulse items-start gap-2.5 rounded-2xl px-2.5 py-2.5"
        >
          <span className="h-8 w-8 shrink-0 rounded-xl bg-slate-200/70 dark:bg-white/[0.06]" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-3 w-3/4 rounded-full bg-slate-200/70 dark:bg-white/[0.06]" />
            <span className="block h-2.5 w-full rounded-full bg-slate-200/50 dark:bg-white/[0.04]" />
            <span className="block h-2.5 w-1/3 rounded-full bg-slate-200/50 dark:bg-white/[0.04]" />
          </span>
        </div>
      ))}
    </div>
  );
}

function NotificationEmpty() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-slate-300/40 bg-white/50 text-slate-400 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white/30">
        <BellOff className="h-6 w-6" />
      </span>
      <p className="mt-3 text-[13px] font-semibold text-slate-700 dark:text-white/75">
        Todo al día
      </p>
      <p className="mt-1 max-w-[240px] text-[11px] leading-5 text-slate-500 dark:text-white/40">
        Aquí verás las tareas recién importadas, los exámenes próximos y las entregas que se
        acercan.
      </p>
    </div>
  );
}

function NotificationError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-amber-300/50 bg-amber-50/70 text-amber-600 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <p className="mt-3 text-[13px] font-semibold text-slate-700 dark:text-white/75">
        No pudimos cargar los avisos
      </p>
      <p className="mt-1 max-w-[250px] text-[11px] leading-5 text-slate-500 dark:text-white/40">
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  );
}
