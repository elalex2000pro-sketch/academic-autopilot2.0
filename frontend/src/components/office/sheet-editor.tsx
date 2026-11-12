"use client";

// Hoja de calculo de Academic-Office: rejilla editable con barra de formulas,
// referencias A1 y resultado calculado en vivo.
import { useMemo, useState } from "react";
import { Equal, ListPlus, Sigma } from "lucide-react";

import {
  SHEET_COLS,
  SHEET_ROWS,
  cellKey,
  columnLabel,
  evaluateSheet,
  sheetStats,
  type CellMap,
} from "@/lib/office-sheet";

interface SheetEditorProps {
  cells: CellMap;
  onChange: (cells: CellMap) => void;
}

export function SheetEditor({ cells, onChange }: SheetEditorProps) {
  const [active, setActive] = useState("A1");
  const [focused, setFocused] = useState<string | null>(null);
  const computed = useMemo(() => evaluateSheet(cells), [cells]);
  const stats = useMemo(() => sheetStats(computed), [computed]);

  function update(reference: string, value: string) {
    const next = { ...cells };
    if (value === "") delete next[reference];
    else next[reference] = value;
    onChange(next);
  }

  function focusCell(reference: string) {
    setActive(reference);
    const input = document.getElementById(`office-cell-${reference}`);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }

  function move(reference: string, rowDelta: number, colDelta: number) {
    const match = /^([A-Z]+)(\d+)$/.exec(reference);
    if (!match) return;
    let col = 0;
    for (const character of match[1]) {
      col = col * 26 + (character.charCodeAt(0) - 64);
    }
    const row = Number(match[2]);
    const nextRow = Math.min(Math.max(row + rowDelta, 1), SHEET_ROWS);
    const nextCol = Math.min(Math.max(col + colDelta, 1), SHEET_COLS);
    focusCell(cellKey(nextRow - 1, nextCol - 1));
  }

  function applyFormula(snippet: string) {
    update(active, snippet);
    focusCell(active);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Barra de formulas */}
      <div className="flex items-center gap-2 border-b border-white/40 px-3 py-2 dark:border-white/10">
        <span className="flex h-8 min-w-14 items-center justify-center rounded-lg border border-border bg-white/60 px-2 text-xs font-semibold tabular-nums dark:bg-white/5">
          {active}
        </span>
        <Equal className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={cells[active] ?? ""}
          onChange={(event) => update(active, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              move(active, 1, 0);
            }
          }}
          placeholder="Valor o formula, por ejemplo =SUM(A1:A10)"
          aria-label={`Contenido de ${active}`}
          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-white/70 px-3 font-mono text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 dark:bg-slate-950/50"
        />
        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => applyFormula(`=SUM(A1:A${Math.min(SHEET_ROWS, 10)})`)}
            title="Insertar SUMA"
            className="flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-[11px] hover:bg-white/60 dark:hover:bg-white/10"
          >
            <Sigma className="h-3.5 w-3.5" /> Suma
          </button>
          <button
            type="button"
            onClick={() => applyFormula("=AVERAGE(A1:A10)")}
            title="Insertar PROMEDIO"
            className="flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-[11px] hover:bg-white/60 dark:hover:bg-white/10"
          >
            <ListPlus className="h-3.5 w-3.5" /> Media
          </button>
        </div>
      </div>

      {/* Rejilla */}
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <table className="w-max border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-7 w-10 border border-border bg-muted/90 backdrop-blur" />
              {Array.from({ length: SHEET_COLS }, (_, col) => (
                <th
                  key={col}
                  className="sticky top-0 z-10 h-7 min-w-[92px] border border-border bg-muted/90 px-2 text-center font-semibold text-muted-foreground backdrop-blur"
                >
                  {columnLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SHEET_ROWS }, (_, row) => (
              <tr key={row}>
                <th className="sticky left-0 z-10 h-7 w-10 border border-border bg-muted/90 text-center font-semibold text-muted-foreground backdrop-blur">
                  {row + 1}
                </th>
                {Array.from({ length: SHEET_COLS }, (_, col) => {
                  const reference = cellKey(row, col);
                  const cell = computed[reference];
                  const isFocused = focused === reference;
                  const display = isFocused
                    ? (cells[reference] ?? "")
                    : (cell?.display ?? "");
                  const numeric = cell?.numeric !== null && cell?.numeric !== undefined;
                  return (
                    <td key={col} className="p-0">
                      <input
                        id={`office-cell-${reference}`}
                        value={display}
                        onChange={(event) => update(reference, event.target.value)}
                        onFocus={() => {
                          setActive(reference);
                          setFocused(reference);
                        }}
                        onBlur={() => setFocused(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            move(reference, 1, 0);
                          } else if (event.key === "Tab") {
                            event.preventDefault();
                            move(reference, 0, event.shiftKey ? -1 : 1);
                          } else if (
                            event.key === "ArrowDown" &&
                            event.altKey
                          ) {
                            event.preventDefault();
                            move(reference, 1, 0);
                          } else if (
                            event.key === "ArrowUp" &&
                            event.altKey
                          ) {
                            event.preventDefault();
                            move(reference, -1, 0);
                          }
                        }}
                        aria-label={`Celda ${reference}`}
                        className={`h-7 w-full min-w-[92px] border border-border/70 px-2 outline-none transition ${
                          reference === active
                            ? "bg-primary/5 ring-1 ring-inset ring-primary/40"
                            : "bg-white/70 focus:bg-white dark:bg-slate-950/40"
                        } ${numeric ? "text-right tabular-nums" : "text-left"} ${
                          cell?.error ? "text-destructive" : ""
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Estadisticas de lo introducido */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/40 px-4 py-2 text-[11px] text-muted-foreground dark:border-white/10">
        <span>Suma: {stats.sum.toLocaleString("es-ES")}</span>
        <span>
          Media:{" "}
          {stats.average === null
            ? "—"
            : stats.average.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
        </span>
        <span>Con datos: {stats.count}</span>
        <span>Numericas: {stats.numericCells}</span>
        {stats.errorCells > 0 ? (
          <span className="text-destructive">Errores: {stats.errorCells}</span>
        ) : null}
        <span className="ml-auto hidden sm:inline">
          Enter baja · Tab derecha · Alt+flechas mueve
        </span>
      </div>
    </div>
  );
}
