"use client";

import type * as React from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import { formatSize } from "@/lib/chat-format";
import { FileText, Loader2, Paperclip, Send, SmilePlus, X } from "lucide-react";
import { ChatExtrasPicker } from "@/components/chat-extras-picker";
import { stickerMessage } from "@/lib/gamification";

type Props = {
  selectFile: (next: File | null) => void;
  file: File | null;
  filePreview: string | null;
  setFile: Dispatch<SetStateAction<File | null>>;
  fileRef: RefObject<HTMLInputElement>;
  extrasOpen: boolean;
  level: number;
  setDraft: Dispatch<SetStateAction<string>>;
  composerRef: RefObject<HTMLTextAreaElement>;
  handleSend: (overrideText?: string) => Promise<void>;
  setExtrasOpen: Dispatch<SetStateAction<boolean>>;
  draft: string;
  sending: boolean;
  loadingThread: boolean;
};

export function ChatThreadComposer({
  selectFile,
  file,
  filePreview,
  setFile,
  fileRef,
  extrasOpen,
  level,
  setDraft,
  composerRef,
  handleSend,
  setExtrasOpen,
  draft,
  sending,
  loadingThread,
}: Props) {
  return (
<div
              className="chat-composer"
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files"))
                  event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files[0] ?? null);
              }}
            >
              {file ? (
                <div className="chat-file-preview">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt={`Vista previa de ${file.name}`}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <FileText className="h-7 w-7 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{file.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="chat-icon-button"
                    aria-label="Quitar adjunto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {extrasOpen ? (
                <ChatExtrasPicker
                  level={level}
                  onEmoji={(emoji) => {
                    setDraft((text) => text + emoji);
                    composerRef.current?.focus();
                  }}
                  onSticker={(sticker) =>
                    void handleSend(stickerMessage(sticker.id))
                  }
                  onClose={() => setExtrasOpen(false)}
                />
              ) : null}
              <div className="flex items-end gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  className="hidden"
                  aria-label="Seleccionar foto o documento"
                  onChange={(event) => {
                    selectFile(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
                <button
                  onClick={() => setExtrasOpen((value) => !value)}
                  className="chat-icon-button"
                  aria-label="Emojis y stickers"
                  aria-expanded={extrasOpen}
                >
                  <SmilePlus className="h-5 w-5" />
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="chat-icon-button"
                  aria-label="Adjuntar foto o documento"
                  title="Adjuntar foto o documento"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <textarea
                  ref={composerRef}
                  value={draft}
                  maxLength={4000}
                  onChange={(event) => setDraft(event.target.value)}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.files[0];
                    if (pasted) {
                      event.preventDefault();
                      selectFile(pasted);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Escribe un mensaje"
                  aria-label="Mensaje"
                  className="chat-textarea"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={
                    sending || loadingThread || (!draft.trim() && !file)
                  }
                  className="chat-send"
                  aria-label="Enviar mensaje"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 pl-2 text-[10px] text-muted-foreground">
                Enter para enviar · Mayús + Enter para otra línea · Adjuntos
                hasta 25 MB
              </p>
            </div>
  );
}
