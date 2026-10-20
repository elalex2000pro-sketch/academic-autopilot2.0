"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, FileUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import type { Course, TimetableEntry } from "@/lib/types";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export default function SchedulePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(0);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("10:00");
  const [location, setLocation] = useState("");

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([api.courses(), api.timetable()]);
    setCourses(c);
    setEntries(t);
  }, []);

  useEffect(() => {
    load().catch((e) => setNotice(errorMessage(e)));
  }, [load]);

  useRealtime((event) => {
    if (event.event === "timetable" || event.event === "courses") {
      load().catch(() => undefined);
    }
  });

  const courseName = useCallback(
    (id: string | null) => (id ? courses.find((c) => c.id === id)?.name ?? null : null),
    [courses],
  );

  function addEntry(event: React.FormEvent) {
    event.preventDefault();
    if (start >= end) {
      setNotice("La hora de inicio debe ser anterior a la de fin");
      return;
    }
    setNotice(null);
    api
      .createTimetableEntry({
        day_of_week: day,
        start_time: start,
        end_time: end,
        title: title.trim() || null,
        course_id: courseId || null,
        location: location.trim() || null,
      })
      .then(() => {
        setNotice("Clase anadida al horario");
        setTitle("");
        setLocation("");
        return load();
      })
      .catch((e) => setNotice(errorMessage(e)));
  }

  function removeEntry(id: string) {
    setNotice(null);
    api
      .deleteTimetableEntry(id)
      .then(() => load())
      .catch((e) => setNotice(errorMessage(e)));
  }

  async function importSchedule() {
    if (!importFile) {
      setNotice("Selecciona una foto, PDF o documento con tu horario.");
      return;
    }
    setImporting(true);
    setNotice(null);
    try {
      const document = await api.uploadFile(importFile);
      const result = await api.importTimetable(document.id, replace);
      setNotice(
        `${result.created} clases importadas (${result.source === "heuristic" ? "lectura local" : "con IA"}). Revisa que las horas sean correctas.`,
      );
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Horario</h1>
        <p className="text-sm text-muted-foreground">
          Define tus clases semanales recurrentes por dia y franja horaria.
        </p>
      </header>

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-indigo-600" /> Importar horario desde foto o PDF
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sube una foto del horario, un PDF o un Word. La IA detecta los días, las horas y las
            asignaturas; si no tienes IA configurada, se intenta con un lector de líneas.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.xlsx"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              className="block w-full max-w-sm text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-200"
            />
            <Button onClick={importSchedule} disabled={importing || !importFile}>
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {importing ? "Leyendo horario..." : "Importar"}
            </Button>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={replace}
                onChange={(event) => setReplace(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Reemplazar el horario actual
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> Horario semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addEntry} className="grid gap-3 sm:grid-cols-3 sm:items-end">
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
              <Label>Dia</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i} className="bg-background">
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Etiqueta (opcional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Teoria / Practica"
              />
            </div>
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Aula (opcional)</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="B3"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit">
                <Plus className="h-4 w-4" /> Anadir clase
              </Button>
            </div>
          </form>

          <div className="space-y-4">
            {DAYS.map((dayLabel, dayIndex) => {
              const dayEntries = entries.filter((e) => e.day_of_week === dayIndex);
              if (dayEntries.length === 0) return null;
              return (
                <div key={dayLabel} className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {dayLabel}
                  </p>
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="text-muted-foreground">
                          {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                        </span>{" "}
                        <span className="font-medium">
                          {courseName(entry.course_id) ?? entry.title ?? "Clase"}
                        </span>
                        {entry.location && (
                          <span className="text-muted-foreground"> · {entry.location}</span>
                        )}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => removeEntry(entry.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}
            {entries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aun no hay clases. Anade la primera arriba.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
