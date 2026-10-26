import type { Course, Grade } from "@/lib/types";

/** Clave YYYY-MM-DD del dia del examen (graded_at es una fecha, no un instante). */
export function examDateKey(exam: Grade): string | null {
  const value = exam.graded_at?.trim();
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/** Ordena por fecha y, si coinciden, por titulo. */
export function sortExams(exams: Grade[]): Grade[] {
  return [...exams].sort((a, b) => {
    const aDate = examDateKey(a) ?? "9999-12-31";
    const bDate = examDateKey(b) ?? "9999-12-31";
    return aDate.localeCompare(bDate) || a.title.localeCompare(b.title, "es");
  });
}

export function formatExamDate(exam: Grade): string {
  const key = examDateKey(exam);
  if (!key) return "Sin fecha";
  const date = new Date(`${key}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return key;
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatExamScore(value: number | null, max: number): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}/${max.toLocaleString(
    "es-ES",
    { maximumFractionDigits: 2 },
  )}`;
}

export function formatExamWeight(weight: number | null): string {
  if (weight === null || !Number.isFinite(weight)) return "Sin peso";
  return `${weight.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%`;
}

export function examCourseName(exam: Grade, courses: Map<string, Course>): string {
  if (!exam.course_id) return "Sin asignatura";
  return courses.get(exam.course_id)?.name ?? "Asignatura eliminada";
}

export function isPendingExam(exam: Grade): boolean {
  return exam.is_exam && exam.score === null;
}
