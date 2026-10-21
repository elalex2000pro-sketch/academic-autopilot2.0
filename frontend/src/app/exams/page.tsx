"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import type { Course, Grade, GradeSummary } from "@/lib/types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function ExamsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [summary, setSummary] = useState<GradeSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [weight, setWeight] = useState("");
  const [gradedAt, setGradedAt] = useState("");

  const load = useCallback(async () => {
    const [c, g, s] = await Promise.all([api.courses(), api.grades(), api.gradeSummary()]);
    setCourses(c);
    setGrades(g);
    setSummary(s);
  }, []);

  useEffect(() => {
    load().catch((e) => setNotice(errorMessage(e)));
  }, [load]);

  useRealtime((event) => {
    if (event.event === "grades" || event.event === "courses") {
      load().catch(() => undefined);
    }
  });

  const courseName = useCallback(
    (id: string | null) => (id ? courses.find((c) => c.id === id)?.name ?? null : null),
    [courses],
  );

  function addGrade(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setNotice(null);
    api
      .createGrade({
        title: title.trim(),
        course_id: courseId || null,
        score: toNumber(score),
        max_score: toNumber(maxScore) ?? 10,
        weight: toNumber(weight),
        graded_at: gradedAt || null,
      })
      .then(() => {
        setNotice("Nota registrada");
        setTitle("");
        setScore("");
        setWeight("");
        setGradedAt("");
        return load();
      })
      .catch((e) => setNotice(errorMessage(e)));
  }

  function removeGrade(id: string) {
    setNotice(null);
    api
      .deleteGrade(id)
      .then(() => load())
      .catch((e) => setNotice(errorMessage(e)));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Examenes</h1>
        <p className="text-sm text-muted-foreground">
          Registra las notas de tus examenes y trabajos. Las medias se calculan solas.
        </p>
      </header>

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Notas de examenes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-md border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Media global</p>
                <p className="text-2xl font-semibold">
                  {summary.overall_average_percent !== null
                    ? `${summary.overall_average_percent}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.graded_count} nota(s) calificada(s)
                </p>
              </div>
              {summary.courses.map((c) => (
                <div
                  key={c.course_id ?? "sin-asignatura"}
                  className="rounded-md border border-border/60 p-3"
                >
                  <p className="truncate text-xs text-muted-foreground">
                    {c.course_name ?? "Sin asignatura"}
                  </p>
                  <p className="text-2xl font-semibold">
                    {c.average_percent !== null ? `${c.average_percent}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.graded_count} nota(s)</p>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addGrade} className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <div className="space-y-2">
              <Label>Asignatura</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="" className="bg-background">
                  Sin asignatura
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-background">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Examen / trabajo</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Parcial 1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Input
                type="number"
                step="0.01"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="8.5"
              />
            </div>
            <div className="space-y-2">
              <Label>Sobre</Label>
              <Input value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Peso (opcional)</Label>
              <Input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha (opcional)</Label>
              <Input type="date" value={gradedAt} onChange={(e) => setGradedAt(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit">
                <Plus className="h-4 w-4" /> Registrar nota
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            {grades.map((grade) => (
              <div
                key={grade.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{grade.title}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {courseName(grade.course_id) ?? "Sin asignatura"}
                  </span>
                  {grade.graded_at && (
                    <span className="text-muted-foreground"> · {grade.graded_at}</span>
                  )}
                  {grade.weight !== null && (
                    <span className="text-muted-foreground"> · peso {grade.weight}</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <Badge variant={grade.percentage !== null ? "success" : "secondary"}>
                    {grade.score !== null ? `${grade.score}/${grade.max_score}` : "pendiente"}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => removeGrade(grade.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {grades.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin notas registradas. Anade tus calificaciones para ver medias automaticas.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
