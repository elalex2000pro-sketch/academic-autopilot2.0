"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Check,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { AssistantMessage, AssistantStatus, PendingAction } from "@/lib/types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export function AssistantFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const loadedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [history, st] = await Promise.all([
      api.assistantMessages(60),
      api.assistantStatus(),
    ]);
    setMessages(history);
    setStatus(st);
  }, []);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    load().catch((e) => setError(errorMessage(e)));
  }, [open, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setSending(true);
      setError(null);
      setPending(null);
      setInput("");
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          role: "user",
          content: trimmed,
          source: null,
          document_id: null,
          created_at: new Date().toISOString(),
        },
      ]);
      try {
        const result = await api.chat(trimmed);
        if (result.pending_action) setPending(result.pending_action);
        setMessages(await api.assistantMessages(60));
      } catch (e) {
        setError(errorMessage(e));
        try {
          setMessages(await api.assistantMessages(60));
        } catch {
          /* ignore */
        }
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

  async function confirm(approve: boolean) {
    if (!pending) return;
    setConfirming(true);
    setError(null);
    try {
      await api.confirmAction(pending.tool, pending.args, approve);
      setPending(null);
      setMessages(await api.assistantMessages(60));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfirming(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  }

  return (
    <>
      {/* Boton flotante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir asistente IA"
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/40 text-slate-700 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-3xl transition-colors hover:bg-white/55 hover:text-slate-900 dark:border-white/[0.08] dark:bg-black/30 dark:text-white/75 dark:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] dark:hover:bg-black/45 dark:hover:text-white"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[70vh] max-h-[560px] w-[min(400px,calc(100vw-2.5rem))] flex-col rounded-xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Asistente IA
            </span>
            <Link href="/assistant" className="text-xs text-muted-foreground hover:text-foreground">
              Abrir completo
            </Link>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && !sending && (
              <p className="text-sm text-muted-foreground">
                Preguntame que priorizar hoy o pide cambiar tus tareas.
              </p>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                {error}
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                    {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                      isUser ? "bg-primary/10" : "bg-secondary/50"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}

            {pending && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" /> Confirmar accion
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Quiere ejecutar <code className="rounded bg-secondary px-1">{pending.tool}</code>.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => confirm(true)} disabled={confirming}>
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Si, adelante
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => confirm(false)} disabled={confirming}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Pensando...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t p-2">
            {status && !status.configured && (
              <p className="px-1 pb-2 text-xs text-amber-500">
                La IA no esta configurada. Elige motor en Ajustes.
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                className="min-h-[40px] flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="Escribe tu pregunta..."
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={() => send(input)}
                disabled={sending || !input.trim()}
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
