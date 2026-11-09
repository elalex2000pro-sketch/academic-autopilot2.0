"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Palette, RotateCcw, X } from "lucide-react";

import {
  CHAT_BACKGROUND_PRESETS,
  DEFAULT_CHAT_BACKGROUND,
  imageBackgroundFromFile,
  type ChatBackground,
} from "@/lib/chat-background";
import { cn } from "@/lib/utils";

export function ChatBackgroundPicker({
  conversationTitle,
  current,
  onSelect,
  onClose,
}: {
  conversationTitle: string;
  current: ChatBackground;
  onSelect: (background: ChatBackground) => Promise<void> | void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(background: ChatBackground) {
    if (busy) return;
    setBusy(background.id);
    setError(null);
    try {
      await onSelect(background);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el fondo.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function chooseImage(file: File | null | undefined) {
    if (!file || busy) return;
    setBusy("upload");
    setError(null);
    try {
      const background = await imageBackgroundFromFile(file);
      await onSelect(background);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo preparar la imagen.",
      );
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Cambiar fondo del chat"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/40 bg-white/80 shadow-[0_32px_90px_-32px_rgba(15,23,42,0.55)] backdrop-blur-3xl dark:border-white/10 dark:bg-slate-950/80"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/45 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Palette className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Fondo del chat
              </h2>
              <p className="truncate text-[11px] text-slate-500 dark:text-white/45">
                {conversationTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
            Colores y patrones
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CHAT_BACKGROUND_PRESETS.map((preset) => {
              const selected = current.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void choose(preset)}
                  disabled={Boolean(busy)}
                  aria-pressed={selected}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border p-1.5 text-left transition",
                    selected
                      ? "border-primary/60 ring-2 ring-primary/25"
                      : "border-slate-300/50 hover:border-slate-400/70 dark:border-white/10 dark:hover:border-white/25",
                  )}
                >
                  <span
                    className="block h-14 w-full rounded-xl border border-black/5 bg-muted dark:border-white/10"
                    style={{
                      backgroundImage: preset.image ?? undefined,
                      backgroundSize: preset.size,
                      backgroundPosition: preset.position,
                      backgroundRepeat: preset.repeat,
                    }}
                  />
                  <span className="mt-1.5 flex items-center justify-between gap-1 px-0.5">
                    <span className="truncate text-[9.5px] font-medium text-slate-600 dark:text-white/60">
                      {preset.label}
                    </span>
                    {busy === preset.id ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : selected ? (
                      <Check className="h-3 w-3 text-primary" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
            Tu imagen
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={Boolean(busy)}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300/70 bg-white/45 px-3.5 py-3 text-left transition hover:border-primary/45 hover:bg-primary/[0.04] disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.04]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {busy === "upload" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold text-slate-700 dark:text-white/75">
                Subir una foto desde el PC
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-white/35">
                JPG, PNG o WebP · se optimiza y se guarda en este dispositivo
              </span>
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void chooseImage(event.target.files?.[0])}
          />

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/50 bg-white/45 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
            <span
              className="mt-0.5 flex h-7 w-14 shrink-0 items-center justify-center rounded-full border border-white/50 bg-primary/90 px-1 text-[8px] font-semibold text-primary-foreground shadow-sm backdrop-blur-md"
              aria-hidden
            >
              Así se verá
            </span>
            <p className="text-[10px] leading-4 text-slate-500 dark:text-white/40">
              Las burbujas usan cristal para que el texto siga siendo legible sobre
              cualquier fondo.
            </p>
          </div>

          {error ? (
            <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/45 px-5 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => void choose(DEFAULT_CHAT_BACKGROUND)}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-black/5 disabled:opacity-50 dark:text-white/45 dark:hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Quitar fondo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
