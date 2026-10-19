"use client";

import { useCallback, useEffect, useState } from "react";
import { Library, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import type { Course } from "@/lib/types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export default function SubjectsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [gradesMap, setGradesMap] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, summary] = await Promise.all([api.courses(), api.gradeSummary()]);
    setCourses(list);
    const map: Record<string, string> = {};
    summary.courses.forEach((item) => {
      if (item.course_id && item.average_percent !== null) {
        map[item.course_id] = `${item.average_percent}%`;
      }
    });
    setGradesMap(map);
  }, []);

  useEffect(() => {
    load().catch((e) => setNotice(errorMessage(e)));
  }, [load]);

  useRealtime((event) => {
    if (event.event === "courses" || event.event === "grades") {
      load().catch(() => undefined);
    }
  });

  function addCourse(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setNotice(null);
    api
      .createCourse({ name: name.trim(), code: code.trim() || undefined, color })
      .then(() => {
        setNotice("Asignatura creada");
        setName("");
        setCode("");
        return load();
      })
      .catch((e) => setNotice(errorMessage(e)));
  }

  function removeCourse(id: string) {
    setNotice(null);
    api
      .deleteCourse(id)
      .then(() => load())
      .catch((e) => setNotice(errorMessage(e)));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Asignaturas</h1>
        <p className="text-sm text-muted-foreground">
          Crea y organiza tus asignaturas. Aqui veras tambien su nota media.
        </p>
      </header>

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Library className="h-4 w-4" /> Mis asignaturas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addCourse} className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Analisis Matematico"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Codigo</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAT101" />
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-2">
                <Label>Color</Label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent"
                />
              </div>
              <Button type="submit" className="flex-1">
                <Plus className="h-4 w-4" /> Anadir
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: course.color ?? "#94a3b8" }}
                  />
                  <span className="font-medium">{course.name}</span>
                  {course.code && <span className="text-muted-foreground">· {course.code}</span>}
                </span>
                <div className="flex items-center gap-2">
                  {gradesMap[course.id] && <Badge variant="success">{gradesMap[course.id]}</Badge>}
                  <Button variant="ghost" size="icon" onClick={() => removeCourse(course.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {courses.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aun no hay asignaturas. Crea la primera arriba.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
