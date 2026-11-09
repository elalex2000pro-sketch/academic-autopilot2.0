"use client";

import { memo, useState } from "react";
import { Check, FileText, Wand2, X } from "lucide-react";

import { attachmentCaption } from "@/lib/studio";
import type { AssistantMessage, ChatAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

function timeLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function sourceLabel(source: string | null): string | null {
  if (source === "ai") return "IA";
  if (source === "heuristic" || source === "local") return "modo local";
  if (source === "studio") return "generador";
  if (source === "imported") return "importado";
  return null;
}

function MessageBubbleComponent({ message }: { message: AssistantMessage }) {
  const isUser = message.role === "user";
  const label = sourceLabel(message.source);
  const attachments = message.attachments ?? [];
  const [preview, setPreview] = useState<ChatAttachment | null>(null);
  return (
    <>
      <div
        className={cn(
          "flex w-full animate-fade-up gap-2.5",
          isUser ? "justify-end" : "justify-start",
        )}
      >
        {!isUser && (
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300/40 bg-slate-100/70 text-[#0066FF] shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-[#8ab9ff]">
            <Wand2 className="h-3.5 w-3.5" />
          </span>
        )}
        <div
          className={cn(
            "min-w-0 max-w-[calc(100%-2.5rem)] rounded-3xl px-4 py-3 text-[13px] leading-6 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl sm:max-w-[78%]",
            isUser
              ? "rounded-br-lg border border-white/25 bg-[#0066FF]/85 text-white shadow-[0_18px_40px_-28px_rgba(0,102,255,0.9)]"
              : "rounded-bl-lg border border-slate-300/45 bg-slate-100/65 text-slate-800 dark:border-white/10 dark:bg-white/[0.08] dark:text-white/90",
          )}
        >
          {attachments.length > 0 && (
            <div
              className={cn(
                "mb-2 grid gap-1.5",
                attachments.length > 1 ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              {attachments.map((attachment, index) => {
                const caption = attachmentCaption(attachment);
                return (
                  <button
                    key={`${attachment.name}-${attachment.page ?? "img"}-${index}`}
                    type="button"
                    onClick={() => setPreview(attachment)}
                    className={cn(
                      "overflow-hidden rounded-2xl border text-left transition-transform hover:-translate-y-0.5",
                      isUser
                        ? "border-white/25 bg-white/10"
                        : "border-slate-300/40 bg-slate-100/60 dark:border-white/10 dark:bg-white/[0.06]",
                    )}
                    aria-label={`Ampliar ${caption}`}
                  >
                    {attachment.preview ? (
                      <img
                        src={attachment.preview}
                        alt={caption}
                        className="h-32 w-full bg-slate-100/80 object-contain dark:bg-white/[0.04]"
                      />
                    ) : (
                      <span className="flex h-20 items-center justify-center gap-1.5 px-2 text-[10px] opacity-70">
                        <FileText className="h-3.5 w-3.5" /> {caption}
                      </span>
                    )}
                    <span
                      className={cn(
                        "block truncate px-2 py-1 text-[9px]",
                        isUser ? "text-white/70" : "text-slate-500 dark:text-white/40",
                      )}
                    >
                      {caption}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {message.content && (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
          <div
            className={cn(
              "mt-1.5 flex items-center gap-1.5 text-[9px]",
              isUser ? "justify-end text-white/65" : "text-slate-400 dark:text-white/35",
            )}
          >
            {!isUser && label && <span>{label}</span>}
            <span>{timeLabel(message.created_at)}</span>
            {isUser && <Check className="h-2.5 w-2.5" />}
          </div>
        </div>
        {isUser && (
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0066FF]/15 text-[10px] font-semibold text-[#0066FF] ring-1 ring-[#0066FF]/20 dark:bg-[#0066FF]/20 dark:text-[#8ab9ff]">
            Tú
          </span>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${attachmentCaption(preview)}`}
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-full max-w-3xl overflow-hidden rounded-2xl border border-slate-300/40 bg-slate-100/95 shadow-[0_28px_90px_-30px_rgba(32,39,48,0.45)] backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            {preview.preview ? (
              <img
                src={preview.preview}
                alt={attachmentCaption(preview)}
                className="max-h-[80vh] w-auto max-w-full object-contain"
              />
            ) : (
              <div className="p-6 text-[12px] text-slate-600 dark:text-white/70">
                {preview.name}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 px-3 py-2 text-[10px] text-slate-500 dark:border-white/10 dark:text-white/50">
              <span className="truncate">
                {preview.name}
                {preview.page
                  ? ` · ${attachmentCaption(preview).toLowerCase()}`
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-full p-1 hover:bg-slate-200/60 dark:hover:bg-white/10"
                aria-label="Cerrar vista previa"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);

export function TypingBubble({ label = "Pensando…" }: { label?: string }) {
  return (
    <div className="flex w-full animate-fade-up items-center gap-2.5">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300/40 bg-slate-100/70 text-[#0066FF] shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-[#8ab9ff]">
        <Wand2 className="h-3.5 w-3.5" />
      </span>
      <div className="flex items-center gap-2 rounded-3xl rounded-bl-lg border border-slate-300/45 bg-slate-100/65 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.08]">
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0066FF]/70 dark:bg-[#8ab9ff]/70"
              style={{ animationDelay: `${dot * 0.15}s` }}
            />
          ))}
        </span>
        <span className="text-[10.5px] text-slate-500 dark:text-white/40">{label}</span>
      </div>
    </div>
  );
}
