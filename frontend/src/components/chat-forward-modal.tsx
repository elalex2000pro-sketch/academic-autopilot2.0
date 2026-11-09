"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Forward,
  Loader2,
  Search,
  Send,
  User,
  Users,
  X,
} from "lucide-react";

import { chatApi } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ForwardTarget {
  id: string;
  title: string;
  subtitle: string;
  kind: string;
}

export function ChatForwardModal({
  message,
  preview,
  targets,
  onClose,
  onForwarded,
}: {
  message: ChatMessage;
  preview: string;
  targets: ForwardTarget[];
  onClose: () => void;
  onForwarded: (title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return targets;
    return targets.filter(
      (target) =>
        target.title.toLowerCase().includes(term) ||
        target.subtitle.toLowerCase().includes(term),
    );
  }, [query, targets]);

  async function forwardTo(target: ForwardTarget) {
    if (busyId) return;
    setBusyId(target.id);
    setError(null);
    try {
      let file: File | null = null;
      if (message.attachment) {
        const blob = await chatApi.downloadAttachment(message.id);
        file = new File([blob], message.attachment.name, {
          type:
            message.attachment.content_type ||
            blob.type ||
            "application/octet-stream",
        });
      }
      await chatApi.sendMessage(target.id, message.content, file);
      onForwarded(target.title);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo reenviar el mensaje.",
      );
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Reenviar mensaje"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/40 bg-white/80 shadow-[0_32px_90px_-32px_rgba(15,23,42,0.55)] backdrop-blur-3xl dark:border-white/10 dark:bg-slate-950/80"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/45 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Forward className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Reenviar mensaje
              </h2>
              <p className="truncate text-[11px] text-slate-500 dark:text-white/45">
                Elige el chat de destino
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

        <div className="px-5 pt-4">
          <div className="flex items-start gap-2 rounded-2xl border border-white/50 bg-white/50 px-3 py-2.5 text-[11px] leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/55">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="line-clamp-2 break-words">{preview}</span>
              {message.attachment ? (
                <span className="mt-1 block text-[10px] text-slate-400 dark:text-white/30">
                  Se volverá a subir «{message.attachment.name}» al chat elegido.
                </span>
              ) : null}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/50 bg-white/50 px-3 dark:border-white/10 dark:bg-white/[0.05]">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-white/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar grupo o persona…"
              aria-label="Buscar chat de destino"
              className="min-w-0 flex-1 bg-transparent py-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/25"
            />
          </div>
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto px-3 pb-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-[11px] leading-5 text-slate-500 dark:text-white/35">
              {targets.length === 0
                ? "Todavía no tienes otros chats. Crea un grupo o escribe a alguien por su @usuario."
                : "Ningún chat coincide con la búsqueda."}
            </p>
          ) : (
            filtered.map((target) => {
              const busy = busyId === target.id;
              const group = target.kind === "group";
              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => void forwardTo(target)}
                  disabled={Boolean(busyId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition",
                    busy
                      ? "bg-primary/10"
                      : "hover:bg-white/70 dark:hover:bg-white/[0.07]",
                    busyId && !busy ? "opacity-50" : "",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {group ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-slate-800 dark:text-white/80">
                      {target.title}
                    </span>
                    <span className="block truncate text-[10.5px] text-slate-500 dark:text-white/35">
                      {target.subtitle}
                    </span>
                  </span>
                  {busy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Send className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-white/30" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {error ? (
          <p className="mx-5 mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            {error}
          </p>
        ) : null}

        <div className="border-t border-white/45 px-5 py-3 text-[10px] leading-4 text-slate-400 dark:border-white/10 dark:text-white/25">
          El mensaje se copia al chat elegido. Los archivos se envían como un
          adjunto nuevo y no se borran del chat original.
        </div>
      </div>
    </div>
  );
}
