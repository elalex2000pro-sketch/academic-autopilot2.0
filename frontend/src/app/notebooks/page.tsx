"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Notebook } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
];

type Draft = { title: string; color: string; content: string };

function toDraft(notebook: Notebook): Draft {
  return {
    title: notebook.title,
    color: notebook.color || "#6366f1",
    content: notebook.content || "",
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: "", color: "#6366f1", content: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const draftRef = useRef<Draft>(draft);
  draftRef.current = draft;

  const selected = useMemo(
    () => notebooks.find((notebook) => notebook.id === selectedId) ?? null,
    [notebooks, selectedId],
  );

  const load = useCallback(async () => {
    const data = await api.notebooks();
    setNotebooks(data);
    if (data.length > 0) {
      setSelectedId((current) => current ?? data[0].id);
    }
  }, []);

  useEffect(() => {
    load().catch((error) => setNotice(errorMessage(error)));
  }, [load]);

  // Al cambiar de cuaderno, se carga su contenido en el editor.
  useEffect(() => {
    if (selected) {
      setDraft(toDraft(selected));
      setDirty(false);
      setSavedAt(null);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(
    async (id: string, payload: Draft) => {
      setSaving(true);
      setNotice(null);
      try {
        const updated = await api.updateNotebook(id, payload);
        setNotebooks((prev) =>
          prev.map((notebook) => (notebook.id === id ? updated : notebook)),
        );
        if (JSON.stringify(draftRef.current) === JSON.stringify(payload)) {
          setDirty(false);
          setSavedAt(
            new Date().toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
      } catch (error) {
        setNotice(errorMessage(error));
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // Autoguardado con retardo para no escribir en cada pulsacion.
  useEffect(() => {
    if (!selectedId || !dirty) return;
    const timeout = setTimeout(() => {
      void save(selectedId, draft);
    }, 1200);
    return () => clearTimeout(timeout);
  }, [draft, dirty, selectedId, save]);

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function selectNotebook(id: string) {
    if (id === selectedId) return;
    if (dirty && selectedId) void save(selectedId, draft);
    setSelectedId(id);
  }

  async function createNotebook() {
    setCreating(true);
    setNotice(null);
    try {
      const created = await api.createNotebook({
        title: "Cuaderno sin titulo",
        color: COLORS[notebooks.length % COLORS.length],
      });
      setNotebooks((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function removeNotebook() {
    if (!selected) return;
    if (!window.confirm(`¿Eliminar el cuaderno "${selected.title}"?`)) return;
    try {
      await api.deleteNotebook(selected.id);
      const rest = notebooks.filter((notebook) => notebook.id !== selected.id);
      setNotebooks(rest);
      setSelectedId(rest[0]?.id ?? null);
      setDraft({ title: "", color: "#6366f1", content: "" });
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function downloadWord() {
    if (!selected) return;
    try {
      await api.downloadNotebookWord(selected.id, `${selected.title || "cuaderno"}.docx`);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function downloadExcel() {
    try {
      await api.exportNotebooksExcel();
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 animate-fade-up">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <NotebookPen className="h-6 w-6 text-indigo-600" />
            Cuadernos
          </h1>
          <p className="text-sm text-muted-foreground">
            Apuntes, resúmenes y esquemas por materia. Se guardan solos y puedes exportarlos a Word
            o Excel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadExcel} disabled={notebooks.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={createNotebook} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Nuevo cuaderno
          </Button>
        </div>
      </header>

      {notice && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {notice}
        </p>
      )}

      {notebooks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-indigo-200 bg-white/70 p-12 text-center">
          <NotebookPen className="mx-auto h-10 w-10 text-indigo-400" />
          <h2 className="mt-3 text-lg font-semibold">Todavía no tienes cuadernos</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Crea tu primer cuaderno para organizar apuntes, pegar resúmenes del Asistente IA o
            preparar un examen.
          </p>
          <Button className="mt-4" onClick={createNotebook}>
            <Plus className="h-4 w-4" /> Crear mi primer cuaderno
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-2">
            {notebooks.map((notebook) => (
              <button
                key={notebook.id}
                type="button"
                onClick={() => selectNotebook(notebook.id)}
                className={cn(
                  "w-full rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                  notebook.id === selectedId
                    ? "border-indigo-300 ring-2 ring-indigo-100"
                    : "border-slate-200/80",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: notebook.color }}
                  />
                  <span className="truncate text-sm font-semibold">{notebook.title}</span>
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {notebook.content.trim()
                    ? notebook.content.trim().slice(0, 60)
                    : "Cuaderno vacío"}
                </span>
              </button>
            ))}
          </aside>

          <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            {selected ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={draft.title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-xl font-bold outline-none transition-colors focus:border-indigo-200 focus:bg-indigo-50/40"
                    placeholder="Título del cuaderno"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Color ${color}`}
                        onClick={() => updateDraft({ color })}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                          draft.color === color ? "border-slate-800" : "border-white",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <textarea
                  value={draft.content}
                  onChange={(event) => updateDraft({ content: event.target.value })}
                  placeholder={
                    "Escribe aquí tus apuntes...\n\nConsejos:\n# Título de sección\n## Subtítulo\n- Idea o dato clave\n\nPuedes pegar resúmenes generados en IA Studio."
                  }
                  className="min-h-[430px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-6 outline-none transition-colors focus:border-indigo-300 focus:bg-white"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...
                      </>
                    ) : dirty ? (
                      "Cambios sin guardar"
                    ) : savedAt ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" /> Guardado a las {savedAt}
                      </>
                    ) : (
                      "Autoguardado activo"
                    )}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => save(selected.id, draft)}
                      disabled={saving || !dirty}
                    >
                      <Check className="h-4 w-4" /> Guardar
                    </Button>
                    <Button variant="secondary" size="sm" onClick={downloadWord}>
                      <Download className="h-4 w-4" /> Word
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={removeNotebook}
                      aria-label="Eliminar cuaderno"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecciona un cuaderno de la lista para empezar a escribir.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
