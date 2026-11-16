"use client";
import { useState } from "react";
import { GradeClassificationFields, type GradeClassification } from "@/components/grade-classification-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Grade, TermGradeSummary } from "@/lib/types";

function average(value: number | null | undefined) { return value == null ? "Sin notas" : `${(value / 10).toFixed(2)}/10`; }
export function GradeGroups({ grades, terms = [], onSaved, onEditExam, onDelete }: { grades: Grade[]; terms?: TermGradeSummary[]; onSaved: () => void; onEditExam: (grade: Grade) => void; onDelete: (id: string) => Promise<void> }) {
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [classification, setClassification] = useState<GradeClassification>({ trimester: null, unit: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const units = Array.from(new Set(grades.map((g) => g.unit).filter((v): v is string => !!v))).sort();
  async function save(event: React.FormEvent<HTMLFormElement>, grade: Grade) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    const number = (key: string) => String(data.get(key) ?? "").trim() ? Number(data.get(key)) : null;
    if (number("score") !== null && number("score")! > (number("max") ?? 10)) { setError("La nota no puede superar la puntuación máxima."); return; }
    setBusy(true); setError(null);
    try {
      await api.updateGrade(grade.id, { title: String(data.get("title")).trim(), score: number("score"), max_score: number("max") ?? 10, weight: number("weight"), graded_at: String(data.get("date")) || null, notes: String(data.get("notes")) || null, trimester: classification.trimester, unit: classification.unit.trim() || null });
      setEditing(null); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la nota."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Notas por trimestre y unidad" className="min-w-0 space-y-3 rounded-3xl border border-border p-4 text-foreground">
    <h3 className="text-sm font-semibold">Notas por Trimestre y Unidad</h3>
    <label className="block text-xs">Filtrar notas
      <select aria-label="Filtrar notas" value={filter} onChange={(e) => setFilter(e.target.value)} className="mt-1 block h-9 w-full rounded-xl border border-border bg-background px-2 text-foreground">
        <option value="all">Todos</option><option value="1">1.º trimestre</option><option value="2">2.º trimestre</option><option value="3">3.er trimestre</option><option value="none">Sin clasificar</option>
      </select>
    </label>
    {[1,2,3,null].filter((term) => filter === "all" || filter === String(term ?? "none")).map((term) => {
      const items = grades.filter((g) => (g.trimester ?? null) === term);
      if (!items.length) return null;
      const summary = terms.find((s) => s.trimester === term);
      return <section key={term ?? "none"} aria-label={term ? `Trimestre ${term}` : "Sin clasificar"} className="min-w-0 space-y-3">
        <h4 className="text-sm font-semibold">{term ? `${term}.º trimestre` : "Sin clasificar"} · Media: {average(summary?.average_percent)}</h4>
        {Array.from(new Set(items.map((g) => g.unit ?? null))).sort((a,b) => (a ?? "").localeCompare(b ?? "", "es")).map((unit) => <section key={unit ?? "none"} aria-label={unit ? `Unidad ${unit}` : "Sin unidad"} className="min-w-0 rounded-2xl border border-border p-3">
          <h5 className="break-words text-xs font-medium">{unit ? `Unidad ${unit}` : "Sin unidad"} · Media: {average(summary?.units.find((u) => u.unit === unit)?.average_percent)}</h5>
          {items.filter((g) => (g.unit ?? null) === unit).map((grade) => <article key={grade.id} aria-label={grade.title} className="min-w-0 space-y-2 border-t border-border py-3 first:mt-2">
            <p className="break-words text-sm font-medium">{grade.title} · {grade.score == null ? "Pendiente" : `${grade.score}/${grade.max_score}`}</p>
            {grade.is_exam && <p className="text-xs font-medium text-primary">Examen</p>}
            <p className="break-words text-xs text-muted-foreground">{grade.graded_at ?? "Sin fecha"}{grade.weight != null ? ` · peso ${grade.weight}` : ""}{grade.notes ? ` · ${grade.notes}` : ""}</p>
            <div className="flex flex-wrap gap-2"><Button aria-label={`Editar ${grade.title}`} size="sm" variant="outline" disabled={busy} onClick={() => { if (grade.is_exam) onEditExam(grade); else { setEditing(grade.id); setClassification({ trimester: grade.trimester ?? null, unit: grade.unit ?? "" }); setError(null); } }}>Editar</Button><Button aria-label={`Eliminar ${grade.title}`} size="sm" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(grade.id); } finally { setBusy(false); } }}>Eliminar</Button></div>
            {editing === grade.id && <form className="space-y-2" onSubmit={(e) => void save(e, grade)}>
              <label className="block text-xs">Título<Input name="title" defaultValue={grade.title} required maxLength={300} disabled={busy} /></label>
              <div className="grid gap-2 sm:grid-cols-3"><label className="text-xs">Puntuación<Input name="score" type="number" min={0} step="any" defaultValue={grade.score ?? ""} disabled={busy} /></label><label className="text-xs">Máximo<Input name="max" type="number" min={0.01} step="any" defaultValue={grade.max_score} required disabled={busy} /></label><label className="text-xs">Peso<Input name="weight" type="number" min={0} step="any" defaultValue={grade.weight ?? ""} disabled={busy} /></label></div>
              <label className="block text-xs">Fecha<Input name="date" type="date" defaultValue={grade.graded_at ?? ""} disabled={busy} /></label>
              <label className="block text-xs">Observaciones<Input name="notes" defaultValue={grade.notes ?? ""} disabled={busy} /></label>
              <GradeClassificationFields value={classification} onChange={setClassification} units={units} disabled={busy} />
              <Button size="sm" disabled={busy}>Guardar nota</Button><Button size="sm" type="button" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>Cancelar</Button>
            </form>}
          </article>)}
        </section>)}
      </section>;
    })}
    {!grades.some((g) => filter === "all" || filter === String(g.trimester ?? "none")) && <p className="text-xs text-muted-foreground">No hay notas en este grupo.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}
