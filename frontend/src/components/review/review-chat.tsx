import { Fragment, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  NotebookChatMessage,
  NotebookCitation,
  NotebookToolAction,
} from "@/lib/types";

const suggestions = [
  "¿Cuáles son las ideas principales de estas fuentes?",
  "¿Qué conceptos debería repasar primero?",
];

function ActionCard({
  action,
  onView,
  busy,
}: {
  action: NotebookToolAction;
  onView: () => void;
  busy: boolean;
}) {
  const count = action.count ?? 0;
  const label =
    action.tool === "create_flashcards"
      ? `${count} ${count === 1 ? "tarjeta" : "tarjetas"}`
      : action.tool === "create_quiz"
        ? "un cuestionario"
        : "un resumen";
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
      <span>
        {action.reused ? "Disponible" : "Creó"} {label}
      </span>
      <Button size="sm" variant="ghost" onClick={onView} disabled={busy}>
        Ver<span className="sr-only"> {label}</span>
      </Button>
    </div>
  );
}

export function ReviewChat({
  messages,
  disabled,
  stage,
  onSend,
  onCitation,
  onAction,
  onSave,
  saving,
  saved,
}: {
  messages: NotebookChatMessage[];
  disabled: boolean;
  stage: string;
  onSend: (question: string) => void;
  onCitation: (citation: NotebookCitation) => void;
  onAction: (action: NotebookToolAction) => void;
  onSave: (id: string) => void;
  saving: string | null;
  saved: string[];
}) {
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, stage]);

  return (
    <section className="flex min-h-[28rem] flex-col gap-4" aria-label="Chat">
      <h2 className="font-semibold">Chat</h2>
      <div
        ref={log}
        role="log"
        aria-label="Conversación del cuaderno"
        className="max-h-[53vh] min-h-28 flex-1 space-y-3 overflow-y-auto"
      >
        {messages.length === 0 && !stage && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Pregunta por las fuentes seleccionadas o pide material para
              estudiar.
            </p>
            {suggestions.map((question) => (
              <Button
                key={question}
                size="sm"
                variant="outline"
                className="h-auto whitespace-normal text-left"
                disabled={disabled}
                onClick={() => onSend(question)}
              >
                {question}
              </Button>
            ))}
          </div>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-xl p-3 text-sm ${message.role === "user" ? "ml-6 bg-primary/10" : "bg-background/55"}`}
          >
            <p className="mb-1 font-semibold">
              {message.role === "user" ? "Tú" : "IA del cuaderno"}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {message.content.split(/(\[\d+\])/).map((part, index) => {
                const citation = message.citations.find(
                  (item) => part === `[${item.number}]`,
                );
                return citation ? (
                  <button
                    key={index}
                    type="button"
                    className="mx-0.5 rounded-full bg-primary/10 px-2 text-primary hover:bg-primary/20"
                    onClick={() => onCitation(citation)}
                    aria-label={`Cita ${citation.number}: ${citation.title}`}
                  >
                    {part}
                  </button>
                ) : (
                  <Fragment key={index}>{part}</Fragment>
                );
              })}
            </p>
            {message.citations
              .filter(
                (citation) => !message.content.includes(`[${citation.number}]`),
              )
              .map((citation) => (
                <button
                  key={citation.number}
                  type="button"
                  className="mr-1 mt-2 rounded-full bg-primary/10 px-2 text-primary hover:bg-primary/20"
                  onClick={() => onCitation(citation)}
                  aria-label={`Cita ${citation.number}: ${citation.title}`}
                >
                  [{citation.number}]
                </button>
              ))}
            {message.actions
              .filter((action) => action.ok)
              .map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  busy={Boolean(stage)}
                  onView={() => onAction(action)}
                />
              ))}
            {message.role === "assistant" && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                disabled={Boolean(stage) || saving !== null || saved.includes(message.id)}
                onClick={() => onSave(message.id)}
              >
                {saved.includes(message.id)
                  ? "Nota guardada"
                  : saving === message.id
                    ? "Guardando…"
                    : "Guardar como nota"}
              </Button>
            )}
          </article>
        ))}
        {stage && (
          <p
            role="status"
            className="rounded-xl bg-background/50 p-3 text-sm text-muted-foreground"
          >
            {stage}
          </p>
        )}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || !draft.trim()) return;
          onSend(draft.trim());
          setDraft("");
        }}
      >
        <textarea
          aria-label="Pregunta al cuaderno"
          placeholder="Pregunta al cuaderno…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={12000}
          rows={2}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background/50 p-2.5 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Enviar pregunta"
          disabled={disabled || !draft.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}
