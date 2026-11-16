"use client";
import { useId } from "react";
import { Input } from "@/components/ui/input";

export interface GradeClassification { trimester: number | null; unit: string }
export function GradeClassificationFields({ value, onChange, units, disabled = false }: { value: GradeClassification; onChange: (value: GradeClassification) => void; units: string[]; disabled?: boolean }) {
  const id = useId();
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2">
    <label className="min-w-0 space-y-1 text-xs text-foreground">Trimestre
      <select aria-label="Trimestre" value={value.trimester ?? ""} disabled={disabled} onChange={(e) => onChange({ ...value, trimester: e.target.value ? Number(e.target.value) : null })} className="block h-9 w-full rounded-xl border border-border bg-background px-2 text-foreground">
        <option value="">Sin clasificar</option>{[1,2,3].map((n) => <option key={n} value={n}>{n}.º trimestre</option>)}
      </select>
    </label>
    <label className="min-w-0 space-y-1 text-xs text-foreground">Unidad
      <Input aria-label="Unidad" list={id} value={value.unit} maxLength={80} disabled={disabled} placeholder="Número o nombre (opcional)" onChange={(e) => onChange({ ...value, unit: e.target.value })} />
      <datalist id={id}>{units.map((unit) => <option key={unit} value={unit} />)}</datalist>
    </label>
  </div>;
}
