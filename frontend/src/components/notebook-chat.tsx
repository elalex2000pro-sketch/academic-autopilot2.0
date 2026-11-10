"use client";

import { useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type {
  Notebook,
  NotebookChatMessage,
  NotebookSource,
} from "@/lib/types";

export function NotebookChat({
  notebookId,
  disabled,
  onNotebookChanged,
}: {
  notebookId: string;
  disabled?: boolean;
  onNotebookChanged: (notebook: Notebook) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sources, setSources] = useState<NotebookSource[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<NotebookChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function open() {
    dialog.current?.showModal();
    setLoading(true);
    setNotice("");
    try {
      const [nextSources, history] = await Promise.all([
        api.notebookSources(notebookId),
        api.notebookMessages(notebookId),
      ]);
      setSources(nextSources);
      setSelected(nextSources.map((source) => source.id));
      setMessages(history);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el cuaderno.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = question.trim();
    if (!text || !selected.length || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const turn = await api.notebookChat(notebookId, {
        question: text,
        source_ids: selected,
      });
      const createdAt = new Date().toISOString();
      setMessages((previous) => [
        ...previous,
        {
          id: `${turn.id}-question`,
          role: "user",
          content: text,
          citations: [],
          actions: [],
          created_at: createdAt,
        },
        {
          id: turn.id,
          role: "assistant",
          content: turn.answer,
          citations: turn.citations,
          actions: turn.actions,
          created_at: createdAt,
        },
      ]);
      setQuestion("");
      setNotice(turn.warnings.join(" · "));
      if (
        turn.actions.some(
          (action) =>
            action.ok && !action.reused && action.tool === "create_summary",
        )
      ) {
        onNotebookChanged(await api.notebook(notebookId));
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo completar la consulta.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => void open()}
      >
        <Sparkles className="h-4 w-4" /> IA del cuaderno
      </Button>
      <dialog
        ref={dialog}
        aria-label="IA del cuaderno"
        onClick={(event) => event.stopPropagation()}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        className="app-glass fixed inset-0 m-auto w-[min(94vw,44rem)] max-h-[88dvh] overflow-y-auto rounded-3xl border border-border bg-card/95 p-4 text-foreground shadow-xl backdrop:bg-black/40 sm:p-6"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">IA del cuaderno</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar chat"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <details className="mb-4 rounded-xl border border-border p-3" open>
          <summary className="cursor-pointer text-sm font-medium">
            Fuentes seleccionadas ({selected.length})
          </summary>
          {loading ? (
            <p className="mt-2 text-sm">Cargando fuentes…</p>
          ) : sources.length ? (
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {sources.map((source) => (
                <label
                  key={source.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.includes(source.id)}
                    disabled={busy}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, source.id]
                          : current.filter((id) => id !== source.id),
                      )
                    }
                  />
                  <span>{source.title}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Añade una fuente al cuaderno para consultar su contenido.
            </p>
          )}
        </details>
        <div
          className="max-h-[42dvh] space-y-3 overflow-y-auto"
          role="log"
          aria-label="Conversación"
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className="rounded-xl border border-border bg-background/40 p-3 text-sm"
            >
              <p className="mb-1 font-medium">
                {message.role === "user" ? "Tú" : "IA del cuaderno"}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {message.content}
              </p>
              {message.citations.map((citation) => (
                <details
                  key={citation.number}
                  className="mt-2 rounded-lg border border-border p-2"
                >
                  <summary className="cursor-pointer font-medium">
                    [{citation.number}] {citation.title}
                    {citation.page
                      ? ` · pág. ${citation.page}${citation.page_end && citation.page_end !== citation.page ? `–${citation.page_end}` : ""}`
                      : ""}
                  </summary>
                  <blockquote className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
                    {citation.fragment}
                  </blockquote>
                </details>
              ))}
            </article>
          ))}
        </div>
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label
            htmlFor={`notebook-question-${notebookId}`}
            className="text-sm font-medium"
          >
            Pregunta a tus fuentes
          </label>
          <textarea
            id={`notebook-question-${notebookId}`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={12000}
            placeholder="Explica un concepto o crea tarjetas, un quiz o un resumen…"
            className="block min-h-20 w-full resize-y rounded-xl border border-border bg-background/50 p-3 text-sm"
          />
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={busy || loading || !question.trim() || !selected.length}
          >
            {busy ? "Consultando…" : "Enviar"}
          </Button>
        </form>
      </dialog>
    </>
  );
}
