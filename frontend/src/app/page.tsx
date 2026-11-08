"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Brain,
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  FolderOpen,
  Layers,
  Library,
  ListTodo,
  Loader2,
  NotebookPen,
  Pencil,
  RefreshCw,
  Sparkles,
  Target,
  Timer,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import { Input } from "@/components/ui/input";
import { SyncStatus } from "@/components/sync-status";
import { TaskList } from "@/components/task-list";
import { StatsCard } from "@/components/ui/stats-card";
import { useRealtime } from "@/components/realtime-provider";
import { useTaskManager } from "@/hooks/use-task-manager";
import { api } from "@/lib/api";
import { examDateKey, formatExamDate } from "@/lib/exams";
import {
  GRADE_CHANGE_EVENT,
  GRADE_CHANGE_STORAGE_KEY,
  notifyGradeChange,
} from "@/lib/grade-events";
import type {
  Book,
  Course,
  DailyAgenda,
  DailyAgendaItem,
  Grade,
  GradeSummary,
  OptimizedPlan,
} from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";

const STATS_STAGGER: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const DASHBOARD_STAGGER: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.14 },
  },
};

const DASHBOARD_ITEM: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 28 },
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ff453a",
  long_project: "#bf5af2",
  short_task: "#0a84ff",
};

type QuickLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: string;
};

// El diálogo de examen solo se necesita cuando el usuario edita una nota; se
// descarga bajo demanda para no engordar el chunk del dashboard.
const ExamDialog = dynamic(
  () =>
    import("@/components/exam-dialog").then((module) => ({
      default: module.ExamDialog,
    })),
  { ssr: false, loading: () => null },
);

const QUICK_LINKS: QuickLink[] = [
  { href: "/library", label: "Biblioteca", icon: BookOpen, tone: "from-[#5aa7ff] to-[#0066d6]" },
  { href: "/studio", label: "IA Studio", icon: Wand2, tone: "from-[#c47dff] to-[#7b2fe0]" },
  { href: "/notebooks", label: "Cuadernos", icon: NotebookPen, tone: "from-[#ffb340] to-[#e07800]" },
  { href: "/planner", label: "Planificador", icon: CalendarRange, tone: "from-[#ff7b72] to-[#d62b23]" },
  { href: "/academics", label: "Académico", icon: Library, tone: "from-[#5ddc82] to-[#1a9e3a]" },
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

function localDateKey(date = new Date()): string {
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function gradeOverTen(percent: number | null | undefined): string {
  return percent === null || percent === undefined || !Number.isFinite(percent)
    ? "—"
    : (percent / 10).toFixed(1);
}

function parseGradeInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
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

export default function DashboardPage() {
  const { user } = useAuth();
  const { autoStrikeOverdue } = usePreferences();
  const [plan, setPlan] = useState<OptimizedPlan | null>(null);
  const [agenda, setAgenda] = useState<DailyAgenda | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeSummary, setGradeSummary] = useState<GradeSummary | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, string>>({});
  const [gradeErrors, setGradeErrors] = useState<Record<string, string>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);
  const [gradeNotice, setGradeNotice] = useState<string | null>(null);
  const [editingExam, setEditingExam] = useState<Grade | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const initialLoading = loading && !plan && !agenda;

  const {
    activeTasks,
    overdueTasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
    completeTask,
    deleteTask,
  } = useTaskManager({ autoLoad: false });

  const refreshGradeData = useCallback(async (): Promise<GradeSummary | null> => {
    const [gradeResult, courseResult, summaryResult] = await Promise.allSettled([
      api.grades(),
      api.courses(),
      api.gradeSummary(),
    ]);
    if (gradeResult.status === "fulfilled") setGrades(gradeResult.value);
    if (courseResult.status === "fulfilled") setCourses(courseResult.value);
    if (summaryResult.status === "fulfilled") {
      setGradeSummary(summaryResult.value);
      return summaryResult.value;
    }
    return null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Datos críticos para pintar el plan de hoy. El resto se carga después.
      await Promise.all([
        api.optimizedPlan().then(setPlan),
        api.today().then(setAgenda),
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }

    // Biblioteca, tareas y notas no bloquean el primer pintado. Se piden en
    // tiempo ocioso para que el plan de hoy y la agenda ganen la carrera.
    const runDeferred = () => {
      void Promise.allSettled([
        api.books().then(setBooks).catch(() => setBooks([])),
        refreshTasks({ silent: true }).catch(() => undefined),
        refreshGradeData().catch(() => undefined),
      ]);
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
    };
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(runDeferred, { timeout: 1500 });
    } else {
      window.setTimeout(runDeferred, 250);
    }
  }, [refreshGradeData, refreshTasks]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Las notas pueden cambiar desde Académico o el planificador. Se recargan
  // también sin WebSocket (modo local o varias pestañas abiertas).
  useEffect(() => {
    const handleGradeChange = () => {
      void refreshGradeData();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GRADE_CHANGE_STORAGE_KEY) handleGradeChange();
    };
    window.addEventListener(GRADE_CHANGE_EVENT, handleGradeChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(GRADE_CHANGE_EVENT, handleGradeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshGradeData]);

  useRealtime((event) => {
    if (event.event === "grades") {
      void refreshGradeData();
      return;
    }
    if (event.event === "tasks" || event.event === "schedule") {
      load();
    }
  });

  const handleComplete = useCallback(
    async (id: string) => {
      try {
        await completeTask(id);
        await load();
      } catch (error) {
        console.error(error);
      }
    },
    [completeTask, load],
  );

  const tasks = activeTasks;
  const name = user?.full_name?.trim() || user?.email.split("@")[0] || "estudiante";
  const initials = name.slice(0, 2).toUpperCase();
  const now = new Date();
  const dateLabel = capitalize(
    now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
  );
  const hour = now.getHours();
  const greeting =
    hour < 6 ? "Buenas noches" : hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

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

  const todayKey = localDateKey();

  const weekStart = new Date(now);
  weekStart.setHours(12, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      weekday: date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", ""),
      day: date.getDate(),
      isToday: date.toDateString() === now.toDateString(),
    };
  });
  const calendarMonth = capitalize(
    weekStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
  );
  const calendarPreview = [...todayItems, ...upcoming].slice(0, 3);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const summaryByCourse = useMemo(() => {
    const map = new Map<string, GradeSummary["courses"][number]>();
    for (const item of gradeSummary?.courses ?? []) {
      if (item.course_id) map.set(item.course_id, item);
    }
    return map;
  }, [gradeSummary]);

  const pendingExams = useMemo(
    () =>
      grades
        .filter(
          (grade) =>
            grade.is_exam &&
            grade.score === null &&
            (examDateKey(grade) ?? "9999-12-31") < todayKey,
        )
        .sort((a, b) => {
          const aDate = examDateKey(a) ?? "9999-12-31";
          const bDate = examDateKey(b) ?? "9999-12-31";
          return aDate.localeCompare(bDate) || a.title.localeCompare(b.title, "es");
        }),
    [grades, todayKey],
  );

  async function savePendingGrade(event: React.FormEvent, exam: Grade) {
    event.preventDefault();
    if (savingGradeId) return;

    const value = parseGradeInput(gradeDrafts[exam.id] ?? "");
    if (value === null) {
      setGradeErrors((current) => ({
        ...current,
        [exam.id]: "Introduce una nota entre 0 y 10.",
      }));
      return;
    }
    if (value < 0 || value > 10) {
      setGradeErrors((current) => ({
        ...current,
        [exam.id]: "La nota debe estar entre 0 y 10.",
      }));
      return;
    }

    // El examen puede estar sobre 10, 20 o 100. La nota que escribe el usuario
    // siempre es sobre 10 y se convierte a la escala real antes de guardar.
    const score = Math.round((value / 10) * exam.max_score * 100) / 100;
    if (!Number.isFinite(score) || score > exam.max_score) {
      setGradeErrors((current) => ({
        ...current,
        [exam.id]: "La nota no se puede convertir a la escala del examen.",
      }));
      return;
    }

    setSavingGradeId(exam.id);
    setGradeErrors((current) => {
      const next = { ...current };
      delete next[exam.id];
      return next;
    });

    try {
      await api.updateGrade(exam.id, { score });
      notifyGradeChange();
      const updatedSummary = await refreshGradeData();
      setGradeDrafts((current) => {
        const next = { ...current };
        delete next[exam.id];
        return next;
      });
      const courseName = exam.course_id ? courseById.get(exam.course_id)?.name : null;
      const updatedAverage =
        updatedSummary?.courses.find((item) => item.course_id === exam.course_id)
          ?.average_percent ?? null;
      setGradeNotice(
        `Nota guardada${courseName ? ` en ${courseName}` : ""}. Media${
          courseName ? ` de ${courseName}` : " global"
        }: ${gradeOverTen(updatedAverage)}/10.`,
      );
    } catch (error) {
      setGradeErrors((current) => ({
        ...current,
        [exam.id]:
          error instanceof Error ? error.message : "No se pudo guardar la nota.",
      }));
    } finally {
      setSavingGradeId(null);
    }
  }

  return (
    <motion.div
      variants={DASHBOARD_STAGGER}
      className="relative mx-auto max-w-[1500px] px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-6"
    >
      <motion.div
        variants={DASHBOARD_STAGGER}
        className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)]"
      >
        <motion.section
          variants={DASHBOARD_ITEM}
          className="relative overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(118deg,#e9e4f8_0%,#f2eefb_52%,#ddd7f3_100%)] p-6 text-[#28233a] shadow-[0_22px_58px_-42px_rgba(55,45,90,0.4),inset_0_1px_0_rgba(255,255,255,0.82)] sm:p-7"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#c8bdf2]/55 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 top-8 h-36 w-36 rotate-45 rounded-[38%] border border-white/55 bg-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/30 blur-3xl"
          />

          <div className="relative z-10 flex h-full min-h-[238px] flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b536e] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]" />
                {dateLabel}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden rounded-full bg-white/45 px-2.5 py-1 text-[10px] font-semibold text-[#5b536e] sm:block">
                  Tu espacio
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1b1b1f] text-[10px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(20,20,28,0.8)]">
                  {initials}
                </span>
              </div>
            </div>

            <div>
              <h1 className="max-w-2xl text-[30px] font-semibold leading-[1.02] tracking-[-0.055em] text-[#211d2e] sm:text-[40px]">
                {greeting}, {name}.
              </h1>
              <p className="mt-2 max-w-xl text-[12.5px] leading-5 text-[#5b536e] sm:text-[13px]">
                {tasks.length > 0
                  ? `Tienes ${tasks.length} tarea${tasks.length === 1 ? "" : "s"} pendiente${
                      tasks.length === 1 ? "" : "s"
                    } · ${planProgress}% del plan de hoy completado.`
                  : "No tienes tareas pendientes. Buen momento para adelantar apuntes o crear un cuaderno nuevo."}
              </p>
              <p className="mt-2 flex max-w-xl items-start gap-1.5 text-[11px] leading-5 text-[#5b536e]/80">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6d5ca8]" strokeWidth={1.8} />
                <span className="line-clamp-2">{impulse}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/planner"
                className="inline-flex h-11 touch-manipulation items-center gap-1.5 rounded-full bg-[#1b1b1f] px-4 text-[11.5px] font-semibold text-white shadow-[0_12px_26px_-14px_rgba(20,20,28,0.9)] transition-transform hover:-translate-y-0.5"
              >
                Abrir planificador
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/studio"
                className="inline-flex h-11 touch-manipulation items-center gap-1.5 rounded-full border border-white/60 bg-white/45 px-4 text-[11.5px] font-semibold text-[#3f3852] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition-colors hover:bg-white/65"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Crear con IA
              </Link>
              {urgentCount > 0 ? (
                <span className="ml-auto hidden rounded-full bg-[#ff3b30]/10 px-2.5 py-1 text-[10px] font-semibold text-[#a52b24] md:block">
                  {urgentCount} urgente{urgentCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={DASHBOARD_ITEM}
          className="glass-card flex flex-col rounded-[30px] p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
                Calendario
              </p>
              <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.035em] text-[#1d1d1f] dark:text-white">
                {calendarMonth}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekOffset((value) => value - 1)}
                aria-label="Semana anterior"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.06] bg-white/45 text-black/45 transition-colors hover:bg-white/80 hover:text-black/75 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((value) => value + 1)}
                aria-label="Semana siguiente"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.06] bg-white/45 text-black/45 transition-colors hover:bg-white/80 hover:text-black/75 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div key={day.key} className="flex min-w-0 flex-col items-center gap-1.5">
                <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-black/35 dark:text-white/30">
                  {day.weekday}
                </span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                    day.isToday
                      ? "bg-[#1b1b1f] text-white shadow-[0_7px_16px_-10px_rgba(20,20,28,0.9)]"
                      : "text-black/55 hover:bg-black/[0.04] dark:text-white/55 dark:hover:bg-white/[0.06]",
                  )}
                >
                  {day.day}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-1 border-t border-black/[0.06] pt-3 dark:border-white/[0.07]">
            {calendarPreview.length > 0 ? (
              calendarPreview.map((item, index) => (
                <div
                  key={`${item.start_at}-${item.title}-${index}`}
                  className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLOR[item.priority] ?? "#8e8e93" }}
                  />
                  <span className="w-9 shrink-0 text-[10px] font-medium tabular-nums text-black/35 dark:text-white/30">
                    {formatTime(item.start_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-black/65 dark:text-white/65">
                    {item.title}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-black/[0.08] px-3 py-2.5 text-[11px] leading-4 text-black/40 dark:border-white/10 dark:text-white/35">
                Sin bloques en esta semana. Abre el planificador para repartir tu estudio.
              </p>
            )}
          </div>

          <Link
            href="/planner"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-black/45 transition-colors hover:text-black/80 dark:text-white/40 dark:hover:text-white/80"
          >
            Ver calendario completo
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </motion.section>
      </motion.div>

      {/* ---- Widgets superiores ---- */}
      <motion.section
        variants={STATS_STAGGER}
        aria-busy={initialLoading}
        className="relative mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {initialLoading ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[166px] animate-pulse rounded-2xl border border-white/50 bg-white/30 motion-reduce:animate-none dark:border-white/[0.07] dark:bg-white/[0.04]"
              />
            ))}
          </div>
        ) : null}
        <StatsCard
          title="Pendientes"
          value={tasks.length}
          change={
            tasks.length === 0
              ? "Todo al día"
              : `${urgentCount} urgente${urgentCount === 1 ? "" : "s"}`
          }
          icon={ListTodo}
          gradient="from-rose-500 to-orange-500"
          tone={urgentCount > 0 ? "warning" : "positive"}
        />

        <StatsCard
          title="Plan de hoy"
          value={`${planProgress}%`}
          change={`${formatMinutes(completedMinutes)} de ${formatMinutes(totalMinutes)}`}
          icon={Timer}
          gradient="from-emerald-400 to-teal-600"
        />

        <StatsCard
          title="Bloques"
          value={completedBlocks}
          change={`de ${totalBlocks} bloque${totalBlocks === 1 ? "" : "s"} · ${Math.round(blockProgress)}%`}
          icon={Layers}
          gradient="from-violet-500 to-indigo-600"
        />

        <StatsCard
          title="Lectura"
          value={readingBooks.length}
          change={readingBooks.length ? `${Math.round(readingProgress)}% de media` : "Sin lecturas activas"}
          icon={BookOpen}
          gradient="from-sky-400 to-blue-600"
          tone={readingBooks.length > 0 ? "positive" : "neutral"}
        />
      </motion.section>

      {/* ---- Registro obligatorio de exámenes pasados sin nota ---- */}
      {gradeNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-[#34C759]/25 bg-[#34C759]/10 px-4 py-3 text-[11.5px] leading-5 text-[#1a7f3a] dark:border-[#34C759]/20 dark:text-[#7ee69a]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{gradeNotice}</span>
          <button
            type="button"
            onClick={() => setGradeNotice(null)}
            aria-label="Cerrar aviso"
            className="rounded-lg p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {pendingExams.length > 0 && (
        <section
          aria-labelledby="pending-exams-title"
          className="app-glass mt-4 overflow-hidden rounded-3xl border border-[#FF9500]/30 p-4 shadow-[0_24px_60px_-42px_rgba(255,149,0,0.65)] sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF9500]/12 text-[#b26a00] ring-1 ring-[#FF9500]/20 dark:bg-[#FF9500]/15 dark:text-[#ffc46b]">
                <CalendarClock className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b26a00] dark:text-[#ffc46b]">
                  Registro obligatorio
                </p>
                <h2
                  id="pending-exams-title"
                  className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90"
                >
                  Exámenes pendientes de calificación
                </h2>
                <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-slate-500 dark:text-white/40">
                  La fecha ya pasó y todavía no tienen nota. Introduce la nota sobre 10 para
                  actualizar la media de la asignatura al instante.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full border border-[#FF9500]/25 bg-[#FF9500]/10 px-2.5 py-1 text-[10px] font-semibold text-[#b26a00] dark:border-[#FF9500]/20 dark:text-[#ffc46b]">
                {pendingExams.length} pendiente{pendingExams.length === 1 ? "" : "s"}
              </span>
              <Link
                href="/academics"
                className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/[0.06] dark:hover:text-white/80"
              >
                Académico
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 xl:grid-cols-2">
            {pendingExams.map((exam) => {
              const course = exam.course_id ? courseById.get(exam.course_id) : undefined;
              const average = exam.course_id
                ? (summaryByCourse.get(exam.course_id)?.average_percent ?? null)
                : null;
              const saving = savingGradeId === exam.id;
              const error = gradeErrors[exam.id];
              const draftValue = parseGradeInput(gradeDrafts[exam.id] ?? "");
              const converted =
                draftValue !== null && draftValue >= 0 && draftValue <= 10
                  ? Math.round((draftValue / 10) * exam.max_score * 100) / 100
                  : null;
              const color = course?.color?.trim() || "#FF9500";

              return (
                <form
                  key={exam.id}
                  onSubmit={(event) => void savePendingGrade(event, exam)}
                  className="rounded-2xl border border-[#FF9500]/20 bg-white/35 p-3 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <p className="truncate text-[12.5px] font-semibold text-slate-800 dark:text-white/85">
                          {exam.title}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                        {course?.name ?? "Sin asignatura"} · {formatExamDate(exam)} ·{" "}
                        {exam.weight !== null ? `peso ${exam.weight}%` : "sin peso"}
                      </p>
                      <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/40">
                        Media actual:{" "}
                        <span className="font-semibold tabular-nums text-slate-700 dark:text-white/70">
                          {gradeOverTen(average)}
                        </span>
                        <span className="text-slate-400 dark:text-white/25">/10</span>
                        {saving && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-[#b26a00] dark:text-[#ffc46b]">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            recalculando
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingExam(exam)}
                        aria-label={`Editar ${exam.title}`}
                        title="Editar examen"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#FF9500]/10 hover:text-[#b26a00] dark:text-white/25 dark:hover:text-[#ffc46b]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <span className="rounded-xl bg-[#FF9500]/10 px-2 py-1 text-[10px] font-semibold tabular-nums text-[#b26a00] dark:bg-[#FF9500]/15 dark:text-[#ffc46b]">
                        sobre {exam.max_score}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-[120px] flex-1">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-white/40">
                        Nota (0-10)
                      </span>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step="0.01"
                          inputMode="decimal"
                          value={gradeDrafts[exam.id] ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setGradeDrafts((current) => ({ ...current, [exam.id]: value }));
                            setGradeErrors((current) => {
                              if (!current[exam.id]) return current;
                              const next = { ...current };
                              delete next[exam.id];
                              return next;
                            });
                          }}
                          placeholder="8.5"
                          className="pr-10 tabular"
                          aria-label={`Nota de ${exam.title}`}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10.5px] font-medium text-slate-400 dark:text-white/30">
                          /10
                        </span>
                      </div>
                    </label>
                    <button
                      type="submit"
                      disabled={saving || savingGradeId !== null}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#FF9500] px-3 text-[11.5px] font-semibold text-white shadow-[0_5px_14px_-7px_rgba(255,149,0,0.9)] transition-[filter,opacity] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                      )}
                      {saving ? "Guardando..." : "Guardar Nota"}
                    </button>
                  </div>

                  <p className="mt-1.5 text-[9.5px] leading-4 text-slate-400 dark:text-white/25">
                    {converted !== null
                      ? `Se guardará ${converted} / ${exam.max_score} y la media se recalculará.`
                      : `Se convierte a la escala de ${exam.max_score} y la media se recalcula al guardar.`}
                  </p>

                  {error && (
                    <p
                      role="alert"
                      className="mt-2 rounded-xl border border-rose-300/50 bg-rose-500/10 px-2.5 py-1.5 text-[10.5px] text-rose-700 dark:border-rose-400/20 dark:text-rose-200"
                    >
                      {error}
                    </p>
                  )}
                </form>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Línea de tiempo + columna lateral ---- */}
      <motion.section
        variants={DASHBOARD_ITEM}
        className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
      >
        <section className="app-glass flex flex-col rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
                Línea de tiempo de hoy
              </h2>
              <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-white/35">
                {dateLabel} · {totalBlocks} bloque{totalBlocks === 1 ? "" : "s"} ·{" "}
                {formatMinutes(totalMinutes)}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="app-glass-soft flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100/65 hover:text-slate-900 disabled:opacity-50 dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white/85"
            >
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Replanificar
            </button>
          </div>

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08]">
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
                    <span className="h-3 w-10 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-900/[0.08] dark:bg-white/[0.09]" />
                    <span className="h-3 flex-1 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.06]" />
                  </div>
                ))}
              </div>
            )}

            {!loading && !hasAnything && (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-slate-400 ring-1 ring-slate-900/[0.05] dark:bg-white/[0.05] dark:text-white/35 dark:ring-white/[0.06]">
                  <CalendarClock className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <p className="mt-3 text-[13px] font-medium text-slate-700 dark:text-white/70">
                  Nada en el horizonte
                </p>
                <p className="mt-1 max-w-xs text-[11.5px] leading-5 text-slate-500 dark:text-white/35">
                  No hay bloques para hoy. Añade una tarea o disfruta del tiempo libre.
                </p>
                <Link
                  href="/planner"
                  className="app-glass-soft mt-4 flex h-11 items-center gap-1.5 rounded-xl px-3 md:h-8 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100/65 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white"
                >
                  Abrir planificador
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
                          className={cn(
                            "group relative flex items-start gap-3 rounded-2xl px-2 py-2.5 transition-colors",
                            current
                              ? "bg-slate-900/[0.04] dark:bg-white/[0.05]"
                              : "hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.035]",
                          )}
                        >
                          <div className="w-[48px] shrink-0 pt-0.5 text-right">
                            <p
                              className={cn(
                                "text-[11px] font-medium tabular-nums",
                                current
                                  ? "text-slate-700 dark:text-white/85"
                                  : "text-slate-500 dark:text-white/50",
                              )}
                            >
                              {formatTime(item.start_at)}
                            </p>
                            <p className="mt-0.5 text-[9.5px] tabular-nums text-slate-400 dark:text-white/25">
                              {formatTime(item.end_at)}
                            </p>
                          </div>

                          <div className="relative flex w-3 shrink-0 justify-center self-stretch">
                            <span className="absolute inset-y-0 w-px bg-slate-900/[0.07] dark:bg-white/[0.07]" />
                            <span
                              className="relative mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white/80 dark:ring-black/25"
                              style={{ backgroundColor: color }}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p
                                className={cn(
                                  "truncate text-[13px] font-[450]",
                                  item.completed
                                    ? "text-slate-400 line-through opacity-60 dark:text-white/30"
                                    : "text-slate-700 dark:text-white/85",
                                )}
                              >
                                {item.title}
                              </p>
                              {current && (
                                <span className="shrink-0 rounded-full bg-[#30d158]/15 px-2 py-0.5 text-[9.5px] font-medium text-[#1a9e3a] dark:text-[#30d158]">
                                  Ahora
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/30">
                              {item.course_name || "Estudio"} ·{" "}
                              {formatMinutes(minutesBetween(item.start_at, item.end_at))}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={`Completar ${item.title}`}
                            title="Completar bloque"
                            onClick={() => void handleComplete(item.task_id)}
                            className={cn(
                              "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                              item.completed
                                ? "border-[#30d158]/60 bg-[#30d158]/15 text-[#1a9e3a] dark:text-[#30d158]"
                                : "border-slate-300 text-transparent hover:border-[#30d158]/70 hover:bg-[#30d158]/10 hover:text-[#1a9e3a] dark:border-white/20 dark:hover:text-[#30d158]",
                            )}
                          >
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-2 py-5 text-[11.5px] text-slate-500 dark:text-white/35">
                    <CalendarClock className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/25" strokeWidth={1.7} />
                    Hoy está libre. Los próximos bloques aparecen abajo.
                  </div>
                )}

                {upcomingGroups.length > 0 && (
                  <div className="mt-5">
                    <div className="flex items-center gap-3 px-2 pb-2">
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/25">
                        Próximos bloques
                      </p>
                      <span className="h-px flex-1 bg-slate-900/[0.06] dark:bg-white/[0.06]" />
                    </div>

                    <div className="space-y-4">
                      {upcomingGroups.map(([dayKey, items]) => (
                        <div key={dayKey}>
                          <p className="px-2 pb-1 text-[10px] font-medium text-slate-500 dark:text-white/35">
                            {dayHeading(items[0].start_at)}
                          </p>
                          <div className="space-y-0.5">
                            {items.map((item) => (
                              <div
                                key={`${item.task_id}-${item.start_at}`}
                                className="flex items-start gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.035]"
                              >
                                <div className="w-[48px] shrink-0 pt-0.5 text-right">
                                  <p className="text-[11px] font-medium tabular-nums text-slate-500 dark:text-white/45">
                                    {formatTime(item.start_at)}
                                  </p>
                                  <p className="mt-0.5 text-[9.5px] tabular-nums text-slate-400 dark:text-white/25">
                                    {formatTime(item.end_at)}
                                  </p>
                                </div>
                                <div className="relative flex w-3 shrink-0 justify-center self-stretch">
                                  <span className="absolute inset-y-0 w-px bg-slate-900/[0.07] dark:bg-white/[0.07]" />
                                  <span
                                    className="relative mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white/80 dark:ring-black/25"
                                    style={{
                                      backgroundColor:
                                        PRIORITY_COLOR[item.priority] ?? "#8e8e93",
                                    }}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12.5px] text-slate-600 dark:text-white/70">
                                    {item.title}
                                  </p>
                                  <p className="mt-0.5 truncate text-[10.5px] text-slate-400 dark:text-white/25">
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
                        href="/planner"
                        className="mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-white/35 dark:hover:text-white/70"
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

        <motion.div variants={DASHBOARD_ITEM} className="min-w-0 space-y-4">
          {/* ---- Tareas pendientes: activas + historial de vencidas ---- */}
          <TaskList
            tasks={tasks}
            historyTasks={overdueTasks}
            loading={tasksLoading}
            error={tasksError}
            strikeHistory={autoStrikeOverdue}
            courses={courses}
            onComplete={completeTask}
            onDelete={deleteTask}
            onTaskUpdated={() => void load()}
          />

          {/* ---- Continuar leyendo ---- */}
          {continueBook ? (
            <Link
              href={`/library/${continueBook.id}`}
              className="app-glass group flex items-center gap-3 rounded-3xl p-3.5 transition-colors hover:bg-slate-100/65 dark:hover:bg-black/30"
            >
              <div
                className="relative flex h-[76px] w-[54px] shrink-0 flex-col justify-between overflow-hidden rounded-xl p-2.5 text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)]"
                style={{
                  background: `linear-gradient(150deg, ${continueBook.cover_color}, #0f172a)`,
                }}
              >
                <span className="absolute inset-x-0 top-0 h-px bg-slate-400/20 dark:bg-white/10" />
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white shadow-[0_4px_10px_-4px_rgba(37,99,235,0.8)]">
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={1.9} />
                </span>
                <span className="text-[8px] font-semibold uppercase tracking-wider text-white/55">
                  {continueBook.format}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-slate-600 dark:text-white/70">
                  Continuar leyendo
                </p>
                <p className="mt-1 truncate text-[13px] font-medium text-slate-900 dark:text-white/90">
                  {continueBook.title}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-slate-600 dark:text-white/70">
                  {continueBook.current_section_title ||
                    `Sección ${continueBook.current_section_index + 1}`}{" "}
                  · {Math.round(continueBook.progress_percent)}%
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
                    style={{ width: `${Math.max(2, Math.min(100, continueBook.progress_percent))}%` }}
                  />
                </div>
              </div>

              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-slate-700 dark:text-white/25 dark:group-hover:text-white/65" />
            </Link>
          ) : (
            <Link
              href="/library"
              className="app-glass group flex items-center gap-3 rounded-3xl p-3.5 transition-colors hover:bg-slate-100/65 dark:hover:bg-black/30"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0a84ff]/15 text-[#0066FF] ring-1 ring-[#0a84ff]/15 dark:text-[#64a8ff]">
                <BookOpen className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-slate-700 dark:text-white/80">
                  {books.length > 0 ? "Elige tu próximo libro" : "Tu biblioteca te espera"}
                </p>
                <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/30">
                  {books.length > 0
                    ? "Abre uno y guardaremos tu progreso."
                    : "Sube un PDF, EPUB o DOCX para empezar."}
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-slate-700 dark:text-white/25 dark:group-hover:text-white/65" />
            </Link>
          )}

          <SyncStatus onSynced={load} />
        </motion.div>
      </motion.section>

      {/* ---- Quick Dock ---- */}
      <motion.section variants={DASHBOARD_ITEM} aria-labelledby="quick-dock-title" className="mt-6">
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
                className="group flex w-[60px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 transition-colors hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.055]"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-b ${tone} text-white shadow-[0_3px_9px_-3px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.28)] transition-transform duration-200 ease-mac group-hover:-translate-y-1 group-active:translate-y-0`}
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
                </span>
                <span className="max-w-full truncate text-[9px] font-medium tracking-[-0.01em] text-slate-500 transition-colors group-hover:text-slate-800 dark:text-white/35 dark:group-hover:text-white/70">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </motion.section>

      {editingExam ? (
        <ExamDialog
          open
          mode="edit"
          exam={editingExam}
          courses={courses}
          defaultDate={todayKey}
          onClose={() => setEditingExam(null)}
          onSaved={(_exam, message) => {
            setEditingExam(null);
            setGradeNotice(message);
          }}
          onDeleted={() => {
            setEditingExam(null);
            setGradeNotice("Examen eliminado del calendario y de la media.");
          }}
        />
      ) : null}
    </motion.div>
  );
}
