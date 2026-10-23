"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Loader2,
  Percent,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { useRealtime } from "@/components/realtime-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Course, Grade, GradeSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type Notice = { tone: "success" | "error"; text: string };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function gradeOverTen(percent: number | null): string {
  return percent === null || !Number.isFinite(percent) ? "—" : (percent / 10).toFixed(1);
}

function toneForAverage(percent: number | null): string {
  if (percent === null) return "text-slate-300 dark:text-white/15";
  if (percent >= 90) return "text-[#34C759]";
  if (percent >= 70) return "text-[#0066FF]";
  if (percent >= 50) return "text-[#FF9500]";
  return "text-[#FF3B30]";
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function ProgressRing({
  value,
  size = 70,
  stroke = 7,
  label,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="text-slate-900/[0.08] dark:text-white/10"
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          className={toneForAverage(value)}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (percent / 100) * circumference}
          style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-[15px] font-semibold tabular-nums tracking-[-0.03em]", toneForAverage(value))}>
          {value === null ? "—" : gradeOverTen(value)}
        </span>
        {label && (
          <span className="text-[8px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-white/30">
            {label}
          </span>
        )}
      </span>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/55 bg-white/30 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2 text-slate-400 dark:text-white/35">
        {icon}
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-slate-800 dark:text-white/90">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-white/35">{hint}</p>
    </div>
  );
}

export function AcademicsView() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [summary, setSummary] = useState<GradeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showCourseForm, setShowCourseForm] = useState(false);

  const [courseName, setCourseName] = useState("");
  const [courseTeacher, setCourseTeacher] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseColor, setCourseColor] = useState("#0066FF");
  const [savingCourse, setSavingCourse] = useState(false);

  const [teacherDraft, setTeacherDraft] = useState("");
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(false);

  const [gradeTitle, setGradeTitle] = useState("");
  const [gradeScore, setGradeScore] = useState("");
  const [gradeMax, setGradeMax] = useState("10");
  const [gradeWeight, setGradeWeight] = useState("");
  const [gradeDate, setGradeDate] = useState("");
  const [gradeNotes, setGradeNotes] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [deletingGradeId, setDeletingGradeId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [courseList, gradeList, gradeSummary] = await Promise.all([
        api.courses(),
        api.grades(),
        api.gradeSummary(),
      ]);
      setCourses(courseList);
      setGrades(gradeList);
      setSummary(gradeSummary);
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime((event) => {
    if (event.event === "courses" || event.event === "grades") void load(true);
  });

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  useEffect(() => {
    setTeacherDraft(selectedCourse?.teacher?.trim() ?? "");
  }, [selectedCourse?.id, selectedCourse?.teacher]);

  const summaryByCourse = useMemo(() => {
    const map = new Map<string, GradeSummary["courses"][number]>();
    for (const item of summary?.courses ?? []) {
      if (item.course_id) map.set(item.course_id, item);
    }
    return map;
  }, [summary]);

  const stats = useMemo(() => {
    const graded = grades.filter((grade) => grade.percentage !== null);
    const approved = graded.filter((grade) => (grade.percentage ?? 0) >= 50).length;
    return {
      average: summary?.overall_average_percent ?? null,
      courses: courses.length,
      evaluations: grades.length,
      approved,
    };
  }, [courses.length, grades, summary]);

  const filteredCourses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return courses;
    return courses.filter((course) =>
      [course.name, course.teacher, course.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [courses, query]);

  const selectedGrades = useMemo(() => {
    if (!selectedCourse) return [];
    return grades
      .filter((grade) => grade.course_id === selectedCourse.id)
      .sort((a, b) => {
        const aDate = a.graded_at ? new Date(a.graded_at).getTime() : 0;
        const bDate = b.graded_at ? new Date(b.graded_at).getTime() : 0;
        return bDate - aDate || b.created_at.localeCompare(a.created_at);
      });
  }, [grades, selectedCourse]);

  const selectedSummary = selectedCourse ? summaryByCourse.get(selectedCourse.id) : undefined;

  async function createCourse(event: React.FormEvent) {
    event.preventDefault();
    if (!courseName.trim() || savingCourse) return;
    setSavingCourse(true);
    setNotice(null);
    try {
      const created = await api.createCourse({
        name: courseName.trim(),
        teacher: courseTeacher.trim() || null,
        code: courseCode.trim() || undefined,
        color: courseColor,
      });
      setCourses((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCourseName("");
      setCourseTeacher("");
      setCourseCode("");
      setCourseColor("#0066FF");
      setShowCourseForm(false);
      setNotice({ tone: "success", text: "Asignatura creada." });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSavingCourse(false);
    }
  }

  async function saveTeacher() {
    if (!selectedCourse || savingTeacher) return;
    setSavingTeacher(true);
    setNotice(null);
    try {
      const updated = await api.updateCourse(selectedCourse.id, {
        teacher: teacherDraft.trim() || null,
      });
      setCourses((current) =>
        current.map((course) =>
          course.id === updated.id
            ? { ...course, ...updated, teacher: updated.teacher ?? (teacherDraft.trim() || null) }
            : course,
        ),
      );
      setNotice({ tone: "success", text: "Profesor actualizado." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSavingTeacher(false);
    }
  }

  async function removeCourse() {
    if (!selectedCourse || deletingCourse) return;
    const confirmed = window.confirm(
      `¿Eliminar "${selectedCourse.name}"? Las notas asociadas quedarán sin asignatura.`,
    );
    if (!confirmed) return;
    setDeletingCourse(true);
    setNotice(null);
    try {
      await api.deleteCourse(selectedCourse.id);
      setCourses((current) => current.filter((course) => course.id !== selectedCourse.id));
      setSelectedCourseId(null);
      setNotice({ tone: "success", text: "Asignatura eliminada." });
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setDeletingCourse(false);
    }
  }

  async function addGrade(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedCourse || !gradeTitle.trim() || savingGrade) return;
    const max = toNumber(gradeMax) ?? 10;
    const score = toNumber(gradeScore);
    if (score !== null && score > max) {
      setNotice({ tone: "error", text: "La nota no puede superar la puntuación máxima." });
      return;
    }
    setSavingGrade(true);
    setNotice(null);
    try {
      await api.createGrade({
        title: gradeTitle.trim(),
        course_id: selectedCourse.id,
        score,
        max_score: max,
        weight: toNumber(gradeWeight),
        graded_at: gradeDate || null,
        notes: gradeNotes.trim() || null,
      });
      setGradeTitle("");
      setGradeScore("");
      setGradeMax("10");
      setGradeWeight("");
      setGradeDate("");
      setGradeNotes("");
      await load(true);
      setNotice({ tone: "success", text: "Nota registrada y media recalculada." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSavingGrade(false);
    }
  }

  async function removeGrade(id: string) {
    if (deletingGradeId) return;
    const previous = grades;
    setDeletingGradeId(id);
    setGrades((current) => current.filter((grade) => grade.id !== id));
    try {
      await api.deleteGrade(id);
      await load(true);
    } catch (error) {
      setGrades(previous);
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setDeletingGradeId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-10">
      <section className="app-glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0066FF] dark:text-[#8ab9ff]">
              Académico
            </p>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.04em] text-slate-900 dark:text-white/95 sm:text-[30px]">
              Asignaturas y notas
            </h1>
            <p className="mt-1 max-w-xl text-[12px] leading-5 text-slate-500 dark:text-white/40">
              El profesorado, las evaluaciones y la media ponderada de cada asignatura en un solo lugar.
            </p>
          </div>
          <Button onClick={() => setShowCourseForm(true)} className="h-9 rounded-full px-4">
            <Plus className="h-4 w-4" /> Nueva asignatura
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            icon={<Award className="h-3.5 w-3.5" />}
            label="Media global"
            value={gradeOverTen(stats.average)}
            hint="sobre 10"
          />
          <StatCard
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Asignaturas"
            value={String(stats.courses)}
            hint="activas"
          />
          <StatCard
            icon={<Percent className="h-3.5 w-3.5" />}
            label="Evaluaciones"
            value={String(stats.evaluations)}
            hint="registradas"
          />
          <StatCard
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Aprobadas"
            value={String(stats.approved)}
            hint="notas ≥ 5"
          />
        </div>
      </section>

      {notice && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-2xl border px-4 py-3 text-[12px] backdrop-blur-2xl",
            notice.tone === "success"
              ? "border-[#34C759]/25 bg-[#34C759]/10 text-[#1a7f3a] dark:text-[#7ee69a]"
              : "border-rose-300/40 bg-rose-500/10 text-rose-700 dark:text-rose-200",
          )}
        >
          <span className="min-w-0 flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            <X className="h-3.5 w-3.5 opacity-60" />
          </button>
        </div>
      )}

      <section className="app-glass rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
              Tus asignaturas
            </p>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
              {filteredCourses.length} asignatura{filteredCourses.length === 1 ? "" : "s"}
            </h2>
          </div>
          <label className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-white/30" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar asignatura o profesor"
              className="h-9 rounded-full pl-9"
              aria-label="Buscar asignatura o profesor"
            />
          </label>
        </div>

        {loading ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-3xl border border-white/40 bg-white/20 dark:border-white/5 dark:bg-white/[0.03]"
              />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="mt-5 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/70 px-6 py-12 text-center dark:border-white/10">
            <GraduationCap className="h-8 w-8 text-slate-300 dark:text-white/25" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-white/80">
              No hay asignaturas que mostrar
            </p>
            <p className="mt-1 max-w-sm text-[11.5px] text-slate-500 dark:text-white/35">
              Crea una asignatura o limpia la búsqueda. También aparecerán las que sincronices desde Moodle.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => {
              const courseSummary = summaryByCourse.get(course.id);
              const average = courseSummary?.average_percent ?? null;
              const count = courseSummary?.graded_count ?? 0;
              const color = course.color?.trim() || "#0066FF";
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setSelectedCourseId(course.id)}
                  className="group relative overflow-hidden rounded-3xl border border-white/55 bg-white/35 p-4 text-left shadow-[0_18px_45px_-32px_rgba(15,23,42,0.7)] backdrop-blur-3xl transition-all duration-200 ease-mac hover:-translate-y-0.5 hover:border-white/80 hover:bg-white/45 dark:border-white/10 dark:bg-black/25 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                >
                  <span
                    className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl"
                    style={{ backgroundColor: color }}
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg"
                      style={{ background: `linear-gradient(145deg, ${color}, ${color}aa)` }}
                    >
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <ProgressRing value={average} size={66} label="media" />
                  </div>
                  <div className="relative mt-4">
                    <p className="line-clamp-2 text-[16px] font-semibold leading-tight tracking-[-0.02em] text-slate-900 dark:text-white/90">
                      {course.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-slate-500 dark:text-white/40">
                      <UserRound className="h-3 w-3 shrink-0" />
                      {course.teacher?.trim() || "Profesor sin asignar"}
                    </p>
                  </div>
                  <div className="relative mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                        Media
                      </p>
                      <p className="mt-0.5 text-[24px] font-semibold tracking-[-0.05em] text-slate-900 dark:text-white/90">
                        {gradeOverTen(average)}
                        <span className="ml-1 text-[11px] font-medium text-slate-400 dark:text-white/30">/10</span>
                      </p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full border border-white/50 bg-white/45 px-2 py-1 text-[9.5px] font-medium text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white/45">
                      {count} {count === 1 ? "evaluación" : "evaluaciones"}
                      <ChevronRight className="h-3 w-3 opacity-50 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-slate-900/[0.07] dark:bg-white/10">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.max(0, Math.min(100, average ?? 0))}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {showCourseForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onClick={() => !savingCourse && setShowCourseForm(false)}
        >
          <form
            onSubmit={createCourse}
            onClick={(event) => event.stopPropagation()}
            className="animate-pop w-full max-w-lg rounded-3xl border border-white/50 bg-white/80 p-5 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/85"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                  Académico
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/95">
                  Nueva asignatura
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCourseForm(false)}
                disabled={savingCourse}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-white/55">Nombre</span>
                <Input
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                  placeholder="Aplicaciones Ofimáticas"
                  required
                  maxLength={500}
                  className="mt-1"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-white/55">Profesor/a</span>
                <Input
                  value={courseTeacher}
                  onChange={(event) => setCourseTeacher(event.target.value)}
                  placeholder="Nombre del profesor"
                  maxLength={200}
                  className="mt-1"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-white/55">Código (opcional)</span>
                  <Input
                    value={courseCode}
                    onChange={(event) => setCourseCode(event.target.value)}
                    placeholder="SMR-01"
                    maxLength={120}
                    className="mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-white/55">Color</span>
                  <input
                    type="color"
                    value={courseColor}
                    onChange={(event) => setCourseColor(event.target.value)}
                    className="mt-1 h-9 w-full cursor-pointer rounded-xl border border-white/60 bg-white/40 p-1 dark:border-white/10 dark:bg-white/[0.06]"
                    aria-label="Color de la asignatura"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowCourseForm(false)} disabled={savingCourse}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!courseName.trim() || savingCourse}>
                {savingCourse ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear asignatura
              </Button>
            </div>
          </form>
        </div>
      )}

      {selectedCourse && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setSelectedCourseId(null)}
        >
          <div
            className="animate-pop my-4 w-full max-w-5xl rounded-3xl border border-white/50 bg-white/80 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/90"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/50 p-5 dark:border-white/10">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
                  style={{
                    background: `linear-gradient(145deg, ${selectedCourse.color || "#0066FF"}, ${selectedCourse.color || "#0066FF"}aa)`,
                  }}
                >
                  <BookOpen className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/95">
                    {selectedCourse.name}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-white/40">
                    <UserRound className="h-3.5 w-3.5" />
                    {selectedCourse.teacher?.trim() || "Profesor sin asignar"}
                    {selectedCourse.code ? ` · ${selectedCourse.code}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourseId(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Cerrar asignatura"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[270px_minmax(0,1fr)]">
              <aside className="space-y-3">
                <div className="flex items-center gap-4 rounded-3xl border border-white/55 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <ProgressRing value={selectedSummary?.average_percent ?? null} size={88} stroke={8} label="media" />
                  <div>
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                      Nota media
                    </p>
                    <p className="mt-1 text-[26px] font-semibold tracking-[-0.05em] text-slate-900 dark:text-white/90">
                      {gradeOverTen(selectedSummary?.average_percent ?? null)}
                      <span className="ml-1 text-[11px] font-medium text-slate-400 dark:text-white/30">/10</span>
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-white/35">
                      {selectedSummary?.graded_count ?? 0}{" "}
                      {(selectedSummary?.graded_count ?? 0) === 1 ? "evaluación" : "evaluaciones"}
                      {selectedSummary?.total_weight
                        ? ` · peso ${selectedSummary.total_weight}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/55 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                    Profesor/a
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={teacherDraft}
                      onChange={(event) => setTeacherDraft(event.target.value)}
                      placeholder="Nombre del profesor"
                      maxLength={200}
                      className="h-9"
                      aria-label="Profesor de la asignatura"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void saveTeacher()}
                      disabled={savingTeacher}
                      className="shrink-0"
                    >
                      {savingTeacher ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/55 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                    Resumen
                  </p>
                  <div className="mt-3 space-y-2 text-[11px] text-slate-600 dark:text-white/55">
                    <div className="flex items-center justify-between">
                      <span>Evaluaciones</span>
                      <span className="font-semibold text-slate-800 dark:text-white/80">{selectedGrades.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Calificadas</span>
                      <span className="font-semibold text-slate-800 dark:text-white/80">
                        {selectedGrades.filter((grade) => grade.percentage !== null).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pendientes</span>
                      <span className="font-semibold text-slate-800 dark:text-white/80">
                        {selectedGrades.filter((grade) => grade.percentage === null).length}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void removeCourse()}
                  disabled={deletingCourse}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-rose-300/40 bg-rose-500/[0.06] px-3 py-2.5 text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-500/10 disabled:opacity-50 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
                >
                  {deletingCourse ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Eliminar asignatura
                </button>
              </aside>

              <div className="min-w-0 space-y-4">
                <form
                  onSubmit={addGrade}
                  className="rounded-3xl border border-white/55 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                        Nueva evaluación
                      </p>
                      <h3 className="mt-0.5 text-[14px] font-semibold text-slate-800 dark:text-white/85">
                        Añadir nota
                      </h3>
                    </div>
                    <Badge variant="secondary" className="rounded-full text-[9.5px]">
                      Media automática
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-white/40">
                        Examen, trabajo o práctica
                      </span>
                      <Input
                        value={gradeTitle}
                        onChange={(event) => setGradeTitle(event.target.value)}
                        placeholder="Parcial 1"
                        required
                        maxLength={300}
                        className="mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-white/40">Nota</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={gradeScore}
                        onChange={(event) => setGradeScore(event.target.value)}
                        placeholder="8.5"
                        className="mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-white/40">Sobre</span>
                      <Input
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={gradeMax}
                        onChange={(event) => setGradeMax(event.target.value)}
                        className="mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-white/40">
                        Peso / porcentaje
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={gradeWeight}
                        onChange={(event) => setGradeWeight(event.target.value)}
                        placeholder="30"
                        className="mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-white/40">Fecha</span>
                      <Input
                        type="date"
                        value={gradeDate}
                        onChange={(event) => setGradeDate(event.target.value)}
                        className="mt-1"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-white/40">
                        Notas (opcional)
                      </span>
                      <Input
                        value={gradeNotes}
                        onChange={(event) => setGradeNotes(event.target.value)}
                        placeholder="Comentarios para repasar"
                        maxLength={500}
                        className="mt-1"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-400 dark:text-white/30">
                      La media se recalcula con el peso de cada evaluación.
                    </p>
                    <Button type="submit" size="sm" disabled={!gradeTitle.trim() || savingGrade}>
                      {savingGrade ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Registrar
                    </Button>
                  </div>
                </form>

                <div className="rounded-3xl border border-white/55 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                      Historial
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-white/30">{selectedGrades.length}</span>
                  </div>
                  {selectedGrades.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-white/70 px-4 py-8 text-center text-[11.5px] text-slate-500 dark:border-white/10 dark:text-white/35">
                      Todavía no hay exámenes ni trabajos. Añade el primero para empezar a calcular la media.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {selectedGrades.map((grade) => {
                        const percent = grade.percentage;
                        return (
                          <div
                            key={grade.id}
                            className="group flex items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2.5 transition-colors hover:border-white/60 hover:bg-white/30 dark:hover:border-white/10 dark:hover:bg-white/[0.04]"
                          >
                            <span
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold tabular-nums",
                                percent === null
                                  ? "bg-slate-500/10 text-slate-500 dark:bg-white/10 dark:text-white/45"
                                  : percent >= 50
                                    ? "bg-[#34C759]/12 text-[#1a9e3a] dark:bg-[#34C759]/15 dark:text-[#7ee69a]"
                                    : "bg-[#FF3B30]/10 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]",
                              )}
                            >
                              {grade.score !== null ? grade.score : "—"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-medium text-slate-800 dark:text-white/80">
                                {grade.title}
                              </p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-white/35">
                                <span>{formatDate(grade.graded_at)}</span>
                                {grade.weight !== null && <span>· peso {grade.weight}</span>}
                                <span>· sobre {grade.max_score}</span>
                                {grade.notes && <span className="truncate">· {grade.notes}</span>}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[12px] font-semibold tabular-nums text-slate-800 dark:text-white/80">
                                {percent === null ? "Pendiente" : `${percent.toFixed(1)}%`}
                              </p>
                              <p className="text-[9.5px] text-slate-400 dark:text-white/30">
                                {percent === null ? "sin nota" : `${(percent / 10).toFixed(1)}/10`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void removeGrade(grade.id)}
                              disabled={deletingGradeId === grade.id}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
                              aria-label={`Eliminar ${grade.title}`}
                            >
                              {deletingGradeId === grade.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
