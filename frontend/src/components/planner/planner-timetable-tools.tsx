"use client";

import type * as React from "react";
import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";
import { pageItem } from "@/components/page-animated-wrapper";
import { Check, ChevronDown, FileUp, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeeklyTimetable } from "@/components/weekly-timetable";
import type { Course, TimetableEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DAYS_LONG, selectClass, subjectName } from "@/lib/planner";

type Props = {
  setShowTools: Dispatch<SetStateAction<boolean>>;
  showTools: boolean;
  startAddClass: () => void;
  classFormRef: RefObject<HTMLFormElement>;
  saveClass: (event: React.FormEvent) => Promise<void>;
  editingClassId: string | null;
  classCourseId: string;
  setClassCourseId: Dispatch<SetStateAction<string>>;
  courses: Course[];
  classDay: number;
  setClassDay: Dispatch<SetStateAction<number>>;
  classStart: string;
  setClassStart: Dispatch<SetStateAction<string>>;
  classEnd: string;
  setClassEnd: Dispatch<SetStateAction<string>>;
  classTitle: string;
  setClassTitle: Dispatch<SetStateAction<string>>;
  classLocation: string;
  setClassLocation: Dispatch<SetStateAction<string>>;
  savingClass: boolean;
  cancelEditClass: () => void;
  fileInputRef: RefObject<HTMLInputElement>;
  setImportFile: Dispatch<SetStateAction<File | null>>;
  replace: boolean;
  setReplace: Dispatch<SetStateAction<boolean>>;
  importSchedule: () => Promise<void>;
  importing: boolean;
  importFile: File | null;
  entries: TimetableEntry[];
  selectedClassId: string | null;
  setSelectedClassId: Dispatch<SetStateAction<string | null>>;
  setConfirmDeleteClassId: Dispatch<SetStateAction<string | null>>;
  startEditClass: (entry: TimetableEntry) => void;
  entriesRef: MutableRefObject<TimetableEntry[]>;
  courseById: Map<string, Course>;
  removeClass: (id: string) => Promise<void>;
};

export function PlannerTimetableTools({
  setShowTools,
  showTools,
  startAddClass,
  classFormRef,
  saveClass,
  editingClassId,
  classCourseId,
  setClassCourseId,
  courses,
  classDay,
  setClassDay,
  classStart,
  setClassStart,
  classEnd,
  setClassEnd,
  classTitle,
  setClassTitle,
  classLocation,
  setClassLocation,
  savingClass,
  cancelEditClass,
  fileInputRef,
  setImportFile,
  replace,
  setReplace,
  importSchedule,
  importing,
  importFile,
  entries,
  selectedClassId,
  setSelectedClassId,
  setConfirmDeleteClassId,
  startEditClass,
  entriesRef,
  courseById,
  removeClass,
}: Props) {
  return (
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
  );
}
