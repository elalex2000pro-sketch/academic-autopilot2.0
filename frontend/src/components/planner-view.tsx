"use client";

import { PlannerTasksPanel } from "@/components/planner/planner-tasks-panel";
import { PlannerQuickEventForm, type QuickEventType } from "@/components/planner/planner-quick-event-form";
import { PlannerOverview } from "@/components/planner/planner-overview";
import { PlannerHeader } from "@/components/planner/planner-header";
import { motion } from "framer-motion";
import { EditablePanels } from "@/components/layout/editable-panels";
import { pageItem, pageStagger } from "@/components/page-animated-wrapper";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, FileUp, Loader2, MapPin, Pencil, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { ExamCard } from "@/components/exam-card";
import { ExamDialog, type ExamDialogMode } from "@/components/exam-dialog";
import { TaskDialog } from "@/components/task-dialog";
import { useRealtime } from "@/components/realtime-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeeklyTimetable } from "@/components/weekly-timetable";
import { useTaskManager } from "@/hooks/use-task-manager";
import { api } from "@/lib/api";
import {
  createLocalTimetableEntry,
  CUSTOM_TIMETABLE_EVENT,
  CUSTOM_TIMETABLE_KEY,
  hydrateTimetableCourses,
  isLocalTimetableEntry,
  loadCustomTimetable,
  saveCustomTimetable,
} from "@/lib/custom-timetable";
import { examDateKey, sortExams } from "@/lib/exams";
import {
  GRADE_CHANGE_EVENT,
  GRADE_CHANGE_STORAGE_KEY,
  notifyGradeChange,
} from "@/lib/grade-events";
import type { Course, Grade, ImportantDate, Task, TimetableEntry } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { DAYS_LONG, MONTHS, PRIORITY_COLOR, WEEKDAYS, courseColor, dayKey, durationMinutes, errorMessage, formatEventRange, keyOf, longDate, pad, parseKey, selectClass, subjectName, subjectSubtitle, timeLabel, timeToMinutes, weekdayIndex, type EnrichedClassEvent, type Notice } from "@/lib/planner";
import { MonthEmpty } from "@/components/planner/month-empty";

export function PlannerView({ defaultOpenTools = false }: { defaultOpenTools?: boolean }) {
  const today = useMemo(() => new Date(), []);
  const [now, setNow] = useState(() => new Date());
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [courses, setCourses] = useState<Course[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [events, setEvents] = useState<EnrichedClassEvent[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [examDialog, setExamDialog] = useState<{
    mode: ExamDialogMode;
    exam: Grade | null;
  } | null>(null);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const {
    activeTasks,
    refresh: refreshTasks,
    completeTask: completeManagedTask,
    deleteTask: deleteManagedTask,
  } = useTaskManager({ autoLoad: false });
  const tasks = activeTasks;

  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCourseId, setTaskCourseId] = useState("");
  const [taskMinutes, setTaskMinutes] = useState(60);
  const [taskTime, setTaskTime] = useState("23:59");
  const [addingTask, setAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [showTools, setShowTools] = useState(defaultOpenTools);
  const [classCourseId, setClassCourseId] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [classDay, setClassDay] = useState(() => weekdayIndex(today));
  const [classStart, setClassStart] = useState("08:15");
  const [classEnd, setClassEnd] = useState("09:15");
  const [classLocation, setClassLocation] = useState("");
  const [savingClass, setSavingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);
  const [focusClassForm, setFocusClassForm] = useState(0);
  const classFormRef = useRef<HTMLFormElement>(null);
  const entriesRef = useRef<TimetableEntry[]>([]);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quickType, setQuickType] = useState<QuickEventType>("exam");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDate, setQuickDate] = useState(todayKey);
  const [quickCourseId, setQuickCourseId] = useState("");
  const [quickTime, setQuickTime] = useState("18:00");
  const [quickNotes, setQuickNotes] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [deletingImportantId, setDeletingImportantId] = useState<string | null>(null);
  const quickFormRef = useRef<HTMLElement>(null);
  const quickTitleRef = useRef<HTMLInputElement>(null);

  // Mantiene la copia local y el estado sincronizados. `persist = false` se usa
  // al leer del servidor para no crear una personalización sin que el usuario
  // haya tocado nada.
  const applyEntries = useCallback((next: TimetableEntry[], persist = true) => {
    entriesRef.current = next;
    setEntries(next);
    if (persist) saveCustomTimetable(next);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const customTimetable = loadCustomTimetable();
      const [, courseList, timetableList, classList, gradeList, importantList] = await Promise.all([
        refreshTasks({ silent: true }),
        api.courses(),
        customTimetable ? Promise.resolve([] as TimetableEntry[]) : api.timetable(),
        api.classes().catch(() => []),
        // Si falla la red se conservan los examenes ya cargados.
        api.grades().catch(() => null),
        api.importantDates().catch(() => [] as ImportantDate[]),
      ]);

      setCourses(courseList);
      if (Array.isArray(gradeList)) setGrades(gradeList);
      if (Array.isArray(importantList)) setImportantDates(importantList);
      applyEntries(
        customTimetable
          ? hydrateTimetableCourses(customTimetable, courseList)
          : timetableList,
        false,
      );

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
  }, [refreshTasks, applyEntries]);

  const refreshGrades = useCallback(async () => {
    try {
      const gradeList = await api.grades();
      if (Array.isArray(gradeList)) setGrades(gradeList);
    } catch {
      // Si falla la red se conserva la ultima lista conocida.
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // Cambios de notas hechos en Academico, en otra pestaña o desde el propio
  // formulario de examen: el calendario se actualiza sin recargar la pagina.
  useEffect(() => {
    const handleGradeChange = () => {
      void refreshGrades();
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
  }, [refreshGrades]);

  useEffect(() => {
    if (focusClassForm === 0) return;
    classFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusClassForm]);

  // Si Ajustes restaura el horario oficial (u otra pestaña lo cambia), la vista
  // se actualiza sin necesidad de recargar.
  const syncFromLocal = useCallback(() => {
    const stored = loadCustomTimetable();
    if (stored === null) return;
    applyEntries(hydrateTimetableCourses(stored, courses), false);
  }, [applyEntries, courses]);

  useEffect(() => {
    const handleCustomChange = () => syncFromLocal();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CUSTOM_TIMETABLE_KEY) syncFromLocal();
    };
    window.addEventListener(CUSTOM_TIMETABLE_EVENT, handleCustomChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CUSTOM_TIMETABLE_EVENT, handleCustomChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncFromLocal]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useRealtime((event) => {
    if (event.event === "grades") {
      void refreshGrades();
      return;
    }
    if (
      event.event === "tasks" ||
      event.event === "courses" ||
      event.event === "timetable" ||
      event.event === "classes" ||
      event.event === "class_events" ||
      event.event === "important_dates"
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

  const exams = useMemo(() => grades.filter((grade) => grade.is_exam), [grades]);

  const examsByDay = useMemo(() => {
    const map = new Map<string, Grade[]>();
    for (const exam of exams) {
      const key = examDateKey(exam);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(exam);
      map.set(key, bucket);
    }
    return map;
  }, [exams]);

  // Exámenes que aún no han pasado, del más cercano al más lejano.
  const upcomingExams = useMemo(
    () =>
      sortExams(exams)
        .filter((exam) => {
          const key = examDateKey(exam);
          return Boolean(key) && (key as string) >= todayKey;
        })
        .slice(0, 6),
    [exams, todayKey],
  );

  const importantByDay = useMemo(() => {
    const map = new Map<string, ImportantDate[]>();
    for (const event of importantDates) {
      const key = event.date.slice(0, 10);
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    }
    return map;
  }, [importantDates]);

  const selectedDate = parseKey(selectedDay) ?? today;
  const selectedWeekday = weekdayIndex(selectedDate);
  const isWeekend = selectedWeekday >= 5;
  const isToday = selectedDay === todayKey;

  const weekStart = useMemo(() => {
    const base = parseKey(selectedDay) ?? today;
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    start.setDate(start.getDate() - weekdayIndex(base));
    return start;
  }, [selectedDay, today]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 5 }, (_, position) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + position);
        return {
          date,
          key: keyOf(date.getFullYear(), date.getMonth(), date.getDate()),
          weekday: position,
        };
      }),
    [weekStart],
  );

  const weekLabel = useMemo(() => {
    const first = weekDays[0]?.date;
    const last = weekDays[4]?.date;
    if (!first || !last) return "";
    const format = (date: Date, withMonth: boolean) =>
      new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        ...(withMonth ? { month: "short" } : {}),
      }).format(date);
    return `${format(first, first.getMonth() !== last.getMonth())} – ${format(last, true)}`;
  }, [weekDays]);

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

  const selectedExams = useMemo(
    () => sortExams(examsByDay.get(selectedDay) ?? []),
    [examsByDay, selectedDay],
  );

  const selectedImportantDates = useMemo(
    () => importantByDay.get(selectedDay) ?? [],
    [importantByDay, selectedDay],
  );

  const pendingSelected = selectedTasks.length;

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
    return tasks.filter((task) => task.due_at && dayKey(task.due_at)?.startsWith(prefix)).length;
  }, [cursor, tasks]);

  const monthEventCount = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    return events.filter((event) => dayKey(event.start_at)?.startsWith(prefix)).length;
  }, [cursor, events]);

  const monthExamCount = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    return exams.filter((exam) => examDateKey(exam)?.startsWith(prefix)).length;
  }, [cursor, exams]);

  const monthPendingExamCount = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    return exams.filter(
      (exam) => exam.score === null && examDateKey(exam)?.startsWith(prefix),
    ).length;
  }, [cursor, exams]);

  const monthImportantCount = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    return importantDates.filter((event) => event.date.startsWith(prefix)).length;
  }, [cursor, importantDates]);

  function selectDay(key: string) {
    setSelectedDay(key);
    setQuickDate(key);
    setConfirmDeleteId(null);
    setSelectedClassId(null);
    setConfirmDeleteClassId(null);
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
      setQuickDate(nextKey);
      setClassDay(weekdayIndex(next));
    }
    setConfirmDeleteId(null);
    setSelectedClassId(null);
    setConfirmDeleteClassId(null);
  }

  function changePeriod(delta: number) {
    if (viewMode === "month") {
      changeMonth(delta);
      return;
    }
    const base = parseKey(selectedDay) ?? today;
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    next.setDate(next.getDate() + delta * (viewMode === "week" ? 7 : 1));
    selectDay(keyOf(next.getFullYear(), next.getMonth(), next.getDate()));
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function goToday() {
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(todayKey);
    setQuickDate(todayKey);
    setClassDay(weekdayIndex(now));
    setConfirmDeleteId(null);
    setSelectedClassId(null);
    setConfirmDeleteClassId(null);
  }

  function openQuickAdd(type: QuickEventType) {
    setQuickType(type);
    setQuickDate(selectedDay);
    setNotice(null);
    requestAnimationFrame(() => {
      quickFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      quickTitleRef.current?.focus({ preventScroll: true });
    });
  }

  async function addQuickEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!quickTitle.trim() || quickBusy) return;
    const date = parseKey(quickDate);
    if (!date) {
      setNotice({ tone: "error", text: "Elige una fecha válida para el evento." });
      return;
    }

    setQuickBusy(true);
    setNotice(null);
    try {
      const title = quickTitle.trim();
      const notes = quickNotes.trim() || null;

      if (quickType === "exam") {
        const created = await api.createGrade({
          title,
          course_id: quickCourseId || null,
          graded_at: quickDate,
          notes,
          is_exam: true,
          score: null,
          max_score: 10,
        });
        setGrades((current) => [...current, created]);
        notifyGradeChange();
      } else if (quickType === "task") {
        const due = new Date(`${quickDate}T${quickTime || "23:59"}:00`);
        if (Number.isNaN(due.getTime())) {
          throw new Error("La hora de entrega no es válida");
        }
        await api.createTask({
          title,
          due_at: due.toISOString(),
          estimated_minutes: 60,
          course_id: quickCourseId || undefined,
        });
        await refreshTasks({ silent: true });
      } else {
        const created = await api.createImportantDate({
          title,
          date: quickDate,
          notes,
        });
        setImportantDates((current) =>
          [...current, created].sort((a, b) => a.date.localeCompare(b.date)),
        );
      }

      setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
      setSelectedDay(quickDate);
      setQuickTitle("");
      setQuickNotes("");
      setNotice({
        tone: "success",
        text:
          quickType === "exam"
            ? `Examen añadido al ${longDate(quickDate).toLowerCase()} y a la media.`
            : quickType === "task"
              ? `Tarea añadida al ${longDate(quickDate).toLowerCase()}.`
              : `Fecha importante guardada para el ${longDate(quickDate).toLowerCase()}.`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setQuickBusy(false);
    }
  }

  async function removeImportantDate(id: string) {
    if (deletingImportantId) return;
    setDeletingImportantId(id);
    setNotice(null);
    try {
      await api.deleteImportantDate(id);
      setImportantDates((current) => current.filter((event) => event.id !== id));
      setNotice({ tone: "success", text: "Fecha importante eliminada." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setDeletingImportantId(null);
    }
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
      await completeManagedTask(id);
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
    setConfirmDeleteId(null);
    try {
      await deleteManagedTask(id);
      setNotice({ tone: "success", text: "Tarea quitada del planificador." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusyTaskId(null);
    }
  }

  function openCreateExam() {
    setExamDialog({ mode: "create", exam: null });
    setNotice(null);
  }

  function openExamDialog(mode: ExamDialogMode, exam: Grade) {
    setExamDialog({ mode, exam });
    setNotice(null);
  }

  function handleExamSaved(saved: Grade, message: string) {
    setGrades((current) => {
      const exists = current.some((grade) => grade.id === saved.id);
      return exists
        ? current.map((grade) => (grade.id === saved.id ? saved : grade))
        : [...current, saved];
    });
    setExamDialog(null);
    setNotice({ tone: "success", text: message });
  }

  function handleExamDeleted(id: string) {
    setGrades((current) => current.filter((grade) => grade.id !== id));
    setNotice({ tone: "success", text: "Examen eliminado del calendario y de la media." });
  }

  async function removeExam(exam: Grade) {
    if (deletingExamId) return;
    setDeletingExamId(exam.id);
    setNotice(null);
    try {
      await api.deleteGrade(exam.id);
      setGrades((current) => current.filter((grade) => grade.id !== exam.id));
      notifyGradeChange();
      setNotice({ tone: "success", text: "Examen eliminado del calendario y de la media." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setDeletingExamId(null);
    }
  }

  function clearClassForm() {
    setEditingClassId(null);
    setClassCourseId("");
    setClassTitle("");
    setClassLocation("");
    setClassStart("08:15");
    setClassEnd("09:15");
    const selectedDate = parseKey(selectedDay) ?? today;
    setClassDay(weekdayIndex(selectedDate));
  }

  function startAddClass() {
    clearClassForm();
    setSelectedClassId(null);
    setConfirmDeleteClassId(null);
    setShowTools(true);
    setNotice(null);
    setFocusClassForm((value) => value + 1);
  }

  function startEditClass(entry: TimetableEntry) {
    const course = entry.course_id ? courseById.get(entry.course_id) : undefined;
    setEditingClassId(entry.id);
    setSelectedClassId(entry.id);
    setConfirmDeleteClassId(null);
    setClassCourseId(entry.course_id ?? "");
    setClassTitle(entry.title && entry.title !== course?.name ? entry.title : "");
    setClassDay(entry.day_of_week);
    setClassStart(entry.start_time.slice(0, 5));
    setClassEnd(entry.end_time.slice(0, 5));
    setClassLocation(entry.location ?? "");
    setShowTools(true);
    setNotice({
      tone: "info",
      text: `Editando ${subjectName(entry, course)}. Los cambios se guardan en este dispositivo.`,
    });
    setFocusClassForm((value) => value + 1);
  }

  function cancelEditClass() {
    clearClassForm();
    setSelectedClassId(null);
    setNotice(null);
  }

  async function saveClass(event: React.FormEvent) {
    event.preventDefault();
    if (savingClass) return;

    if (timeToMinutes(classStart) >= timeToMinutes(classEnd)) {
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

    const course = classCourseId ? courseById.get(classCourseId) : undefined;
    const base = {
      course_id: classCourseId || null,
      title: classTitle.trim() || course?.name?.trim() || null,
      day_of_week: classDay,
      start_time: classStart,
      end_time: classEnd,
      location: classLocation.trim() || null,
    };

    if (editingClassId) {
      if (!entriesRef.current.some((entry) => entry.id === editingClassId)) {
        clearClassForm();
        setNotice({ tone: "info", text: "La franja que editabas ya no existe." });
        return;
      }
      applyEntries(
        entriesRef.current.map((entry) =>
          entry.id === editingClassId ? { ...entry, ...base } : entry,
        ),
      );
      setSelectedClassId(editingClassId);
      clearClassForm();
      setNotice({ tone: "success", text: "Asignatura actualizada en el horario." });
      return;
    }

    const localEntry = createLocalTimetableEntry(base);
    applyEntries([...entriesRef.current, localEntry]);
    setSelectedClassId(localEntry.id);
    clearClassForm();
    setSavingClass(true);
    setNotice({ tone: "success", text: "Asignatura añadida al horario." });

    try {
      const saved = await api.createTimetableEntry(base);
      if (!saved || typeof saved.id !== "string" || saved.id.length === 0) {
        throw new Error("El servidor no devolvió la clase creada.");
      }

      const current = entriesRef.current;
      if (!current.some((entry) => entry.id === localEntry.id)) {
        // Se eliminó mientras se sincronizaba: limpia también la copia del servidor.
        await api.deleteTimetableEntry(saved.id).catch(() => undefined);
        return;
      }

      // Conserva los campos locales (incluidas posibles ediciones) y adopta el
      // id del servidor para que el borrado posterior también sincronice.
      applyEntries(
        current.map((entry) =>
          entry.id === localEntry.id ? { ...entry, id: saved.id } : entry,
        ),
      );
      setSelectedClassId((currentId) => (currentId === localEntry.id ? saved.id : currentId));
    } catch {
      setNotice({
        tone: "info",
        text: "Asignatura guardada en este dispositivo. No se pudo sincronizar con el servidor.",
      });
    } finally {
      setSavingClass(false);
    }
  }

  async function removeClass(id: string) {
    const entry = entriesRef.current.find((item) => item.id === id);
    if (!entry) return;

    setDeletingClassId(id);
    setNotice(null);
    applyEntries(entriesRef.current.filter((item) => item.id !== id));
    if (selectedClassId === id) setSelectedClassId(null);
    if (editingClassId === id) clearClassForm();
    setConfirmDeleteClassId(null);
    setNotice({ tone: "success", text: "Asignatura eliminada del horario." });

    try {
      // Las franjas oficiales y las creadas en local no existen en el servidor.
      if (!isLocalTimetableEntry(entry)) {
        await api.deleteTimetableEntry(id);
      }
    } catch {
      setNotice({
        tone: "info",
        text: "Asignatura eliminada en este dispositivo. No se pudo borrar en el servidor.",
      });
    } finally {
      setDeletingClassId((current) => (current === id ? null : current));
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

      let imported: TimetableEntry[] | null = null;
      try {
        imported = await api.timetable();
      } catch {
        imported = null;
      }
      if (imported) applyEntries(imported);

      setNotice({
        tone: "success",
        text: `${result.created} clases importadas (${
          result.source === "heuristic" ? "lectura local" : "con IA"
        }). ${
          imported
            ? "El horario importado queda guardado en este dispositivo."
            : "No se pudo leer el horario importado; recarga cuando recuperes la conexión."
        }`,
      });
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setImporting(false);
    }
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <motion.div variants={pageStagger} className="mx-auto max-w-[1800px] px-4 pb-10 pt-5 sm:px-6 lg:pt-7 xl:px-8">
      <PlannerHeader
          monthPendingExamCount={monthPendingExamCount}
          monthPending={monthPending}
          goToday={goToday}
          openQuickAdd={openQuickAdd}
          notice={notice}
          setNotice={setNotice}
        />

      <EditablePanels
        section="planner"
        label="Paneles del Planificador"
        className="mt-6"
        panels={[
          {
            id: "calendar",
            label: "Calendario y plan",
            minW: 6,
            minH: 4,
            node: (
      <motion.div variants={pageItem} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:gap-6">
        <aside className="order-2 space-y-4 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:pr-1">
          <PlannerQuickEventForm
          quickFormRef={quickFormRef}
          setQuickType={setQuickType}
          quickType={quickType}
          addQuickEvent={addQuickEvent}
          quickTitleRef={quickTitleRef}
          quickTitle={quickTitle}
          setQuickTitle={setQuickTitle}
          quickDate={quickDate}
          setQuickDate={setQuickDate}
          quickTime={quickTime}
          setQuickTime={setQuickTime}
          quickCourseId={quickCourseId}
          setQuickCourseId={setQuickCourseId}
          courses={courses}
          quickNotes={quickNotes}
          setQuickNotes={setQuickNotes}
          quickBusy={quickBusy}
        />

          <PlannerOverview
          selectedDay={selectedDay}
          setViewMode={setViewMode}
          selectedExams={selectedExams}
          selectedTasks={selectedTasks}
          selectedImportantDates={selectedImportantDates}
          importantDates={importantDates}
          removeImportantDate={removeImportantDate}
          deletingImportantId={deletingImportantId}
          upcomingExams={upcomingExams}
          today={today}
          courseById={courseById}
          openExamDialog={openExamDialog}
        />
        </aside>


        {/* Calendario principal: mes, semana o día seleccionado. */}
        <section className="order-1 min-w-0 app-glass rounded-[26px] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                {viewMode === "month"
                  ? "Calendario mensual"
                  : viewMode === "week"
                    ? "Vista semanal"
                    : "Horario del día"}
              </p>
              <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.035em] text-slate-800 dark:text-white/90 sm:text-[27px]">
                {viewMode === "month"
                  ? monthLabel
                  : viewMode === "week"
                    ? `Semana del ${weekLabel}`
                    : longDate(selectedDay)}
              </h2>
              <p className="mt-1 text-[11.5px] text-slate-500 dark:text-white/40">
                {viewMode === "month"
                  ? `${monthExamCount} exámenes · ${monthPending} tareas · ${monthImportantCount} fechas importantes. Pulsa un día para seleccionarlo.`
                  : viewMode === "week"
                    ? "Lunes a viernes · toca un día para ver su detalle"
                    : `${selectedClasses.length} clase${selectedClasses.length === 1 ? "" : "s"} · ${selectedExams.length === 1 ? "1 examen" : `${selectedExams.length} exámenes`} · ${selectedTasks.length} tarea${selectedTasks.length === 1 ? "" : "s"} · ${selectedImportantDates.length} fecha${selectedImportantDates.length === 1 ? "" : "s"} · ${selectedEvents.length} evento${selectedEvents.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changePeriod(-1)} aria-label="Periodo anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changePeriod(1)} aria-label="Periodo siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex rounded-full bg-slate-900/[0.04] p-0.5 dark:bg-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  aria-pressed={viewMode === "month"}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors",
                    viewMode === "month"
                      ? "bg-slate-100/90 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80",
                  )}
                >
                  Mes
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("week")}
                  aria-pressed={viewMode === "week"}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors",
                    viewMode === "week"
                      ? "bg-slate-100/90 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80",
                  )}
                >
                  Semana
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("day")}
                  aria-pressed={viewMode === "day"}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors",
                    viewMode === "day"
                      ? "bg-slate-100/90 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80",
                  )}
                >
                  Día
                </button>
              </div>
              <span
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                  isToday
                    ? "bg-[#0066FF]/12 text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#8ab9ff]"
                    : isWeekend
                      ? "bg-slate-500/10 text-slate-500 dark:bg-white/10 dark:text-white/45"
                      : "bg-slate-100/50 text-slate-500 dark:bg-white/[0.06] dark:text-white/45",
                )}
              >
                {isToday ? "Hoy" : isWeekend ? "Fin de semana" : DAYS_LONG[selectedWeekday]}
              </span>
            </div>
          </div>

          {viewMode === "month" ? (
            <div className="animate-planner-in mt-5 pb-1">
              <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-1.5">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="pb-1 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30"
                  >
                    {day}
                  </div>
                ))}
                {monthCells.map((cell, index) => {
                  if (!cell) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="min-h-[58px] rounded-2xl border border-transparent sm:min-h-[112px] md:min-h-[128px]"
                      />
                    );
                  }
                  const dayTasks = tasksByDay.get(cell.key) ?? [];
                  const dayEvents = eventsByDay.get(cell.key) ?? [];
                  const dayExams = examsByDay.get(cell.key) ?? [];
                  const dayImportant = importantByDay.get(cell.key) ?? [];
                  const dayClasses = entries.filter(
                    (entry) =>
                      entry.day_of_week ===
                      weekdayIndex(new Date(cursor.getFullYear(), cursor.getMonth(), cell.day)),
                  );
                  const chips = [
                    ...dayExams.map((exam) => ({
                      id: `exam-${exam.id}`,
                      label: exam.title,
                      color: "#FF3B30",
                    })),
                    ...dayImportant.map((event) => ({
                      id: `important-${event.id}`,
                      label: event.title,
                      color: "#C77700",
                    })),
                    ...dayTasks.map((task) => ({
                      id: `task-${task.id}`,
                      label: task.title,
                      color: PRIORITY_COLOR[task.priority] ?? "#0066FF",
                    })),
                    ...dayEvents.map((event) => ({
                      id: `class-event-${event.id}`,
                      label: event.title,
                      color: event.is_exam ? "#FF3B30" : "#30B0C7",
                    })),
                  ];
                  const visible = chips.slice(0, 3);
                  const extra = chips.length - visible.length;
                  const selected = cell.key === selectedDay;
                  const todayCell = cell.key === todayKey;
                  const weekendCell =
                    weekdayIndex(new Date(cursor.getFullYear(), cursor.getMonth(), cell.day)) >= 5;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => selectDay(cell.key)}
                      aria-pressed={selected}
                      aria-current={todayCell ? "date" : undefined}
                      aria-label={`${longDate(cell.key)}: ${dayExams.length} exámenes, ${dayTasks.length} tareas, ${dayImportant.length} fechas importantes`}
                      title={
                        chips.length > 0
                          ? chips.map((chip) => chip.label).join(" · ")
                          : undefined
                      }
                      className={cn(
                        "group flex min-h-[58px] min-w-0 flex-col rounded-2xl border p-1.5 text-left transition-all duration-200 ease-mac sm:min-h-[112px] sm:p-2.5 md:min-h-[128px]",
                        selected
                          ? "border-[#0066FF] bg-[#0066FF]/[0.055] shadow-[0_0_0_1px_rgba(0,102,255,0.14)] dark:bg-[#0066FF]/[0.08]"
                          : todayCell
                            ? "border-[#0066FF]/30 bg-[#0066FF]/[0.035] hover:bg-[#0066FF]/[0.06] dark:border-[#0066FF]/25 dark:bg-[#0066FF]/[0.055]"
                            : weekendCell
                              ? "border-white/35 bg-slate-900/[0.018] hover:border-white/60 hover:bg-white/30 dark:border-white/[0.05] dark:bg-white/[0.012] dark:hover:border-white/10 dark:hover:bg-white/[0.03]"
                              : "border-white/50 bg-white/25 hover:border-white/70 hover:bg-white/40 dark:border-white/[0.06] dark:bg-white/[0.018] dark:hover:border-white/10 dark:hover:bg-white/[0.04]",
                      )}
                    >
                      <span className="flex items-center justify-between gap-1.5">
                        <span
                          className={cn(
                            "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums sm:h-7 sm:min-w-7 sm:text-[12px]",
                            todayCell
                              ? "bg-[#0066FF] text-white"
                              : selected
                                ? "bg-[#0066FF]/12 text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#8ab9ff]"
                                : "text-slate-600 dark:text-white/60",
                          )}
                        >
                          {cell.day}
                        </span>
                        {todayCell && (
                          <span className="hidden rounded-full bg-[#0066FF]/10 px-1.5 py-0.5 text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#0066FF] dark:bg-[#0066FF]/15 dark:text-[#8ab9ff] sm:inline">
                            Hoy
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 hidden min-h-0 flex-1 flex-col gap-1 sm:flex">
                        {visible.map((chip) => (
                          <span
                            key={chip.id}
                            className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[9.5px] font-medium leading-3"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${chip.color} 11%, transparent)`,
                              color: chip.color,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: chip.color }}
                            />
                            <span className="truncate">{chip.label}</span>
                          </span>
                        ))}
                        {extra > 0 && (
                          <span className="px-1.5 text-[8.5px] font-medium text-slate-400 dark:text-white/30">
                            +{extra} más
                          </span>
                        )}
                        {chips.length === 0 && (
                          <span className="px-1 text-[9px] text-slate-300 dark:text-white/15">—</span>
                        )}
                      </span>
                      {chips.length > 0 && (
                        <span
                          aria-hidden="true"
                          className="mt-1 flex flex-wrap items-center gap-0.5 sm:hidden"
                        >
                          {chips.slice(0, 4).map((chip) => (
                            <span
                              key={chip.id}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: chip.color }}
                            />
                          ))}
                          {chips.length > 4 && (
                            <span className="text-[7px] font-semibold text-slate-400 dark:text-white/30">
                              +{chips.length - 4}
                            </span>
                          )}
                        </span>
                      )}
                      {dayClasses.length > 0 && (
                        <span className="mt-1 hidden items-center gap-1 truncate border-t border-slate-900/[0.045] pt-1 text-[8.5px] font-medium text-slate-400 dark:border-white/[0.05] dark:text-white/30 sm:flex">
                          <Clock className="h-2.5 w-2.5 shrink-0" />
                          {dayClasses.length} clase{dayClasses.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : viewMode === "week" ? (
            <div className="animate-planner-in mt-5 overflow-x-auto pb-1">
              <div className="grid min-w-[680px] grid-cols-5 gap-2 sm:min-w-0 sm:gap-2.5 xl:gap-3">
                {weekDays.map((day) => {
                  const dayTasks = tasksByDay.get(day.key) ?? [];
                  const dayEvents = eventsByDay.get(day.key) ?? [];
                  const dayExams = examsByDay.get(day.key) ?? [];
                  const dayImportant = importantByDay.get(day.key) ?? [];
                  const hasClassExam = dayEvents.some((event) => event.is_exam);
                  const dayClasses = entries
                    .filter((entry) => entry.day_of_week === day.weekday)
                    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
                  const dayIsToday = day.key === todayKey;
                  return (
                    <button
                      key={day.key}
                      type="button"
                                            aria-current={dayIsToday ? "date" : undefined}
                      onClick={() => {
                        selectDay(day.key);
                        setViewMode("day");
                      }}
                      className={cn(
                        "group relative flex min-h-[360px] min-w-0 flex-col rounded-2xl border p-2 text-left backdrop-blur-sm transition-all duration-200 ease-mac sm:min-h-[410px] sm:p-2.5",
                        dayIsToday
                          ? "border-[#0066FF]/30 bg-[#0066FF]/[0.065] ring-1 ring-[#0066FF]/15 shadow-[0_0_38px_-18px_rgba(0,102,255,0.7)] dark:border-[#0066FF]/25 dark:bg-[#0066FF]/[0.09]"
                          : "border-white/50 bg-white/25 hover:border-white/70 hover:bg-white/40 dark:border-white/[0.06] dark:bg-white/[0.018] dark:hover:border-white/10 dark:hover:bg-white/[0.04]",
                        dayExams.length > 0 && !dayIsToday && "ring-1 ring-inset ring-[#FF3B30]/25",
                      )}
                    >
                      <span className="flex items-center justify-between gap-1.5 px-0.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-white/35">
                            {WEEKDAYS[day.weekday]}
                          </span>
                          {dayIsToday && (
                            <span className="rounded-full border border-[#0066FF]/20 bg-[#0066FF]/10 px-1.5 py-0.5 text-[7.5px] font-semibold uppercase tracking-[0.08em] text-[#0066FF] dark:border-[#0066FF]/25 dark:bg-[#0066FF]/15 dark:text-[#8ab9ff]">
                              Hoy
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums",
                            dayIsToday
                              ? "bg-[#0066FF] text-white"
                              : dayExams.length > 0
                                ? "bg-[#FF3B30]/12 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                                : "text-slate-500 dark:text-white/45",
                          )}
                        >
                          {day.date.getDate()}
                        </span>
                      </span>
                      {dayExams.length > 0 && (
                        <span className="mt-1 flex min-w-0 items-center gap-1 rounded-full bg-[#FF3B30]/10 px-1.5 py-0.5 text-[8.5px] font-semibold text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]">
                          <CalendarClock className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {dayExams.length === 1 ? dayExams[0].title : `${dayExams.length} exámenes`}
                          </span>
                        </span>
                      )}
                      {dayImportant.length > 0 && (
                        <span className="mt-1 flex min-w-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                          <Sparkles className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {dayImportant.length === 1 ? dayImportant[0].title : `${dayImportant.length} fechas`}
                          </span>
                        </span>
                      )}
                      <span className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5">
                        {dayClasses.length === 0 ? (
                          <span className="rounded-lg border border-dashed border-slate-900/[0.06] bg-white/20 px-1.5 py-2.5 text-center text-[9px] leading-3 text-slate-400 dark:border-white/[0.07] dark:bg-white/[0.018] dark:text-white/25">
                            Sin clases
                          </span>
                        ) : (
                          dayClasses.map((entry) => {
                            const course = entry.course_id
                              ? courseById.get(entry.course_id)
                              : undefined;
                            const color = courseColor(entry, course);
                            const name = subjectName(entry, course);
                            return (
                              <span
                                key={entry.id}
                                title={`${name} · ${timeLabel(entry.start_time)}–${timeLabel(entry.end_time)}`}
                                className="min-w-0 overflow-hidden rounded-xl border border-white/60 bg-white/55 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md transition-colors group-hover:bg-white/65 dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:group-hover:bg-white/[0.075]"
                                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                              >
                                <span className="block text-[9px] font-semibold tabular-nums text-slate-400 dark:text-white/35">
                                  {timeLabel(entry.start_time)}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block break-words text-[10.5px] font-semibold leading-4 text-slate-700 dark:text-white/80">
                                  {name}
                                </span>
                              </span>
                            );
                          })
                        )}
                      </span>
                      {(dayTasks.length > 0 || dayEvents.length > 0 || dayExams.length > 0 || dayImportant.length > 0) && (
                        <span className="mt-1 flex flex-wrap items-center gap-1 pt-1 text-[8.5px] font-medium text-slate-500 dark:text-white/35">
                          {dayExams.length > 0 && (
                            <span className="rounded-full bg-[#FF3B30]/10 px-1.5 py-0.5 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]">
                              {dayExams.length === 1 ? "1 examen" : `${dayExams.length} exámenes`}
                            </span>
                          )}
                          {dayImportant.length > 0 && (
                            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                              {dayImportant.length} fecha{dayImportant.length === 1 ? "" : "s"}
                            </span>
                          )}
                          {dayTasks.length > 0 && (
                            <span className="rounded-full bg-[#0066FF]/10 px-1.5 py-0.5 text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#8ab9ff]">
                              {dayTasks.length} tarea{dayTasks.length === 1 ? "" : "s"}
                            </span>
                          )}
                          {dayEvents.length > 0 && (
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5",
                                hasClassExam
                                  ? "bg-[#FF3B30]/10 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                                  : "bg-[#30B0C7]/10 text-[#1f8fa3] dark:bg-[#30B0C7]/15 dark:text-[#6ed4e5]",
                              )}
                            >
                              {dayEvents.length} evento{dayEvents.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
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
              selectedExams.length > 0 ? (
                <div className="flex items-center gap-2.5 rounded-xl bg-[#FF3B30]/[0.05] px-3 py-4 text-[11.5px] text-slate-500 dark:bg-[#FF3B30]/[0.06] dark:text-white/40">
                  <CalendarClock className="h-4 w-4 shrink-0 text-[#d92b22] dark:text-[#ff8a80]" />
                  Sin clases lectivas, pero tienes{" "}
                  {selectedExams.length === 1
                    ? "1 examen"
                    : `${selectedExams.length} exámenes`}{" "}
                  este día.
                </div>
              ) : (
                <MonthEmpty weekend={false} />
              )
            ) : (
              <div className="relative">
                <span className="absolute bottom-4 left-[65px] top-4 w-px bg-slate-200/80 dark:bg-white/10" />
                <div className="space-y-2.5">
                  {selectedClasses.map((entry) => {
                    const course = entry.course_id ? courseById.get(entry.course_id) : undefined;
                    const color = courseColor(entry, course);
                    const name = subjectName(entry, course);
                    const subtitle = subjectSubtitle(entry, course);
                    const current =
                      isToday &&
                      nowMinutes >= timeToMinutes(entry.start_time) &&
                      nowMinutes <= timeToMinutes(entry.end_time);
                    const selected = selectedClassId === entry.id;
                    const confirming = confirmDeleteClassId === entry.id;
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
                          onClick={() => {
                            setSelectedClassId(selected ? null : entry.id);
                            setConfirmDeleteClassId(null);
                          }}
                          className={cn(
                            "min-w-0 cursor-pointer rounded-xl border border-white/60 bg-white/45 p-3 backdrop-blur-md transition-colors dark:border-white/10 dark:bg-white/[0.045]",
                            current
                              ? "border-[#0066FF]/25 bg-[#0066FF]/[0.08] dark:bg-[#0066FF]/10"
                              : "hover:border-white/80 hover:bg-white/60 dark:hover:border-white/15 dark:hover:bg-white/[0.065]",
                            selected && "ring-2 ring-[#0066FF]/30",
                          )}
                          style={{
                            borderLeftColor: color,
                            borderLeftWidth: 3,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <p title={name} className="truncate text-[13px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
                                  {name}
                                </p>
                                {current && (
                                  <span className="shrink-0 rounded-full bg-[#30d158]/15 px-2 py-0.5 text-[9px] font-semibold text-[#1a9e3a] dark:text-[#5be07c]">
                                    Ahora
                                  </span>
                                )}
                              </div>
                              {subtitle && (
                                <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                                  {subtitle}
                                </p>
                              )}
                            </div>
                            <div
                              className="flex shrink-0 items-center gap-1"
                              onClick={(event) => event.stopPropagation()}
                            >
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
                                onClick={() => startEditClass(entry)}
                                aria-label={`Editar ${name}`}
                                title="Editar asignatura"
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 opacity-100 transition-colors hover:bg-[#0066FF]/10 hover:text-[#0066FF] disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:text-white/30 dark:hover:text-[#8ab9ff]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteClassId(confirming ? null : entry.id)}
                                disabled={deletingClassId === entry.id}
                                aria-label={`Quitar ${name}`}
                                title="Quitar clase"
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:text-white/30 dark:hover:text-rose-300"
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
                          {selected && (
                            <div
                              className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-900/[0.05] pt-2 dark:border-white/[0.06]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => startEditClass(entry)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-200"
                                onClick={() => setConfirmDeleteClassId(entry.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Eliminar
                              </Button>
                            </div>
                          )}
                          {confirming && (
                            <div
                              className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/70 bg-rose-50/70 px-2.5 py-2 dark:border-rose-400/20 dark:bg-rose-500/10"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <p className="text-[11px] font-medium text-rose-700 dark:text-rose-200">
                                ¿Eliminar esta asignatura del horario?
                              </p>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => void removeClass(entry.id)}
                                  disabled={deletingClassId === entry.id}
                                >
                                  Eliminar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => setConfirmDeleteClassId(null)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 border-t border-slate-900/[0.05] pt-4 dark:border-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d92b22] dark:text-[#ff8a80]">
                    Evaluaciones
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
                    Exámenes del día
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] text-slate-400 dark:text-white/30">
                    {selectedExams.length}
                  </span>
                  <Button variant="outline" size="sm" onClick={openCreateExam} className="h-8">
                    <Plus className="h-3.5 w-3.5" /> Añadir examen
                  </Button>
                </div>
              </div>
              {selectedExams.length === 0 ? (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-slate-900/[0.025] px-3 py-4 text-[11.5px] text-slate-500 dark:bg-white/[0.025] dark:text-white/35">
                  <CalendarClock className="h-4 w-4 shrink-0 text-[#FF3B30]" />
                  Sin exámenes este día. Pulsa «Añadir examen» para vincularlo a una asignatura.
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedExams.map((exam) => (
                    <ExamCard
                      key={exam.id}
                      exam={exam}
                      course={exam.course_id ? courseById.get(exam.course_id) : undefined}
                      busy={deletingExamId === exam.id}
                      onEdit={() => openExamDialog("edit", exam)}
                      onGrade={() => openExamDialog("grade", exam)}
                      onDelete={() => removeExam(exam)}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedImportantDates.length > 0 && (
              <div className="mt-5 border-t border-slate-900/[0.05] pt-4 dark:border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-600/80 dark:text-amber-300/70">
                    Fechas importantes
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-white/30">
                    {selectedImportantDates.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {selectedImportantDates.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.055] p-2.5 dark:border-amber-400/15 dark:bg-amber-400/[0.06]"
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-slate-700 dark:text-white/80">
                          {event.title}
                        </p>
                        {event.notes && (
                          <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/35">
                            {event.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedEvents.length > 0 && (
              <div className="mt-5 border-t border-slate-900/[0.05] pt-4 dark:border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                    Eventos de clase
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-white/30">
                    {selectedEvents.length}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {selectedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2.5 rounded-xl bg-slate-900/[0.025] p-2.5 dark:bg-white/[0.025]"
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
            <PlannerTasksPanel
          pendingSelected={pendingSelected}
          setShowTaskForm={setShowTaskForm}
          showTaskForm={showTaskForm}
          addTask={addTask}
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskCourseId={taskCourseId}
          setTaskCourseId={setTaskCourseId}
          courses={courses}
          taskTime={taskTime}
          setTaskTime={setTaskTime}
          taskMinutes={taskMinutes}
          setTaskMinutes={setTaskMinutes}
          selectedDay={selectedDay}
          addingTask={addingTask}
          selectedTasks={selectedTasks}
          courseById={courseById}
          busyTaskId={busyTaskId}
          confirmDeleteId={confirmDeleteId}
          completeTask={completeTask}
          setEditingTask={setEditingTask}
          setConfirmDeleteId={setConfirmDeleteId}
          removeTask={removeTask}
        />
          </div>
          )}
        </section>
      </motion.div>
            ),
          },
        ]}
      />

      {/* Gestión del horario: añadir, editar, importar y quitar clases */}
      <motion.section variants={pageItem} className="mt-5 rounded-3xl bg-white/35 p-4 backdrop-blur-xl dark:bg-white/[0.025] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowTools((value) => !value)}
            aria-expanded={showTools}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                Horario semanal
              </p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
                Gestionar clases
              </h2>
              <p className="mt-1 text-[11.5px] text-slate-500 dark:text-white/40">
                Añade una asignatura, edita una franja existente o importa una foto o un PDF de tu
                horario.
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300/40 bg-slate-100/65 text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  showTools && "rotate-180",
                )}
              />
            </span>
          </button>
          <Button
            type="button"
            size="sm"
            onClick={startAddClass}
            className="h-auto shrink-0 whitespace-normal py-2 text-left"
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir Asignatura al Horario
          </Button>
        </div>

        {showTools && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <form
              ref={classFormRef}
              onSubmit={saveClass}
              className="rounded-2xl bg-slate-900/[0.025] p-3.5 dark:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2">
                {editingClassId ? (
                  <Pencil className="h-4 w-4 text-[#0066FF]" />
                ) : (
                  <Plus className="h-4 w-4 text-[#0066FF]" />
                )}
                <p className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
                  {editingClassId ? "Editar asignatura" : "Añadir asignatura al horario"}
                </p>
              </div>
              {editingClassId && (
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-white/40">
                  Los cambios se guardan en este dispositivo y sustituyen a la franja actual.
                </p>
              )}
              <div className="mt-3 grid gap-2.5 md:grid-cols-2">
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="h-auto whitespace-normal py-2 text-left"
                  disabled={savingClass}
                >
                  {savingClass ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : editingClassId ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {editingClassId ? "Guardar cambios" : "Añadir Asignatura al Horario"}
                </Button>
                {editingClassId && (
                  <Button type="button" size="sm" variant="ghost" onClick={cancelEditClass}>
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </Button>
                )}
              </div>
            </form>

            <div className="rounded-2xl bg-slate-900/[0.02] p-3.5 dark:bg-white/[0.02]">
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
              <p className="mt-1 text-[10.5px] leading-4 text-slate-400 dark:text-white/30">
                El resultado se guarda como tu horario personalizado en este dispositivo.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.xlsx"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-[11.5px] text-slate-500 file:mr-3 file:rounded-xl file:border file:border-slate-300/45 file:bg-slate-100/60 file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-slate-700 hover:file:bg-slate-100/80 dark:text-white/40 dark:file:border-white/10 dark:file:bg-white/[0.06] dark:file:text-white/70"
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

            <div className="rounded-2xl bg-slate-900/[0.02] p-3.5 lg:col-span-2 dark:bg-white/[0.02]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                    Vista completa
                  </p>
                  <p className="mt-1 text-[11.5px] leading-5 text-slate-500 dark:text-white/40">
                    Pulsa una asignatura para seleccionarla. Usa el lápiz para editarla o la
                    papelera para quitarla del horario.
                  </p>
                </div>
                <span className="inline-flex h-7 items-center rounded-full bg-slate-200/60 px-2.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10 dark:text-white/45">
                  {entries.length} franja{entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3">
                {entries.length === 0 ? (
                  <p className="rounded-xl bg-slate-900/[0.025] px-3 py-4 text-center text-[11.5px] text-slate-500 dark:bg-white/[0.025] dark:text-white/35">
                    No hay asignaturas en el horario. Añade la primera con el formulario de arriba.
                  </p>
                ) : (
                  <WeeklyTimetable
                    entries={entries}
                    courses={courses}
                    selectedId={selectedClassId}
                    onSelect={(id) => {
                      setSelectedClassId(id);
                      setConfirmDeleteClassId(null);
                    }}
                    onEdit={startEditClass}
                    onDelete={(id) => {
                      const entry = entriesRef.current.find((item) => item.id === id);
                      const course = entry?.course_id
                        ? courseById.get(entry.course_id)
                        : undefined;
                      const label = entry ? subjectName(entry, course) : "esta asignatura";
                      if (window.confirm(`¿Eliminar ${label} del horario?`)) {
                        void removeClass(id);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {loading && (
        <motion.div variants={pageItem} className="mt-4 flex items-center justify-center gap-2 text-[11.5px] text-slate-400 dark:text-white/30">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Actualizando tu planificador…
        </motion.div>
      )}

      <ExamDialog
        open={examDialog !== null}
        mode={examDialog?.mode ?? "create"}
        exam={examDialog?.exam ?? null}
        courses={courses}
        defaultDate={selectedDay}
        onClose={() => setExamDialog(null)}
        onSaved={handleExamSaved}
        onDeleted={handleExamDeleted}
      />

      <TaskDialog
        open={Boolean(editingTask)}
        task={editingTask}
        courses={courses}
        onClose={() => setEditingTask(null)}
        onSaved={(_saved, message) => {
          setEditingTask(null);
          setNotice({ tone: "success", text: message });
          void load(true);
        }}
      />
    </motion.div>
  );
}
