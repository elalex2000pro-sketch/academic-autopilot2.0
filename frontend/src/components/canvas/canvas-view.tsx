"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Clock3, Loader2, Network, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createCanvasBoard,
  deleteCanvasBoard,
  listCanvasBoards,
  loadCanvasBoard,
  type CanvasBoard,
  type CanvasBoardMeta,
} from "@/lib/canvas-store";
import { NEW_CANVAS_EVENT } from "@/lib/documents";
import { cn } from "@/lib/utils";

const CanvasWorkspace = dynamic(
  () =>
    import("@/components/canvas/canvas-workspace").then((module) => ({
      default: module.CanvasWorkspace,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100dvh-19rem)] min-h-[520px] items-center justify-center rounded-[26px] border border-slate-300/45 bg-slate-100/50 dark:border-white/10 dark:bg-white/[0.03]">
        <Loader2 className="h-5 w-5 animate-spin text-[#0066FF] dark:text-[#8ab9ff]" />
      </div>
    ),
  },
);

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/** Lista y editor de pizarras infinitas guardadas en el dispositivo. */
export function CanvasView() {
  const [boards, setBoards] = useState<CanvasBoardMeta[]>([]);
  const [active, setActive] = useState<CanvasBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBoards(await listCanvasBoards());
      setError(null);
    } catch {
      setError("No se pudieron leer las pizarras guardadas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createBoard = useCallback(async () => {
    setCreating(true);
    try {
      const board = await createCanvasBoard();
      setActive(board);
      await load();
    } catch {
      setError("No se pudo crear la pizarra. Revisa el espacio de almacenamiento.");
    } finally {
      setCreating(false);
    }
  }, [load]);

  useEffect(() => {
    const onCreate = () => void createBoard();
    window.addEventListener(NEW_CANVAS_EVENT, onCreate);
    return () => window.removeEventListener(NEW_CANVAS_EVENT, onCreate);
  }, [createBoard]);

  async function openBoard(id: string) {
    try {
      const board = await loadCanvasBoard(id);
      if (!board) {
        setError("Esa pizarra ya no existe.");
        await load();
        return;
      }
      setActive(board);
    } catch {
      setError("No se pudo abrir la pizarra.");
    }
  }

  async function removeBoard(id: string) {
    if (!window.confirm("¿Eliminar esta pizarra? No se puede deshacer.")) return;
    try {
      await deleteCanvasBoard(id);
      if (active?.id === id) setActive(null);
      await load();
    } catch {
      setError("No se pudo eliminar la pizarra.");
    }
  }

  if (active) {
    return (
      <CanvasWorkspace
        key={active.id}
        board={active}
        onBack={() => {
          setActive(null);
          void load();
        }}
        onChanged={() => void load()}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/85">
            <Network className="h-4 w-4 text-[#0066FF] dark:text-[#8ab9ff]" />
            Pizarras infinitas
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-white/40">
            Mapas mentales, fotos de placas base y esquemas de red sin límites de espacio.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void createBoard()}
          disabled={creating}
          className="h-8 rounded-xl px-3 text-[11px]"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Nueva pizarra
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-300/50 bg-rose-50/70 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#0066FF] dark:text-[#8ab9ff]" />
        </div>
      ) : boards.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-2 rounded-[26px] px-5 py-12 text-center">
          <Network className="h-6 w-6 text-[#0066FF] dark:text-[#8ab9ff]" />
          <p className="text-[12.5px] font-semibold text-slate-700 dark:text-white/80">
            Tu primera pizarra te está esperando
          </p>
          <p className="max-w-sm text-[11px] leading-5 text-slate-500 dark:text-white/40">
            Crea un lienzo libre para dibujar mapas mentales, pegar fotos de componentes o
            conectar los equipos de una red local.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => void createBoard()}
            disabled={creating}
            className="mt-1 h-8 rounded-xl px-3 text-[11px]"
          >
            <Plus className="h-3.5 w-3.5" /> Crear pizarra
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => (
            <div
              key={board.id}
              className={cn(
                "glass-card group flex flex-col rounded-[24px] p-4 transition-transform hover:-translate-y-0.5",
              )}
            >
              <button
                type="button"
                onClick={() => void openBoard(board.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]">
                  <Network className="h-4 w-4" />
                </span>
                <span className="mt-2.5 block truncate text-[13px] font-semibold text-slate-800 dark:text-white/85">
                  {board.name}
                </span>
                <span className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 dark:text-white/30">
                  <span>{board.nodeCount} elementos</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" /> {formatDate(board.updatedAt)}
                  </span>
                </span>
              </button>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/[0.05] pt-2.5 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => void openBoard(board.id)}
                  className="text-[10.5px] font-semibold text-[#0066FF] transition-opacity hover:opacity-70 dark:text-[#8ab9ff]"
                >
                  Abrir pizarra
                </button>
                <button
                  type="button"
                  onClick={() => void removeBoard(board.id)}
                  aria-label={`Eliminar ${board.name}`}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:text-white/30 dark:hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
