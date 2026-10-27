"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, NotebookPen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Notebook } from "@/lib/types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

interface AddToNotebookButtonProps {
  bookId?: string;
  documentId?: string;
  label?: string;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "lg";
  className?: string;
}

/** Elige uno de los cuadernos del usuario y le añade un libro o archivo como fuente. */
export function AddToNotebookButton({
  bookId,
  documentId,
  label = "Añadir a cuaderno",
  variant = "secondary",
  size = "sm",
  className,
}: AddToNotebookButtonProps) {
  const [open, setOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.notebooks();
      setNotebooks(data);
      setSelectedId((current) => current || data[0]?.id || "");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function add() {
    if (!selectedId) {
      setError("Elige un cuaderno.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.addNotebookSource(
        selectedId,
        documentId ? { document_id: documentId } : { book_id: bookId },
      );
      const target = notebooks.find((notebook) => notebook.id === selectedId);
      setDone(`Añadido a ${target?.title || "tu cuaderno"}`);
      window.setTimeout(() => {
        setOpen(false);
        setDone(null);
      }, 900);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        title="Añadir como fuente de un cuaderno"
      >
        <NotebookPen className="h-4 w-4" /> {label}
      </Button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-300/40 bg-slate-100/85 p-6 shadow-[0_28px_80px_-36px_rgba(32,39,48,0.45)] backdrop-blur-3xl animate-pop"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <NotebookPen className="h-5 w-5 text-indigo-600" /> Guardar en un cuaderno
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  La fuente quedará junto a tus apuntes y podrás abrirla desde el cuaderno.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando tus cuadernos...
              </div>
            ) : notebooks.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-sm">
                <p className="font-medium text-slate-800">Todavía no tienes cuadernos.</p>
                <p className="mt-1 text-muted-foreground">
                  Crea uno y vuelve a añadir esta fuente.
                </p>
                <Link href="/notebooks" className="mt-3 inline-block">
                  <Button size="sm">
                    <NotebookPen className="h-4 w-4" /> Crear un cuaderno
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cuaderno de destino
                </label>
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300/40 bg-slate-100/70 px-3 py-2.5 text-sm text-slate-800 outline-none backdrop-blur-xl focus:border-indigo-400"
                >
                  {notebooks.map((notebook) => (
                    <option key={notebook.id} value={notebook.id}>
                      {notebook.title}
                    </option>
                  ))}
                </select>
                {error && (
                  <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                  </p>
                )}
                {done && (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    <Check className="h-4 w-4" /> {done}
                  </p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={() => void add()} disabled={saving || !selectedId}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <NotebookPen className="h-4 w-4" />
                    )}
                    Añadir fuente
                  </Button>
                </div>
                <p className="mt-3 text-right text-[11px] text-muted-foreground">
                  ¿No aparece?{" "}
                  <Link href="/notebooks" className="font-semibold text-indigo-600 hover:underline">
                    Crear otro cuaderno
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
