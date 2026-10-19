"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  Download,
  Loader2,
  Paperclip,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import type { AssistantMessage, AssistantStatus, PendingAction } from "@/lib/types";

const QUICK_PROMPTS = [
  "¿Cuándo empiezo a estudiar?",
  "Organiza mi semana",
  "¿Qué priorizo hoy?",
  "Añade una tarea de Matemáticas para el viernes",
];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function MessageImage({ documentId }: { documentId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    api
      .fileObjectUrl(documentId)
      .then((u) => {
        if (active) {
          objectUrl = u;
          setUrl(u);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  if (!url) return <div className="mt-2 h-24 w-24 animate-pulse rounded-md bg-secondary" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Adjunto" className="mt-2 max-h-52 rounded-md border border-border" />
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [history, st] = await Promise.all([
      api.assistantMessages(100),
      api.assistantStatus(),
    ]);
    setMessages(history);
    setStatus(st);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const clearAttachment = useCallback(() => {
    setAttachment(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Solo puedes adjuntar imagenes (fotos).");
      return;
    }
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setAttachment(file);
  }

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if ((!trimmed && !attachment) || sending) return;
      setSending(true);
      setError(null);
      setPending(null);
      setInput("");
      const fileToSend = attachment;
      clearAttachment();
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          role: "user",
          content: trimmed || "(foto adjunta)",
          source: null,
          document_id: null,
          created_at: new Date().toISOString(),
        },
      ]);
      try {
        let documentId: string | null = null;
        if (fileToSend) {
          const uploaded = await api.uploadFile(fileToSend);
          documentId = uploaded.id;
        }
        const result = await api.chat(trimmed, documentId);
        if (result.pending_action) setPending(result.pending_action);
        setMessages(await api.assistantMessages(100));
      } catch (e) {
        setError(errorMessage(e));
        try {
          setMessages(await api.assistantMessages(100));
        } catch {
          /* ignore */
        }
      } finally {
        setSending(false);
      }
    },
    [attachment, clearAttachment, sending],
  );

  async function confirm(approve: boolean) {
    if (!pending) return;
    setConfirming(true);
    setError(null);
    try {
      await api.confirmAction(pending.tool, pending.args, approve);
      setPending(null);
      setMessages(await api.assistantMessages(100));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfirming(false);
    }
  }

  async function clearHistory() {
    try {
      await api.clearAssistant();
      setMessages([]);
      setPending(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // --- Transportar el chat: exportar / importar ---
  async function exportChat() {
    try {
      const history = await api.assistantExport();
      const payload = {
        app: "Academic Autopilot",
        kind: "assistant-chat",
        version: 1,
        exported_at: new Date().toISOString(),
        messages: history.map((m) => ({
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `chat-asistente-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function importChat(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const rawList = Array.isArray(parsed)
        ? parsed
        : ((parsed as { messages?: unknown }).messages ?? []);
      if (!Array.isArray(rawList) || rawList.length === 0) {
        setError("El archivo no contiene mensajes compatibles.");
        return;
      }
      const messages = rawList
        .map((item) => {
          const raw = item as { role?: unknown; content?: unknown; created_at?: unknown };
          const role =
            raw.role === "assistant" ? "assistant" : raw.role === "user" ? "user" : null;
          if (!role || typeof raw.content !== "string" || !raw.content.trim()) return null;
          return {
            role,
            content: raw.content.slice(0, 8000),
            created_at: typeof raw.created_at === "string" ? raw.created_at : null,
          };
        })
        .filter(
          (m): m is { role: string; content: string; created_at: string | null } => m !== null,
        )
        .slice(0, 2000);
      if (messages.length === 0) {
        setError("El archivo no contiene mensajes compatibles.");
        return;
      }
      await api.assistantImport(messages);
      setMessages(await api.assistantMessages(100));
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError("El archivo no es un chat valido (JSON).");
      } else {
        setError(errorMessage(e));
      }
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" /> Asistente IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu tutora: te dice cuándo estudiar y además puede crear y editar tus tareas,
            asignaturas, notas y horario. Adjunta una foto de la pizarra o de un examen y la
            analiza.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={importChat}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            title="Importar una conversación exportada"
          >
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportChat}
            disabled={messages.length === 0}
            title="Descargar la conversación como archivo"
          >
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button variant="ghost" size="sm" onClick={clearHistory} disabled={messages.length === 0}>
            <Trash2 className="h-4 w-4" /> Limpiar
          </Button>
        </div>
      </header>

      {status && !status.configured && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          La IA no está configurada. Ve a <strong>Ajustes</strong> y elige un motor (Gemini,
          ChatGPT, Claude, OpenRouter...). Mientras tanto responderé con el motor de reglas.
        </div>
      )}

      {status?.configured && status.tools_enabled && (
        <p className="text-xs text-muted-foreground">
          Control activo: puedo crear/editar tareas, notas, horario y asignaturas. Los borrados
          siempre te pediran confirmacion.
        </p>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <Card className="flex-1">
        <CardContent className="flex h-[62vh] flex-col gap-4 p-4">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {loading && <p className="text-sm text-muted-foreground">Cargando conversacion...</p>}

            {!loading && messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Pregunta lo que quieras o pide cambios en tu organizacion. Por ejemplo:
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => send(prompt)}
                      className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isUser ? "bg-primary/10" : "bg-secondary/50"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {isUser && message.document_id && (
                      <MessageImage documentId={message.document_id} />
                    )}
                    {!isUser && message.source && (
                      <div className="mt-2">
                        <Badge variant={message.source === "ai" ? "success" : "warning"}>
                          {message.source === "ai"
                            ? `IA · ${status?.model ?? ""}`
                            : "Reglas locales"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {pending && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" /> Confirmar accion
                </p>
                <p className="mt-1 text-muted-foreground">
                  La IA quiere ejecutar <code className="rounded bg-secondary px-1">{pending.tool}</code>{" "}
                  con <code className="rounded bg-secondary px-1">{JSON.stringify(pending.args)}</code>.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => confirm(true)} disabled={confirming}>
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Sí, adelante
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => confirm(false)} disabled={confirming}>
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </div>
            )}

            {sending && (
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {previewUrl && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Vista previa" className="h-14 w-14 rounded object-cover" />
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {attachment?.name}
              </span>
              <Button variant="ghost" size="icon" onClick={clearAttachment} aria-label="Quitar imagen">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-end gap-2 border-t pt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="Adjuntar foto"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <textarea
              className="min-h-[44px] flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="Escribe tu pregunta... (Enter para enviar, Shift+Enter para salto de linea)"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
            />
            <Button onClick={() => send(input)} disabled={sending || (!input.trim() && !attachment)}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
