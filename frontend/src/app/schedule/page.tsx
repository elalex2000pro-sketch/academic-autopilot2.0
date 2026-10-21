"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, FileUp, Loader2, Plus } from "lucide-react";

import { WeeklyTimetable } from "@/components/weekly-timetable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import type { Course, TimetableEntry } from "@/lib/types";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

const selectClass =
  "flex h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function SchedulePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(0);
  const [start, setStart] = useState("08:15");
  const [end, setEnd] = useState("09:15");
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

  function addEntry(event: React.FormEvent) {
    event.preventDefault();
    if (start >= end) {
      setNotice("La hora de inicio debe ser anterior a la de fin");
      return;
    }
    if (!courseId && !title.trim()) {
      setNotice("Indica una asignatura o una etiqueta para la clase (evita crear ranuras vacías)");
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
        setNotice("Clase añadida al horario");
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
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="label-caps">Tu semana</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Horario</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            La semana a escala real: cada asignatura conserva su color y las horas vacías se ven tal
            cual son.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="#importar">
              <FileUp className="h-4 w-4" /> Importar
            </a>
          </Button>
          <Button asChild size="sm">
            <a href="#add-class">
              <Plus className="h-4 w-4" /> Añadir clase
            </a>
          </Button>
        </div>
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
        >
          {notice}
        </p>
      )}

      <section aria-labelledby="semana">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="semana" className="font-display text-xl tracking-tight">
            Semana
          </h2>
          <span className="label-caps">
            {entries.length} {entries.length === 1 ? "clase" : "clases"}
          </span>
        </div>

        {entries.length > 0 ? (
          <WeeklyTimetable entries={entries} courses={courses} onDelete={removeEntry} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-display text-lg">Tu horario está vacío</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Añade una clase a mano o importa una foto o un PDF de tu horario.
            </p>
            <Button asChild size="sm" className="mt-4">
              <a href="#add-class">
                <Plus className="h-4 w-4" /> Añadir la primera clase
              </a>
            </Button>
          </div>
        )}
      </section>

      <section
        id="add-class"
        aria-labelledby="add-class-title"
        className="scroll-mt-20 rounded-xl border border-border bg-card p-5"
      >
        <h2 id="add-class-title" className="font-display text-xl tracking-tight">
          Añadir clase
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Se coloca en la rejilla en cuanto la guardas.
        </p>

        <form onSubmit={addEntry} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="clase-asignatura">Asignatura</Label>
            <select
              id="clase-asignatura"
              className={selectClass}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Sin asignatura</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clase-dia">Día</Label>
            <select
              id="clase-dia"
              className={selectClass}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clase-etiqueta">Etiqueta (opcional)</Label>
            <Input
              id="clase-etiqueta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Teoría / Práctica"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clase-inicio">Desde</Label>
            <Input
              id="clase-inicio"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="tabular"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clase-fin">Hasta</Label>
            <Input
              id="clase-fin"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="tabular"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clase-aula">Aula (opcional)</Label>
            <Input
              id="clase-aula"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="B3"
            />
          </div>

          <div className="flex items-end sm:col-span-3">
            <Button type="submit">
              <Plus className="h-4 w-4" /> Añadir clase
            </Button>
          </div>
        </form>

        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          Si añades «Recreo» de lunes a viernes en la misma franja, aparecerá como una banda gris
          entre clases.
        </p>
      </section>

      <section
        id="importar"
        aria-labelledby="importar-title"
        className="scroll-mt-20 rounded-xl border border-dashed border-border bg-muted/30 p-5"
      >
        <h2 id="importar-title" className="font-display text-xl tracking-tight">
          Importar desde una foto o un PDF
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Sube una foto del horario, un PDF o un Word. La IA detecta los días, las horas y las
          asignaturas; sin IA configurada se intenta con un lector de líneas.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <label htmlFor="horario-archivo" className="sr-only">
              Archivo del horario
            </label>
            <input
              ref={fileInputRef}
              id="horario-archivo"
              type="file"
              accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.xlsx"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
            />
          </div>
          <Button onClick={importSchedule} disabled={importing || !importFile}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {importing ? "Leyendo horario..." : "Importar"}
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={replace}
              onChange={(event) => setReplace(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            />
            Reemplazar el horario actual
          </label>
        </div>
      </section>
    </div>
  );
}
