"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Brain,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  Library,
  ListTodo,
  NotebookPen,
  RefreshCw,
  Sparkles,
  Target,
  Timer,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { SyncStatus } from "@/components/sync-status";
import { useRealtime } from "@/components/realtime-provider";
import { api } from "@/lib/api";
import type { Book, DailyAgenda, DailyAgendaItem, OptimizedPlan, Task } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ff453a",
  long_project: "#bf5af2",
  short_task: "#0a84ff",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  long_project: "Proyecto",
  short_task: "Corta",
};

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  long_project: 1,
  short_task: 2,
};

const SOURCE_LABEL: Record<string, string> = {
  moodle: "Moodle",
  google_classroom: "Classroom",
  manual: "Manual",
};

type QuickLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: string;
};

const QUICK_LINKS: QuickLink[] = [
  { href: "/library", label: "Biblioteca", icon: BookOpen, tone: "from-[#5aa7ff] to-[#0066d6]" },
  { href: "/studio", label: "IA Studio", icon: Wand2, tone: "from-[#c47dff] to-[#7b2fe0]" },
  { href: "/notebooks", label: "Cuadernos", icon: NotebookPen, tone: "from-[#ffb340] to-[#e07800]" },
  { href: "/calendar", label: "Calendario", icon: CalendarRange, tone: "from-[#ff7b72] to-[#d62b23]" },
  { href: "/subjects", label: "Asignaturas", icon: Library, tone: "from-[#5ddc82] to-[#1a9e3a]" },
  { href: "/focus", label: "Enfoque", icon: Target, tone: "from-[#5fe0d5] to-[#0a8a83]" },
  { href: "/review", label: "Repaso", icon: Brain, tone: "from-[#8f8dff] to-[#4a48d6]" },
  { href: "/classes", label: "Clases", icon: Users, tone: "from-[#ff7ba6] to-[#d61a5b]" },
  { href: "/files", label: "Archivos", icon: FolderOpen, tone: "from-[#a1a1aa] to-[#55555c]" },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dayHeading(iso: string): string {
  const target = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  const diff = Math.round((targetDay.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return capitalize(
    target.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );
}

function dueLabel(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const date = new Date(iso);
  if (date.getTime() < Date.now()) return "Vencida";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(date);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Vence hoy";
  if (diffDays === 1) return "Vence mañana";
  return `En ${diffDays} días`;
}

function isNow(item: DailyAgendaItem): boolean {
  const now = Date.now();
  return now >= new Date(item.start_at).getTime() && now <= new Date(item.end_at).getTime();
}

function groupByDay<T extends { start_at: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = new Date(item.start_at).toDateString();
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries());
}

function ProgressRing({
  value,
  color,
  size = 54,
  stroke = 5,
  children,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.09em] text-white/35">
      {children}
    </p>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<OptimizedPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agenda, setAgenda] = useState<DailyAgenda | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [optimized, pending, today, library] = await Promise.all([
        api.optimizedPlan(),
        api.tasks({ status: "pending" }),
        api.today(),
        api.books().catch(() => []),
      ]);
      setPlan(optimized);
      setTasks(pending);
      setAgenda(today);
      setBooks(library);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 30000);
    return () => clearInterval(timer);
  }, []);

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

  const name = user?.full_name?.trim() || user?.email.split("@")[0] || "estudiante";
  const now = new Date();
  const dateLabel = capitalize(
    now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
  );
  const hour = now.getHours();
  const greeting = hour < 6 ? "Buenas noches" : hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  const continueBook =
    books
      .filter((book) => book.status === "ready" && book.last_opened_at)
      .sort((a, b) => {
        const aTime = a.last_opened_at ? Date.parse(a.last_opened_at) : 0;
        const bTime = b.last_opened_at ? Date.parse(b.last_opened_at) : 0;
        return bTime - aTime;
      })[0] ?? null;

  const readingBooks = books.filter(
    (book) => book.status === "ready" && book.progress_percent > 0 && book.progress_percent < 99,
  );
  const readingProgress = readingBooks.length
    ? readingBooks.reduce((total, book) => total + book.progress_percent, 0) / readingBooks.length
    : 0;

  const impulse = continueBook
    ? `Dedica 15 minutos a “${continueBook.title}”. El lector te devolverá a ${
        continueBook.current_section_title || `la sección ${continueBook.current_section_index + 1}`
      }.`
    : tasks.length > 0
      ? "Empieza por la tarea más pequeña: reducir la lista también es avanzar. Después, abre un libro quince minutos."
      : "No hay tareas urgentes. Buen momento para subir ese libro que llevas tiempo queriendo leer o repasar un cuaderno.";

  const todayItems = [...(agenda?.items ?? [])].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const upcoming = (plan?.scheduled ?? [])
    .filter((item) => new Date(item.start_at).getTime() > endOfToday.getTime())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const upcomingPreview = upcoming.slice(0, 10);
  const upcomingGroups = groupByDay(upcomingPreview);
  const hasMoreUpcoming = upcoming.length > upcomingPreview.length;
  const hasToday = todayItems.length > 0;
  const hasAnything = hasToday || upcoming.length > 0;

  const completedBlocks = todayItems.filter((item) => item.completed).length;
  const totalBlocks = todayItems.length;
  const blockProgress = totalBlocks ? (completedBlocks / totalBlocks) * 100 : 0;
  const completedMinutes = agenda?.completed_minutes ?? 0;
  const totalMinutes = agenda?.total_minutes ?? 0;
  const planProgress = Math.round(agenda?.progress_percent ?? 0);
  const urgentCount = tasks.filter((task) => task.priority === "urgent").length;
  const projectCount = tasks.filter((task) => task.priority === "long_project").length;
  const shortCount = tasks.filter((task) => task.priority === "short_task").length;
  const taskTotal = Math.max(1, tasks.length);
  const sortedTasks = [...tasks].sort((a, b) => {
    const priority = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (priority !== 0) return priority;
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  return (
    <div className="relative mx-auto max-w-[1500px] px-5 pb-12 pt-6 sm:px-7 lg:pt-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
            <span className="h-1.5 w-1.5 rounded-full bg-[#30d158]" />
            {dateLabel}
          </p>

          <h1 className="mt-3 text-[30px] font-light leading-[1.05] tracking-[-0.035em] text-white/90 sm:text-[36px]">
            {greeting}, <span className="font-semibold">{name}</span>
          </h1>

          <p className="mt-2 max-w-xl text-[12.5px] leading-5 text-white/45">
            {tasks.length > 0
              ? `Tienes ${tasks.length} tarea${tasks.length === 1 ? "" : "s"} pendiente${
                  tasks.length === 1 ? "" : "s"
                }. Tu plan de hoy ya está repartido en huecos.`
              : "No tienes tareas pendientes. Buen momento para adelantar apuntes o crear un cuaderno nuevo."}
          </p>

          <p className="mt-3 flex max-w-xl items-start gap-2 text-[11.5px] leading-5 text-white/35">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#bf5af2]" strokeWidth={1.8} />
            <span>{impulse}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/calendar"
            className="app-glass-soft flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12px] font-medium text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.8} />
            Calendario
          </Link>
          <Link
            href="/studio"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.10] px-3 text-[12px] font-medium text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.15]"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            Crear con IA
          </Link>
        </div>
      </header>

      {/* ---- Widgets superiores ---- */}
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="app-glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <StatLabel>
                <ListTodo className="h-3 w-3" strokeWidth={1.9} />
                Pendientes
              </StatLabel>
              <p className="mt-2 text-[28px] font-light leading-none tracking-[-0.04em] text-white/90">
                {tasks.length}
              </p>
              <p className="mt-1.5 text-[10.5px] text-white/35">
                {tasks.length === 0
                  ? "Todo al día"
                  : `${urgentCount} urgente${urgentCount === 1 ? "" : "s"}`}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/[0.055] text-white/45 ring-1 ring-white/[0.05]">
              <ListTodo className="h-4 w-4" strokeWidth={1.8} />
            </span>
          </div>
          <div className="mt-4 flex h-1 overflow-hidden rounded-full bg-white/[0.08]">
            {tasks.length > 0 && (
              <>
                <span
                  className="h-full bg-[#ff453a]"
                  style={{ width: `${(urgentCount / taskTotal) * 100}%` }}
                />
                <span
                  className="h-full bg-[#bf5af2]"
                  style={{ width: `${(projectCount / taskTotal) * 100}%` }}
                />
                <span
                  className="h-full bg-[#0a84ff]"
                  style={{ width: `${(shortCount / taskTotal) * 100}%` }}
                />
              </>
            )}
          </div>
        </div>

        <div className="app-glass flex items-center gap-3 rounded-2xl p-4">
          <ProgressRing value={planProgress} color="#30d158">
            <span className="text-[11px] font-semibold tabular-nums text-white/80">
              {planProgress}%
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <StatLabel>
              <Timer className="h-3 w-3" strokeWidth={1.9} />
              Plan de hoy
            </StatLabel>
            <p className="mt-1.5 text-[20px] font-light leading-none tracking-[-0.03em] text-white/90">
              {formatMinutes(completedMinutes)}
            </p>
            <p className="mt-1.5 truncate text-[10.5px] text-white/35">
              de {formatMinutes(totalMinutes)}
            </p>
          </div>
        </div>

        <div className="app-glass flex items-center gap-3 rounded-2xl p-4">
          <ProgressRing value={blockProgress} color="#bf5af2">
            <span className="text-[10px] font-semibold tabular-nums text-white/80">
              {completedBlocks}/{totalBlocks}
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <StatLabel>
              <CalendarClock className="h-3 w-3" strokeWidth={1.9} />
              Bloques
            </StatLabel>
            <p className="mt-1.5 text-[20px] font-light leading-none tracking-[-0.03em] text-white/90">
              {totalBlocks} <span className="text-[11px] text-white/30">hoy</span>
            </p>
            <p className="mt-1.5 truncate text-[10.5px] text-white/35">
              {completedBlocks} completado{completedBlocks === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="app-glass flex items-center gap-3 rounded-2xl p-4">
          <ProgressRing value={readingProgress} color="#ff9f0a">
            <span className="text-[10px] font-semibold tabular-nums text-white/80">
              {Math.round(readingProgress)}%
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <StatLabel>
              <BookOpen className="h-3 w-3" strokeWidth={1.9} />
              Lectura
            </StatLabel>
            <p className="mt-1.5 text-[20px] font-light leading-none tracking-[-0.03em] text-white/90">
              {readingBooks.length} <span className="text-[11px] text-white/30">en curso</span>
            </p>
            <p className="mt-1.5 truncate text-[10.5px] text-white/35">
              {continueBook ? continueBook.title : "Elige tu próximo libro"}
            </p>
          </div>
        </div>
      </section>

      {/* ---- Línea de tiempo + columna lateral ---- */}
      <section className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="app-glass flex flex-col rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white/90">
                Línea de tiempo de hoy
              </h2>
              <p className="mt-0.5 text-[11.5px] text-white/35">
                {dateLabel} · {totalBlocks} bloque{totalBlocks === 1 ? "" : "s"} ·{" "}
                {formatMinutes(totalMinutes)}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="app-glass-soft flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[11.5px] font-medium text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white/85 disabled:opacity-50"
            >
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Replanificar
            </button>
          </div>

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#30d158] to-[#64d2ff] transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, planProgress))}%` }}
            />
          </div>

          <div className="mt-3 min-h-0 flex-1">
            {loading && (
              <div className="space-y-2 pt-1">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex animate-pulse items-center gap-4 px-2 py-3">
                    <span className="h-3 w-10 rounded-full bg-white/[0.07]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/[0.09]" />
                    <span className="h-3 flex-1 rounded-full bg-white/[0.06]" />
                  </div>
                ))}
              </div>
            )}

            {!loading && !hasAnything && (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-white/35 ring-1 ring-white/[0.06]">
                  <CalendarClock className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <p className="mt-3 text-[13px] font-medium text-white/70">Nada en el horizonte</p>
                <p className="mt-1 max-w-xs text-[11.5px] leading-5 text-white/35">
                  No hay bloques para hoy. Añade una tarea o disfruta del tiempo libre.
                </p>
                <Link
                  href="/calendar"
                  className="app-glass-soft mt-4 flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  Abrir calendario
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {!loading && hasAnything && (
              <div>
                {hasToday ? (
                  <div className="space-y-0.5">
                    {todayItems.map((item) => {
                      const current = isNow(item);
                      const color = PRIORITY_COLOR[item.priority] ?? "#8e8e93";
                      return (
                        <div
                          key={`today-${item.task_id}`}
                          className={`group relative flex items-start gap-3 rounded-2xl px-2 py-2.5 transition-colors ${
                            current ? "bg-white/[0.05]" : "hover:bg-white/[0.035]"
                          }`}
                        >
                          <div className="w-[48px] shrink-0 pt-0.5 text-right">
                            <p
                              className={`text-[11px] font-medium tabular-nums ${
                                current ? "text-white/85" : "text-white/50"
                              }`}
                            >
                              {formatTime(item.start_at)}
                            </p>
                            <p className="mt-0.5 text-[9.5px] tabular-nums text-white/25">
                              {formatTime(item.end_at)}
                            </p>
                          </div>

                          <div className="relative flex w-3 shrink-0 justify-center self-stretch">
                            <span className="absolute inset-y-0 w-px bg-white/[0.07]" />
                            <span
                              className="relative mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-black/25"
                              style={{ backgroundColor: color }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p
                                className={`truncate text-[13px] font-[450] ${
                                  item.completed
                                    ? "text-white/30 line-through"
                                    : "text-white/85"
                                }`}
                              >
                                {item.title}
                              </p>
                              {current && (
                                <span className="shrink-0 rounded-full bg-[#30d158]/15 px-2 py-0.5 text-[9.5px] font-medium text-[#30d158]">
                                  Ahora
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[10.5px] text-white/30">
                              {item.course_name || "Estudio"} ·{" "}
                              {formatMinutes(minutesBetween(item.start_at, item.end_at))}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={`Completar ${item.title}`}
                            title="Completar bloque"
                            onClick={() => void handleComplete(item.task_id)}
                            className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                              item.completed
                                ? "border-[#30d158]/60 bg-[#30d158]/15 text-[#30d158]"
                                : "border-white/20 text-transparent hover:border-[#30d158]/70 hover:bg-[#30d158]/10 hover:text-[#30d158]"
                            }`}
                          >
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-2 py-5 text-[11.5px] text-white/35">
                    <CalendarClock className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.7} />
                    Hoy está libre. Los próximos bloques aparecen abajo.
                  </div>
                )}

                {upcomingGroups.length > 0 && (
                  <div className="mt-5">
                    <div className="flex items-center gap-3 px-2 pb-2">
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/25">
                        Próximos bloques
                      </p>
                      <span className="h-px flex-1 bg-white/[0.06]" />
                    </div>

                    <div className="space-y-4">
                      {upcomingGroups.map(([dayKey, items]) => (
                        <div key={dayKey}>
                          <p className="px-2 pb-1 text-[10px] font-medium text-white/35">
                            {dayHeading(items[0].start_at)}
                          </p>
                          <div className="space-y-0.5">
                            {items.map((item) => (
                              <div
                                key={`${item.task_id}-${item.start_at}`}
                                className="flex items-start gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/[0.035]"
                              >
                                <div className="w-[48px] shrink-0 pt-0.5 text-right">
                                  <p className="text-[11px] font-medium tabular-nums text-white/45">
                                    {formatTime(item.start_at)}
                                  </p>
                                  <p className="mt-0.5 text-[9.5px] tabular-nums text-white/25">
                                    {formatTime(item.end_at)}
                                  </p>
                                </div>
                                <div className="relative flex w-3 shrink-0 justify-center self-stretch">
                                  <span className="absolute inset-y-0 w-px bg-white/[0.07]" />
                                  <span
                                    className="relative mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-black/25"
                                    style={{
                                      backgroundColor:
                                        PRIORITY_COLOR[item.priority] ?? "#8e8e93",
                                    }}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12.5px] text-white/70">
                                    {item.title}
                                  </p>
                                  <p className="mt-0.5 truncate text-[10.5px] text-white/25">
                                    {item.course_name || "Estudio"} ·{" "}
                                    {formatMinutes(item.estimated_minutes)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {hasMoreUpcoming && (
                      <Link
                        href="/schedule"
                        className="mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-white/35 transition-colors hover:text-white/70"
                      >
                        Ver horario completo
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-4">
          {/* ---- Tareas compactas ---- */}
          <section className="app-glass rounded-3xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-white/90">
                  Tareas pendientes
                </h2>
                <p className="mt-0.5 text-[10.5px] text-white/35">
                  {tasks.length} activa{tasks.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                title="Descargar todas las tareas en Excel"
                aria-label="Descargar todas las tareas en Excel"
                onClick={() => api.exportTasksExcel().catch(() => undefined)}
                className="app-glass-soft flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/75"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-0.5">
              {loading && (
                <div className="space-y-1.5">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="flex animate-pulse items-center gap-2.5 py-2">
                      <span className="h-3 w-[2px] rounded-full bg-white/[0.08]" />
                      <span className="h-4 w-4 rounded-full bg-white/[0.07]" />
                      <span className="h-3 flex-1 rounded-full bg-white/[0.06]" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && sortedTasks.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#30d158]/10 text-[#30d158]/80 ring-1 ring-[#30d158]/15">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <p className="mt-2 text-[12px] font-medium text-white/65">Todo al día</p>
                  <p className="mt-0.5 text-[10.5px] text-white/30">
                    No hay tareas pendientes.
                  </p>
                </div>
              )}

              {!loading &&
                sortedTasks.map((task) => {
                  const color = PRIORITY_COLOR[task.priority] ?? "#8e8e93";
                  const completed = task.status === "completed";
                  return (
                    <div
                      key={task.id}
                      className="group flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-white/[0.045]"
                    >
                      <span
                        className="h-7 w-[2px] shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <button
                        type="button"
                        aria-label={`Completar ${task.title}`}
                        title="Completar tarea"
                        onClick={() => void handleComplete(task.id)}
                        className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                          completed
                            ? "border-[#30d158]/60 bg-[#30d158]/15 text-[#30d158]"
                            : "border-white/20 text-transparent hover:border-[#30d158]/70 hover:bg-[#30d158]/10 hover:text-[#30d158]"
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-[12.5px] ${
                            completed
                              ? "text-white/30 line-through"
                              : "text-white/80 group-hover:text-white/95"
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-white/30">
                          {dueLabel(task.due_at)} · {formatMinutes(task.estimated_minutes)} ·{" "}
                          {SOURCE_LABEL[task.source] ?? task.source}
                        </p>
                      </div>

                      <span
                        className="shrink-0 text-[9px] font-medium uppercase tracking-[0.05em] opacity-80"
                        style={{ color }}
                      >
                        {PRIORITY_LABEL[task.priority] ?? task.priority}
                      </span>
                    </div>
                  );
                })}
            </div>
          </section>

          {/* ---- Continuar leyendo ---- */}
          {continueBook ? (
            <Link
              href={`/library/${continueBook.id}`}
              className="app-glass group flex items-center gap-3 rounded-2xl p-3.5 transition-colors hover:bg-black/30"
            >
              <div
                className="relative flex h-[76px] w-[54px] shrink-0 flex-col justify-between overflow-hidden rounded-xl p-2.5 text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)]"
                style={{
                  background: `linear-gradient(150deg, ${continueBook.cover_color}, #0f172a)`,
                }}
              >
                <span className="absolute inset-x-0 top-0 h-px bg-white/20" />
                <BookOpen className="h-4 w-4 text-white/80" strokeWidth={1.8} />
                <span className="text-[8px] font-semibold uppercase tracking-wider text-white/55">
                  {continueBook.format}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-white/30">
                  Continuar leyendo
                </p>
                <p className="mt-1 truncate text-[13px] font-medium text-white/85">
                  {continueBook.title}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-white/35">
                  {continueBook.current_section_title ||
                    `Sección ${continueBook.current_section_index + 1}`}{" "}
                  · {Math.round(continueBook.progress_percent)}%
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-[#0a84ff]"
                    style={{ width: `${Math.max(2, Math.min(100, continueBook.progress_percent))}%` }}
                  />
                </div>
              </div>

              <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-white/65" />
            </Link>
          ) : (
            <Link
              href="/library"
              className="app-glass group flex items-center gap-3 rounded-2xl p-3.5 transition-colors hover:bg-black/30"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0a84ff]/15 text-[#64a8ff] ring-1 ring-[#0a84ff]/15">
                <BookOpen className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-white/80">
                  {books.length > 0 ? "Elige tu próximo libro" : "Tu biblioteca te espera"}
                </p>
                <p className="mt-0.5 text-[10.5px] text-white/30">
                  {books.length > 0
                    ? "Abre uno y guardaremos tu progreso."
                    : "Sube un PDF, EPUB o DOCX para empezar."}
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-white/65" />
            </Link>
          )}

          <SyncStatus onSynced={load} />
        </div>
      </section>

      {/* ---- Quick Dock ---- */}
      <section aria-labelledby="quick-dock-title" className="mt-6">
        <h2 id="quick-dock-title" className="sr-only">
          Acceso rápido
        </h2>
        <div className="flex justify-center">
          <div className="app-glass hide-scrollbar flex max-w-full items-start gap-0.5 overflow-x-auto rounded-3xl p-2">
            {QUICK_LINKS.map(({ href, label, icon: Icon, tone }) => (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className="group flex w-[60px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 transition-colors hover:bg-white/[0.055]"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-b ${tone} text-white shadow-[0_3px_9px_-3px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.28)] transition-transform duration-200 ease-mac group-hover:-translate-y-1 group-active:translate-y-0`}
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
                </span>
                <span className="max-w-full truncate text-[9px] font-medium tracking-[-0.01em] text-white/35 transition-colors group-hover:text-white/70">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
