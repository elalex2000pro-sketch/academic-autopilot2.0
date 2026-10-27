"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Brain,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  FolderOpen,
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
import { ExamDialog } from "@/components/exam-dialog";
import { usePreferences } from "@/components/preferences-provider";
import { Input } from "@/components/ui/input";
import { SyncStatus } from "@/components/sync-status";
import { TaskList } from "@/components/task-list";
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
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-900/10 dark:text-white/10"
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
    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400 dark:text-white/35">
      {children}
    </p>
  );
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
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

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

    // Biblioteca, tareas y notas no bloquean el primer pintado. Si alguna
    // falla, el dashboard sigue mostrando el plan y se reintenta al navegar.
    void Promise.allSettled([
      api.books().then(setBooks).catch(() => setBooks([])),
      refreshTasks({ silent: true }).catch(() => undefined),
      refreshGradeData().catch(() => undefined),
    ]);
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
  const projectCount = tasks.filter((task) => task.priority === "long_project").length;
  const shortCount = tasks.filter((task) => task.priority === "short_task").length;
  const taskTotal = Math.max(1, tasks.length);

  const todayKey = localDateKey();
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
    <div className="relative mx-auto max-w-[1500px] px-5 pb-12 pt-6 sm:px-7 lg:pt-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/35">
            <span className="h-1.5 w-1.5 rounded-full bg-[#30d158]" />
            {dateLabel}
          </p>

          <h1 className="mt-3 text-[30px] font-light leading-[1.05] tracking-[-0.035em] text-slate-800 dark:text-white/90 sm:text-[36px]">
            {greeting}, <span className="font-semibold">{name}</span>
          </h1>

          <p className="mt-2 max-w-xl text-[12.5px] leading-5 text-slate-500 dark:text-white/45">
            {tasks.length > 0
              ? `Tienes ${tasks.length} tarea${tasks.length === 1 ? "" : "s"} pendiente${
                  tasks.length === 1 ? "" : "s"
                }. Tu plan de hoy ya está repartido en huecos.`
              : "No tienes tareas pendientes. Buen momento para adelantar apuntes o crear un cuaderno nuevo."}
          </p>

          <p className="mt-3 flex max-w-xl items-start gap-2 text-[11.5px] leading-5 text-slate-500 dark:text-white/35">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#bf5af2]" strokeWidth={1.8} />
            <span>{impulse}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/planner"
            className="app-glass-soft flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-100/65 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.8} />
            Planificador
          </Link>
          <Link
            href="/studio"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-900/[0.06] px-3 text-[12px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-colors hover:bg-slate-900/[0.09] dark:bg-white/[0.10] dark:text-white/85 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:bg-white/[0.15]"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            Crear con IA
          </Link>
        </div>
      </header>

      {/* ---- Widgets superiores ---- */}
      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="app-glass rounded-3xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <StatLabel>
                <ListTodo className="h-3 w-3" strokeWidth={1.9} />
                Pendientes
              </StatLabel>
              <p className="mt-2 text-[28px] font-light leading-none tracking-[-0.04em] text-slate-800 dark:text-white/90">
                {tasks.length}
              </p>
              <p className="mt-1.5 text-[10.5px] text-slate-500 dark:text-white/35">
                {tasks.length === 0
                  ? "Todo al día"
                  : `${urgentCount} urgente${urgentCount === 1 ? "" : "s"}`}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-slate-500 ring-1 ring-slate-900/[0.05] dark:bg-white/[0.055] dark:text-white/45 dark:ring-white/[0.05]">
              <ListTodo className="h-4 w-4" strokeWidth={1.8} />
            </span>
          </div>
          <div className="mt-4 flex h-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08]">
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

        <div className="app-glass flex items-center gap-3 rounded-3xl p-4">
          <ProgressRing value={planProgress} color="#30d158">
            <span className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-white/80">
              {planProgress}%
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <StatLabel>
              <Timer className="h-3 w-3" strokeWidth={1.9} />
              Plan de hoy
            </StatLabel>
            <p className="mt-1.5 text-[20px] font-light leading-none tracking-[-0.03em] text-slate-800 dark:text-white/90">
              {formatMinutes(completedMinutes)}
            </p>
            <p className="mt-1.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
              de {formatMinutes(totalMinutes)}
            </p>
          </div>
        </div>

        <div className="app-glass flex items-center gap-3 rounded-3xl p-4">
          <ProgressRing value={blockProgress} color="#bf5af2">
            <span className="text-[10px] font-semibold tabular-nums text-slate-700 dark:text-white/80">
              {completedBlocks}/{totalBlocks}
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <StatLabel>
              <CalendarClock className="h-3 w-3" strokeWidth={1.9} />
              Bloques
            </StatLabel>
            <p className="mt-1.5 text-[20px] font-light leading-none tracking-[-0.03em] text-slate-800 dark:text-white/90">
              {totalBlocks} <span className="text-[11px] text-slate-400 dark:text-white/30">hoy</span>
            </p>
            <p className="mt-1.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
              {completedBlocks} completado{completedBlocks === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="app-glass flex items-center gap-3 rounded-3xl p-4">
          <ProgressRing value={readingProgress} color="#ff9f0a">
            <span className="text-[10px] font-semibold tabular-nums text-slate-700 dark:text-white/80">
              {Math.round(readingProgress)}%
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <StatLabel>
              <BookOpen className="h-3 w-3" strokeWidth={1.9} />
              Lectura
            </StatLabel>
            <p className="mt-1.5 text-[20px] font-light leading-none tracking-[-0.03em] text-slate-800 dark:text-white/90">
              {readingBooks.length}{" "}
              <span className="text-[11px] text-slate-400 dark:text-white/30">en curso</span>
            </p>
            <p className="mt-1.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
              {continueBook ? continueBook.title : "Elige tu próximo libro"}
            </p>
          </div>
        </div>
      </section>

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
      <section className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
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
                  className="app-glass-soft mt-4 flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100/65 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white"
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

        <div className="min-w-0 space-y-4">
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
                <BookOpen className="h-4 w-4 text-white/80" strokeWidth={1.8} />
                <span className="text-[8px] font-semibold uppercase tracking-wider text-white/55">
                  {continueBook.format}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                  Continuar leyendo
                </p>
                <p className="mt-1 truncate text-[13px] font-medium text-slate-800 dark:text-white/85">
                  {continueBook.title}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                  {continueBook.current_section_title ||
                    `Sección ${continueBook.current_section_index + 1}`}{" "}
                  · {Math.round(continueBook.progress_percent)}%
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-[#0a84ff]"
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
      </section>

      <ExamDialog
        open={Boolean(editingExam)}
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
    </div>
  );
}
