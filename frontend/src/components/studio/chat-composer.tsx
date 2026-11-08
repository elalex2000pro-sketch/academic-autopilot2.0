"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Mic, Paperclip, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { attachmentCaption } from "@/lib/studio";
import type { ChatAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  listening,
  onToggleMic,
  placeholder,
  disabled = false,
  contextLabel,
  onClearContext,
  attachments,
  onAttachFiles,
  onRemoveAttachment,
  attaching = false,
  hint = "La IA puede cometer errores. Comprueba la información importante.",
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  listening: boolean;
  onToggleMic: () => void;
  placeholder: string;
  disabled?: boolean;
  contextLabel?: string | null;
  onClearContext?: () => void;
  attachments: ChatAttachment[];
  onAttachFiles: (files: FileList | File[] | null | undefined) => void;
  onRemoveAttachment: (index: number) => void;
  attaching?: boolean;
  hint?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || sending || attaching;
  const canSend = !blocked && (value.trim().length > 0 || attachments.length > 0);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!blocked) setDragging(true);
      }}
      onDragLeave={(event) => {
        // Al pasar sobre un hijo (texto, botones) el navegador emite
        // dragleave en el formulario; solo se oculta si se sale de verdad.
        const related = event.relatedTarget;
        if (related instanceof Node && event.currentTarget.contains(related)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!blocked) onAttachFiles(event.dataTransfer.files);
      }}
    >
      {contextLabel && (
        <div className="mb-1.5 flex justify-center px-3">
          <div className="flex max-w-full items-center gap-1.5 rounded-full border border-slate-300/45 bg-slate-100/75 px-3 py-1 shadow-[0_10px_30px_-20px_rgba(32,39,48,0.35)] backdrop-blur-3xl dark:border-white/10 dark:bg-black/45">
            <FileText className="h-3 w-3 shrink-0 text-slate-400 dark:text-white/30" />
            <span className="max-w-[230px] truncate text-[10px] font-medium text-slate-500 dark:text-white/40">
              {contextLabel}
            </span>
            {onClearContext && (
              <button
                type="button"
                onClick={onClearContext}
                className="rounded-full p-0.5 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/70"
                aria-label="Quitar documento"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
      <div
        className={cn(
          "rounded-[26px] border border-slate-300/45 bg-slate-100/70 p-2 shadow-[0_24px_70px_-28px_rgba(32,39,48,0.35)] backdrop-blur-3xl transition-colors dark:border-white/10 dark:bg-black/45",
          dragging && "border-[#0066FF]/60 bg-[#0066FF]/[0.07]",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            onAttachFiles(files);
          }}
        />

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 px-1">
            {attachments.map((attachment, index) => (
              <div
                key={`${attachment.name}-${attachment.page ?? "img"}-${index}`}
                className="flex items-center gap-2 rounded-2xl border border-slate-300/40 bg-slate-100/70 p-1.5 pr-2 dark:border-white/10 dark:bg-white/[0.06]"
              >
                {attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt=""
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/60 dark:bg-white/10">
                    <FileText className="h-4 w-4 text-slate-400 dark:text-white/35" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="max-w-[130px] truncate text-[10px] font-medium text-slate-700 dark:text-white/75">
                    {attachment.name}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-white/35">
                    {attachment.page ? attachmentCaption(attachment) : "Imagen"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(index)}
                  disabled={sending}
                  className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40 dark:text-white/30 dark:hover:text-rose-300"
                  aria-label={`Quitar ${attachmentCaption(attachment)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {dragging && (
          <p className="px-2 pb-1 text-[10px] font-medium text-[#0066FF] dark:text-[#8ab9ff]">
            Suelta las imágenes o el PDF aquí
          </p>
        )}

        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || attaching || sending}
            className={cn(
              "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40",
              attaching
                ? "bg-[#0066FF]/12 text-[#0066FF] dark:bg-[#0066FF]/15 dark:text-[#8ab9ff]"
                : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/80",
            )}
            aria-label="Adjuntar imágenes o PDF"
            title="Adjuntar imágenes o PDF"
          >
            {attaching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onToggleMic}
            disabled={disabled}
            className={cn(
              "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40",
              listening
                ? "bg-[#FF3B30]/12 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/80",
            )}
            aria-label={listening ? "Detener dictado" : "Dictar mensaje"}
          >
            <Mic className={cn("h-4 w-4", listening && "animate-pulse")} />
          </button>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) onSend();
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-[13px] leading-5 text-slate-800 outline-none placeholder:text-slate-400 dark:text-white/90 dark:placeholder:text-white/25"
            aria-label="Mensaje para la IA"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            className="mb-0.5 h-9 w-9 shrink-0 rounded-full"
            aria-label="Enviar mensaje"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[9px] text-slate-500/70 dark:text-white/25">{hint}</p>
    </form>
  );
}
