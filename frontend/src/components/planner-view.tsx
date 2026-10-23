"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  FileUp,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { usePreferences } from "@/components/preferences-provider";
import { useRealtime } from "@/components/realtime-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { formatDueLabel, isTaskOverdue, taskTitleClass } from "@/lib/task-utils";
import type { ClassEvent, Course, Task, TimetableEntry } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAYS_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#FF3B30",
  long_project: "#AF52DE",
  short_task: "#0066FF",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  long_project: "Proyecto",
  short_task: "Tarea corta",
};

const SUBJECT_TONES = [
  "#0066FF",
  "#AF52DE",
  "#FF9500",
  "#34C759",
  "#FF2D55",
  "#30B0C7",
  "#5856D6",
  "#8E8E93",
];

const selectClass =
  "flex h-9 w-full rounded-xl border border-white/60 bg-white/40 px-3 text-[13px] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-xl transition-[border-color,box-shadow,background-color] duration-150 focus-visible:border-[#0066FF] focus-visible:bg-white/55 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0066FF]/20 dark:border-white/10 dark:bg-white/[0.055] dark:text-white/90 dark:focus-visible:bg-white/[0.08]";

type Notice = { tone: "success" | "error" | "info"; text: string };
type EnrichedClassEvent = ClassEvent & { class_name?: string };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function keyOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseKey(key: string): Date | null {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso.slice(0, 10);
  return keyOf(date.getFullYear(), date.getMonth(), date.getDate());
}

function longDate(key: string): string {
  const date = parseKey(key);
  if (!date) return key;
  const formatted = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function durationMinutes(start: string, end: string): number {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

function timeLabel(value: string): string {
  return value.slice(0, 5);
}

function formatEventRange(event: ClassEvent): string {
  if (event.all_day) return "Todo el día";
  const start = new Date(event.start_at);
  if (!Number.isFinite(start.getTime())) return "";
  const startLabel = start.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!event.end_at) return startLabel;
  const end = new Date(event.end_at);
  if (!Number.isFinite(end.getTime())) return startLabel;
  return `${startLabel}–${end.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function toneFor(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return SUBJECT_TONES[hash % SUBJECT_TONES.length];
}

function courseColor(entry: TimetableEntry, course: Course | undefined): string {
  return course?.color?.trim() || toneFor(entry.course_id || entry.title || entry.id);
}

function subjectName(entry: TimetableEntry, course: Course | undefined): string {
  return course?.name?.trim() || entry.title?.trim() || "Clase";
}

function subjectSubtitle(entry: TimetableEntry, course: Course | undefined): string {
  const name = subjectName(entry, course);
  const title = entry.title?.trim();
  return title && title !== name ? title : "Clase lectiva";
}

function MonthEmpty({ weekend }: { weekend: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/70 bg-white/20 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066FF]/10 text-[#0066FF] ring-1 ring-[#0066FF]/15 dark:bg-[#0066FF]/15 dark:text-[#7fb2ff] dark:ring-[#0066FF]/20">
        {weekend ? <Coffee className="h-6 w-6" strokeWidth={1.7} /> : <CalendarDays className="h-6 w-6" strokeWidth={1.7} />}
      </span>
      <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
        {weekend ? "Día sin clases lectivas" : "No hay clases este día"}
      </p>
      <p className="mt-1 max-w-xs text-[11.5px] leading-5 text-slate-500 dark:text-white/40">
        {weekend
          ? "Descansa, adelanta apuntes o disfruta del fin de semana. Las entregas siguen visibles abajo."
          : "Puedes añadir una clase al horario o usar este hueco para estudiar."}
      </p>
    </div>
  );
}

export function PlannerView({ defaultOpenTools = false }: { defaultOpenTools?: boolean }) {
  const today = useMemo(() => new Date(), []);
  const [now, setNow] = useState(() => new Date());
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [events, setEvents] = useState<EnrichedClassEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCourseId, setTaskCourseId] = useState("");
  const [taskMinutes, setTaskMinutes] = useState(60);
  const [taskTime, setTaskTime] = useState("23:59");
  const [addingTask, setAddingTask] = useState(false);

  const [showTools, setShowTools] = useState(defaultOpenTools);
  const [classCourseId, setClassCourseId] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [classDay, setClassDay] = useState(() => weekdayIndex(today));
  const [classStart, setClassStart] = useState("08:15");
  const [classEnd, setClassEnd] = useState("09:15");
  const [classLocation, setClassLocation] = useState("");
  const [savingClass, setSavingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { autoStrikeOverdue } = usePreferences();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [taskList, courseList, timetableList, classList] = await Promise.all([
        api.tasks(),
        api.courses(),
        api.timetable(),
        api.classes().catch(() => []),
      ]);

      setTasks(taskList);
      setCourses(courseList);
      setEntries(timetableList);

      if (classList.length === 0) {
        setEvents([]);
      } else {
        const results = await Promise.allSettled(
          classList.map(async (sharedClass) => {
            const classEvents = await api.classEvents(sharedClass.id);
            return classEvents.map((event) => ({
              ...event,
              class_name: sharedClass.name,
            }));
          }),
        );
        setEvents(
          results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
        );
      }
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useRealtime((event) => {
    if (
      event.event === "tasks" ||
      event.event === "courses" ||
      event.event === "timetable" ||
      event.event === "classes" ||
      event.event === "class_events"
    ) {
      load(true).catch(() => undefined);
    }
  });

  const courseById = useMemo(() => {
    const map = new Map<string, Course>();
    for (const course of courses) map.set(course.id, course);
    return map;
  }, [courses]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = dayKey(task.due_at);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(task);
      map.set(key, bucket);
    }
    return map;
  }, [tasks]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EnrichedClassEvent[]>();
    for (const event of events) {
      const key = dayKey(event.start_at);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    }
    return map;
  }, [events]);

  const selectedDate = parseKey(selectedDay) ?? today;
  const selectedWeekday = weekdayIndex(selectedDate);
  const isWeekend = selectedWeekday >= 5;
  const isToday = selectedDay === todayKey;

  const selectedClasses = useMemo(
    () =>
      entries
        .filter((entry) => entry.day_of_week === selectedWeekday)
        .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)),
    [entries, selectedWeekday],
  );

  const selectedTasks = useMemo(() => {
    const list = tasksByDay.get(selectedDay) ?? [];
    return [...list].sort((a, b) => {
      const completed = Number(a.status === "completed") - Number(b.status === "completed");
      if (completed !== 0) return completed;
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });
  }, [selectedDay, tasksByDay]);

  const selectedEvents = useMemo(() => {
    const list = eventsByDay.get(selectedDay) ?? [];
    return [...list].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
  }, [eventsByDay, selectedDay]);

  const pendingSelected = selectedTasks.filter((task) => task.status !== "completed").length;

  const monthCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number; key: string } | null> = [];
    for (let index = 0; index < lead; index += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, key: keyOf(year, month, day) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const monthPending = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    return tasks.filter(
      (task) => task.status !== "completed" && task.due_at && dayKey(task.due_at)?.startsWith(prefix),
    ).length;
  }, [cursor, tasks]);

  const monthEventCount = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    return events.filter((event) => dayKey(event.start_at)?.startsWith(prefix)).length;
  }, [cursor, events]);

  function selectDay(key: string) {
    setSelectedDay(key);
    setConfirmDeleteId(null);
    const date = parseKey(key);
    if (date) setClassDay(weekdayIndex(date));
  }

  function changeMonth(delta: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    const nextKey = keyOf(next.getFullYear(), next.getMonth(), 1);
    const current = parseKey(selectedDay);
    if (
      !current ||
      current.getFullYear() !== next.getFullYear() ||
      current.getMonth() !== next.getMonth()
    ) {
      setSelectedDay(nextKey);
      setClassDay(weekdayIndex(next));
    }
    setConfirmDeleteId(null);
  }

  function goToday() {
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(todayKey);
    setClassDay(weekdayIndex(now));
    setConfirmDeleteId(null);
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!taskTitle.trim() || addingTask) return;
    setAddingTask(true);
    setNotice(null);
    try {
      const time = taskTime || "23:59";
      const due = new Date(`${selectedDay}T${time}:00`);
      if (Number.isNaN(due.getTime())) throw new Error("La hora de entrega no es válida");
      await api.createTask({
        title: taskTitle.trim(),
        due_at: due.toISOString(),
        estimated_minutes: Math.max(5, Number(taskMinutes) || 60),
        course_id: taskCourseId || undefined,
      });
      setTaskTitle("");
      setTaskCourseId("");
      setTaskMinutes(60);
      setTaskTime("23:59");
      setShowTaskForm(false);
      await load(true);
      setNotice({ tone: "success", text: `Tarea añadida al ${longDate(selectedDay).toLowerCase()}.` });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setAddingTask(false);
    }
  }

  async function completeTask(id: string) {
    if (busyTaskId) return;
    setBusyTaskId(id);
    setNotice(null);
    try {
      await api.completeTask(id);
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusyTaskId(null);
    }
  }

  async function removeTask(id: string) {
    if (busyTaskId) return;
    setBusyTaskId(id);
    setNotice(null);
    try {
      await api.deleteTask(id);
      setConfirmDeleteId(null);
      await load(true);
      setNotice({ tone: "success", text: "Tarea quitada del planificador." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusyTaskId(null);
    }
  }

  async function addClass(event: React.FormEvent) {
    event.preventDefault();
    if (savingClass) return;
    if (classStart >= classEnd) {
      setNotice({ tone: "error", text: "La hora de inicio debe ser anterior a la de fin." });
      return;
    }
    if (!classCourseId && !classTitle.trim()) {
      setNotice({
        tone: "error",
        text: "Indica una asignatura o una etiqueta para la clase.",
      });
      return;
    }
    setSavingClass(true);
    setNotice(null);
    try {
      await api.createTimetableEntry({
        day_of_week: classDay,
        start_time: classStart,
        end_time: classEnd,
        title: classTitle.trim() || null,
        course_id: classCourseId || null,
        location: classLocation.trim() || null,
      });
      setClassTitle("");
      setClassLocation("");
      await load(true);
      setNotice({ tone: "success", text: "Clase añadida al horario." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSavingClass(false);
    }
  }

  async function removeClass(id: string) {
    if (deletingClassId) return;
    setDeletingClassId(id);
    setNotice(null);
    try {
      await api.deleteTimetableEntry(id);
      await load(true);
      setNotice({ tone: "success", text: "Clase quitada del horario." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setDeletingClassId(null);
    }
  }

  async function importSchedule() {
    if (!importFile) {
      setNotice({ tone: "error", text: "Selecciona una foto, PDF o documento con tu horario." });
      return;
    }
    setImporting(true);
    setNotice(null);
    try {
      const document = await api.uploadFile(importFile);
      const result = await api.importTimetable(document.id, replace);
      setNotice({
        tone: "success",
        text: `${result.created} clases importadas (${
          result.source === "heuristic" ? "lectura local" : "con IA"
        }). Revisa que las horas sean correctas.`,
      });
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setImporting(false);
    }
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-12 pt-6 sm:px-7 lg:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">
            <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.9} />
            Planificador
          </p>
          <h1 className="mt-2 text-[30px] font-light leading-[1.05] tracking-[-0.035em] text-slate-800 dark:text-white/90 sm:text-[36px]">
            Tu semana, <span className="font-semibold">en orden.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-slate-500 dark:text-white/45">
            Calendario y horario en una sola vista. Pulsa un día para ver sus clases, entregas y
            exámenes; las tareas vencidas se marcan automáticamente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="app-glass-soft inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[11.5px] font-medium text-slate-600 dark:text-white/55">
            <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]" strokeWidth={1.8} />
            {monthPending} pendiente{monthPending === 1 ? "" : "s"} este mes
          </span>
          <Button variant="outline" size="sm" onClick={goToday}>
            <CalendarDays className="h-4 w-4" /> Hoy
          </Button>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "mt-4 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[12.5px] shadow-sm",
            notice.tone === "error"
              ? "border-rose-300/70 bg-rose-50/75 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
              : notice.tone === "success"
                ? "border-emerald-300/70 bg-emerald-50/75 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-white/60 bg-white/35 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/60",
          )}
        >
          {notice.tone === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-lg p-0.5 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[1fr_1.2fr]">
        {/* Columna izquierda: calendario mensual compacto */}
        <section className="app-glass rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                Calendario
              </p>
              <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-slate-800 dark:text-white/90">
                {monthLabel}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => changeMonth(-1)}
                aria-label="Mes anterior"
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToday} className="px-2.5">
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => changeMonth(1)}
                aria-label="Mes siguiente"
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="pb-1 text-center text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-white/30"
              >
                {day}
              </div>
            ))}
            {monthCells.map((cell, index) => {
              if (!cell) {
                return <div key={`empty-${index}`} className="min-h-[58px] rounded-2xl sm:min-h-[64px]" />;
              }
              const dayTasks = tasksByDay.get(cell.key) ?? [];
              const dayEvents = eventsByDay.get(cell.key) ?? [];
              const markers = [
                ...dayTasks.map((task) => PRIORITY_COLOR[task.priority] ?? "#8E8E93"),
                ...dayEvents.map((event) => (event.is_exam ? "#FF3B30" : "#30B0C7")),
              ].slice(0, 3);
              const selected = cell.key === selectedDay;
              const todayCell = cell.key === todayKey;
              const weekendCell = weekdayIndex(new Date(cursor.getFullYear(), cursor.getMonth(), cell.day)) >= 5;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => selectDay(cell.key)}
                  aria-pressed={selected}
                  aria-label={`${longDate(cell.key)}: ${dayTasks.length} tareas, ${dayEvents.length} eventos`}
                  className={cn(
                    "group relative flex min-h-[58px] flex-col items-center justify-start gap-1 rounded-2xl border px-1 py-2 text-center transition-all duration-200 ease-mac sm:min-h-[64px]",
                    selected
                      ? "border-[#0066FF]/30 bg-[#0066FF] text-white shadow-[0_12px_28px_-16px_rgba(0,102,255,0.95)]"
                      : todayCell
                        ? "border-[#0066FF]/30 bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#0066FF]/15 dark:text-[#7fb2ff]"
                        : "border-transparent text-slate-600 hover:border-white/70 hover:bg-white/40 dark:text-white/60 dark:hover:border-white/10 dark:hover:bg-white/[0.05]",
                    weekendCell && !selected && !todayCell && "text-slate-400 dark:text-white/35",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-medium tabular-nums",
                      selected
                        ? "bg-white/20"
                        : todayCell
                          ? "bg-[#0066FF]/10 dark:bg-[#0066FF]/15"
                          : "",
                    )}
                  >
                    {cell.day}
                  </span>
                  <span className="flex h-1.5 items-center justify-center gap-1">
                    {markers.map((color, markerIndex) => (
                      <span
                        key={`${cell.key}-${markerIndex}`}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: selected ? "rgba(255,255,255,0.88)" : color }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/50 pt-3 text-[10.5px] text-slate-500 dark:border-white/5 dark:text-white/35">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B30]" /> Urgente
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#AF52DE]" /> Proyecto
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0066FF]" /> Tarea corta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#30B0C7]" /> Examen / evento
              </span>
            </div>
            <span>
              {monthEventCount} evento{monthEventCount === 1 ? "" : "s"}
            </span>
          </div>
        </section>

        {/* Columna derecha: línea temporal del día seleccionado */}
        <section className="app-glass rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                Horario del día
              </p>
              <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.03em] text-slate-800 dark:text-white/90">
                {longDate(selectedDay)}
              </h2>
              <p className="mt-1 text-[11.5px] text-slate-500 dark:text-white/40">
                {selectedClasses.length} clase{selectedClasses.length === 1 ? "" : "s"} ·{" "}
                {selectedTasks.length} tarea{selectedTasks.length === 1 ? "" : "s"} ·{" "}
                {selectedEvents.length} evento{selectedEvents.length === 1 ? "" : "s"}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-7 items-center rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                isToday
                  ? "bg-[#0066FF]/12 text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#8ab9ff]"
                  : isWeekend
                    ? "bg-slate-500/10 text-slate-500 dark:bg-white/10 dark:text-white/45"
                    : "bg-white/40 text-slate-500 dark:bg-white/[0.06] dark:text-white/45",
              )}
            >
              {isToday ? "Hoy" : isWeekend ? "Fin de semana" : DAYS_LONG[selectedWeekday]}
            </span>
          </div>

          <div key={selectedDay} className="animate-planner-in mt-5">
            {isWeekend ? (
              <MonthEmpty weekend />
            ) : loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex animate-pulse items-center gap-3">
                    <span className="h-3 w-10 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-900/[0.08] dark:bg-white/[0.09]" />
                    <span className="h-14 flex-1 rounded-2xl bg-slate-900/[0.04] dark:bg-white/[0.05]" />
                  </div>
                ))}
              </div>
            ) : selectedClasses.length === 0 ? (
              <MonthEmpty weekend={false} />
            ) : (
              <div className="relative">
                <span className="absolute bottom-4 left-[65px] top-4 w-px bg-slate-200/80 dark:bg-white/10" />
                <div className="space-y-2.5">
                  {selectedClasses.map((entry) => {
                    const course = entry.course_id ? courseById.get(entry.course_id) : undefined;
                    const color = courseColor(entry, course);
                    const name = subjectName(entry, course);
                    const current =
                      isToday &&
                      nowMinutes >= timeToMinutes(entry.start_time) &&
                      nowMinutes <= timeToMinutes(entry.end_time);
                    return (
                      <div
                        key={entry.id}
                        className="group grid grid-cols-[44px_18px_minmax(0,1fr)] items-start gap-x-3"
                      >
                        <div className="pt-1.5 text-right">
                          <p className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-white/80">
                            {timeLabel(entry.start_time)}
                          </p>
                          <p className="mt-0.5 text-[9.5px] tabular-nums text-slate-400 dark:text-white/30">
                            {timeLabel(entry.end_time)}
                          </p>
                        </div>
                        <div className="relative flex justify-center pt-2.5">
                          <span
                            className="relative z-10 h-2.5 w-2.5 rounded-full ring-4 ring-white/80 dark:ring-[#0b0f18]"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                        <div
                          className={cn(
                            "min-w-0 rounded-2xl border p-3 transition-colors",
                            current
                              ? "border-[#0066FF]/30 bg-[#0066FF]/[0.07] dark:border-[#0066FF]/25 dark:bg-[#0066FF]/10"
                              : "border-white/55 bg-white/30 hover:bg-white/40 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]",
                          )}
                          style={{
                            borderLeftColor: color,
                            borderLeftWidth: 3,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
                                  {name}
                                </p>
                                {current && (
                                  <span className="shrink-0 rounded-full bg-[#30d158]/15 px-2 py-0.5 text-[9px] font-semibold text-[#1a9e3a] dark:text-[#5be07c]">
                                    Ahora
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                                {subjectSubtitle(entry, course)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <span
                                className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                                style={{
                                  backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`,
                                  color,
                                }}
                              >
                                {formatMinutes(durationMinutes(entry.start_time, entry.end_time))}
                              </span>
                              <button
                                type="button"
                                onClick={() => void removeClass(entry.id)}
                                disabled={deletingClassId === entry.id}
                                aria-label={`Quitar ${name}`}
                                title="Quitar clase"
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                              >
                                {deletingClassId === entry.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-slate-500 dark:text-white/35">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeLabel(entry.start_time)}–{timeLabel(entry.end_time)}
                            </span>
                            {entry.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {entry.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedEvents.length > 0 && (
              <div className="mt-5 border-t border-white/50 pt-4 dark:border-white/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                    Exámenes y eventos
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-white/30">
                    {selectedEvents.length}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {selectedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2.5 rounded-2xl border border-white/50 bg-white/25 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.025]"
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          event.is_exam ? "bg-[#FF3B30]" : "bg-[#30B0C7]",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-[12.5px] font-medium text-slate-700 dark:text-white/80">
                            {event.title}
                          </p>
                          {event.is_exam && (
                            <span className="shrink-0 rounded-full bg-[#FF3B30]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#d92b22] dark:text-[#ff8a80]">
                              Examen
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                          {event.class_name ? `${event.class_name} · ` : ""}
                          {formatEventRange(event)}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tareas del día seleccionado */}
            <div className="mt-5 border-t border-white/50 pt-4 dark:border-white/5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                    Entregas
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
                    Tareas del día
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] text-slate-400 dark:text-white/30">
                    {pendingSelected} pendiente{pendingSelected === 1 ? "" : "s"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTaskForm((value) => !value)}
                    className="h-8"
                  >
                    {showTaskForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showTaskForm ? "Cerrar" : "Nueva"}
                  </Button>
                </div>
              </div>

              {showTaskForm && (
                <form
                  onSubmit={addTask}
                  className="mt-3 space-y-2.5 rounded-2xl border border-white/60 bg-white/30 p-3 dark:border-white/[0.07] dark:bg-white/[0.03]"
                >
                  <Input
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="Título de la tarea o entrega"
                    maxLength={500}
                    aria-label="Título de la tarea"
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      className={selectClass}
                      value={taskCourseId}
                      onChange={(event) => setTaskCourseId(event.target.value)}
                      aria-label="Asignatura"
                    >
                      <option value="">Sin asignatura</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="time"
                      value={taskTime}
                      onChange={(event) => setTaskTime(event.target.value)}
                      aria-label="Hora de entrega"
                      className="tabular"
                    />
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={taskMinutes}
                      onChange={(event) => setTaskMinutes(Number(event.target.value))}
                      aria-label="Minutos estimados"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-400 dark:text-white/30">
                      Se guarda para el {longDate(selectedDay).toLowerCase()}.
                    </p>
                    <Button type="submit" size="sm" disabled={!taskTitle.trim() || addingTask}>
                      {addingTask ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Añadir
                    </Button>
                  </div>
                </form>
              )}

              {selectedTasks.length === 0 ? (
                <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-dashed border-white/70 px-3 py-4 text-[11.5px] text-slate-500 dark:border-white/10 dark:text-white/35">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34C759]" />
                  Sin entregas para este día. Buen momento para adelantar trabajo.
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  {selectedTasks.map((task) => {
                    const course = task.course_id ? courseById.get(task.course_id) : undefined;
                    const completed = task.status === "completed";
                    const overdue = autoStrikeOverdue && isTaskOverdue(task, now.getTime());
                    const busy = busyTaskId === task.id;
                    const confirming = confirmDeleteId === task.id;
                    return (
                      <div key={task.id}>
                        <div className="group flex items-start gap-2.5 rounded-2xl px-1.5 py-2.5 transition-colors hover:bg-white/30 dark:hover:bg-white/[0.03]">
                          <button
                            type="button"
                            onClick={() => void completeTask(task.id)}
                            disabled={completed || busy}
                            aria-label={completed ? "Tarea completada" : `Completar ${task.title}`}
                            title={completed ? "Completada" : "Completar tarea"}
                            className={cn(
                              "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                              completed
                                ? "border-[#34C759]/60 bg-[#34C759]/15 text-[#1a9e3a] dark:text-[#5be07c]"
                                : "border-slate-300 text-transparent hover:border-[#34C759]/70 hover:bg-[#34C759]/10 hover:text-[#1a9e3a] dark:border-white/20 dark:hover:text-[#5be07c]",
                            )}
                          >
                            {busy ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Check className="h-2.5 w-2.5" strokeWidth={3} />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p
                                className={cn(
                                  "truncate text-[12.5px] font-medium",
                                  taskTitleClass(task, autoStrikeOverdue),
                                )}
                              >
                                {task.title}
                              </p>
                              {overdue && (
                                <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-rose-600 dark:text-rose-300">
                                  Vencida
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-slate-500 dark:text-white/35">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDueLabel(task.due_at)}
                              </span>
                              <span className="text-slate-300 dark:text-white/20">·</span>
                              <span>{formatMinutes(task.estimated_minutes)}</span>
                              {course && (
                                <>
                                  <span className="text-slate-300 dark:text-white/20">·</span>
                                  <span className="inline-flex min-w-0 items-center gap-1">
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{ backgroundColor: course.color ?? "#8E8E93" }}
                                    />
                                    <span className="max-w-[130px] truncate">{course.name}</span>
                                  </span>
                                </>
                              )}
                              <span className="text-slate-300 dark:text-white/20">·</span>
                              <span style={{ color: PRIORITY_COLOR[task.priority] }}>
                                {PRIORITY_LABEL[task.priority] ?? task.priority}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(confirming ? null : task.id)}
                            disabled={busy}
                            aria-label={`Quitar ${task.title}`}
                            title="Quitar tarea"
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 dark:text-white/30 dark:hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {confirming && (
                          <div className="ml-8 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/70 bg-rose-50/70 px-2.5 py-2 dark:border-rose-400/20 dark:bg-rose-500/10">
                            <p className="text-[11px] font-medium text-rose-700 dark:text-rose-200">
                              ¿Quitar esta tarea?
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => void removeTask(task.id)}
                                disabled={busy}
                              >
                                Quitar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Gestión del horario: añadir, importar y quitar clases */}
      <section className="app-glass mt-4 rounded-3xl p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setShowTools((value) => !value)}
          aria-expanded={showTools}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
              Horario semanal
            </p>
            <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
              Gestionar clases
            </h2>
            <p className="mt-1 text-[11.5px] text-slate-500 dark:text-white/40">
              Añade una clase a mano o importa una foto o un PDF de tu horario.
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/35 text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-200", showTools && "rotate-180")}
            />
          </span>
        </button>

        {showTools && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <form
              onSubmit={addClass}
              className="rounded-2xl border border-white/60 bg-white/30 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#0066FF]" />
                <p className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
                  Añadir clase
                </p>
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="planner-class-course">Asignatura</Label>
                  <select
                    id="planner-class-course"
                    className={selectClass}
                    value={classCourseId}
                    onChange={(event) => setClassCourseId(event.target.value)}
                  >
                    <option value="">Sin asignatura</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="planner-class-day">Día</Label>
                  <select
                    id="planner-class-day"
                    className={selectClass}
                    value={classDay}
                    onChange={(event) => setClassDay(Number(event.target.value))}
                  >
                    {DAYS_LONG.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="planner-class-start">Desde</Label>
                  <Input
                    id="planner-class-start"
                    type="time"
                    value={classStart}
                    onChange={(event) => setClassStart(event.target.value)}
                    className="tabular"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="planner-class-end">Hasta</Label>
                  <Input
                    id="planner-class-end"
                    type="time"
                    value={classEnd}
                    onChange={(event) => setClassEnd(event.target.value)}
                    className="tabular"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="planner-class-title">Etiqueta</Label>
                  <Input
                    id="planner-class-title"
                    value={classTitle}
                    onChange={(event) => setClassTitle(event.target.value)}
                    placeholder="Teoría / Práctica"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="planner-class-location">Aula</Label>
                  <Input
                    id="planner-class-location"
                    value={classLocation}
                    onChange={(event) => setClassLocation(event.target.value)}
                    placeholder="B3"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" className="mt-3" disabled={savingClass}>
                {savingClass ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Añadir clase
              </Button>
            </form>

            <div className="rounded-2xl border border-dashed border-white/70 bg-white/20 p-3.5 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <FileUp className="h-4 w-4 text-[#0066FF]" />
                <p className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
                  Importar horario
                </p>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-slate-500 dark:text-white/40">
                Sube una foto, PDF o Word. La IA detecta días, horas y asignaturas; sin IA se usa un
                lector de líneas.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.xlsx"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-[11.5px] text-slate-500 file:mr-3 file:rounded-xl file:border file:border-white/60 file:bg-white/50 file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-slate-700 hover:file:bg-white/70 dark:text-white/40 dark:file:border-white/10 dark:file:bg-white/[0.06] dark:file:text-white/70"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/40">
                  <input
                    type="checkbox"
                    checked={replace}
                    onChange={(event) => setReplace(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0066FF] dark:border-white/20"
                  />
                  Reemplazar el horario actual
                </label>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void importSchedule()}
                  disabled={importing || !importFile}
                >
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileUp className="h-3.5 w-3.5" />
                  )}
                  {importing ? "Leyendo..." : "Importar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {loading && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[11.5px] text-slate-400 dark:text-white/30">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Actualizando tu planificador…
        </div>
      )}
    </div>
  );
}
