"use client";

import type * as React from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import { BookOpen, FileText, GraduationCap, Loader2, X } from "lucide-react";
import { type OpenBookContext } from "@/lib/book-context";
import type { AssistantMessage, AssistantStatus, ChatAttachment, DocumentFile, PendingAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChatComposer } from "@/components/studio/chat-composer";
import { MessageBubble, TypingBubble } from "@/components/studio/message-bubble";
import { PendingActionCard } from "@/components/studio/pending-action-card";
import { CHAT_SUGGESTIONS } from "@/lib/studio";

type Props = {
  chatScrollRef: RefObject<HTMLDivElement>;
  embedded: boolean;
  loading: boolean;
  messages: AssistantMessage[];
  pending: PendingAction | null;
  setChatInput: Dispatch<SetStateAction<string>>;
  status: AssistantStatus | null;
  sendingChat: boolean;
  confirming: boolean;
  confirmPending: (approve: boolean) => Promise<void>;
  openBook: OpenBookContext | null;
  useBookContext: boolean;
  setUseBookContext: Dispatch<SetStateAction<boolean>>;
  askAboutBook: (prompt: string) => void;
  sourceFiles: DocumentFile[];
  chatDocumentId: string;
  setChatDocumentId: Dispatch<SetStateAction<string>>;
  chatInput: string;
  sendChat: (override?: string) => Promise<void>;
  listening: boolean;
  toggleMicrophone: (target: "chat" | "document") => void;
  chatAttachments: ChatAttachment[];
  attachFiles: (files: FileList | File[] | null | undefined, target: "chat" | "document") => Promise<void>;
  removeAttachment: (target: "chat" | "document", index: number) => void;
  attachingMode: "chat" | "document" | null;
};

export function StudioChatPanel({
  chatScrollRef,
  embedded,
  loading,
  messages,
  pending,
  setChatInput,
  status,
  sendingChat,
  confirming,
  confirmPending,
  openBook,
  useBookContext,
  setUseBookContext,
  askAboutBook,
  sourceFiles,
  chatDocumentId,
  setChatDocumentId,
  chatInput,
  sendChat,
  listening,
  toggleMicrophone,
  chatAttachments,
  attachFiles,
  removeAttachment,
  attachingMode,
}: Props) {
  return (
<div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={chatScrollRef}
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pt-2 sm:px-6",
              embedded ? "pb-3" : "pb-[calc(var(--mobile-nav-offset)+9rem)] lg:pb-44",
            )}
          >
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-4">
              {loading ? (
                <div className="flex flex-1 items-center justify-center pb-20">
                  <span className="flex items-center gap-2 rounded-full border border-slate-300/40 bg-slate-100/60 px-4 py-2 text-[11px] text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-black/35 dark:text-white/45">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066FF]" /> Abriendo el chat…
                  </span>
                </div>
              ) : messages.length === 0 && !pending ? (
                <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-300/40 bg-slate-100/60 text-[#0066FF] shadow-[0_24px_60px_-28px_rgba(0,102,255,0.7)] backdrop-blur-3xl dark:border-white/10 dark:bg-white/[0.08] dark:text-[#8ab9ff]">
                    <GraduationCap className="h-7 w-7" />
                  </span>
                  <h2 className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-slate-900 dark:text-white/95">
                    ¿Qué quieres resolver hoy?
                  </h2>
                  <p className="mt-1 max-w-md text-[12px] leading-5 text-slate-600 dark:text-white/45">
                    Pregunta por tus tareas, pide un plan de estudio o resuelve un problema de
                    clase. También puedes adjuntar una foto, un apunte o un PDF escaneado.
                  </p>
                  <div className="mt-5 grid w-full max-w-2xl gap-2 md:grid-cols-2">
                    {CHAT_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setChatInput(suggestion)}
                        className="rounded-2xl border border-slate-300/40 bg-slate-100/45 px-3 py-2.5 text-left text-[11.5px] font-medium text-slate-600 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-slate-400/45 hover:bg-slate-100/65 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/55 dark:hover:border-white/20 dark:hover:bg-white/[0.09]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-[10px] text-slate-400 dark:text-white/30">
                    {status?.configured
                      ? `Conectado a ${status.provider} · ${status.model}`
                      : "Sin motor externo: respuestas por reglas"}
                    {status?.tools_enabled ? " · Puede crear tareas y eventos en tu calendario" : ""}
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {sendingChat && <TypingBubble />}
                  {pending && (
                    <PendingActionCard
                      pending={pending}
                      confirming={confirming}
                      onConfirm={(approve) => void confirmPending(approve)}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <div
            className={cn(
              "z-40 max-w-3xl min-w-0",
              embedded
                ? "mx-auto w-full shrink-0 border-t border-slate-300/35 bg-[#f4f4f7]/55 px-3 pb-3 pt-2 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0f18]/45 sm:px-5"
                : "fixed bottom-[calc(var(--mobile-nav-offset)+0.75rem)] left-1/2 w-[calc(100%-1.5rem)] -translate-x-1/2 lg:bottom-6 lg:left-[calc(50%+118px)]",
            )}
          >
            {openBook && (
              <div className="mb-1.5 flex justify-center px-3">
                <div
                  className={cn(
                    "flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border px-2.5 py-1.5 shadow-[0_10px_30px_-20px_rgba(32,39,48,0.35)] backdrop-blur-3xl transition-colors",
                    useBookContext
                      ? "border-[#0066FF]/35 bg-[#0066FF]/[0.08] dark:border-[#8ab9ff]/25 dark:bg-[#0066FF]/15"
                      : "border-slate-300/45 bg-slate-100/75 dark:border-white/10 dark:bg-black/45",
                  )}
                >
                  <BookOpen className="h-3 w-3 shrink-0 text-[#0066FF] dark:text-[#8ab9ff]" />
                  <span className="max-w-[210px] truncate text-[10px] font-medium text-slate-600 dark:text-white/55">
                    {openBook.title} · pág. {openBook.page} de {openBook.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseBookContext((value) => !value)}
                    aria-pressed={useBookContext}
                    title={
                      useBookContext
                        ? "La IA leerá la página o el capítulo abierto"
                        : "La IA no leerá el PDF"
                    }
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold transition-colors",
                      useBookContext
                        ? "bg-[#0066FF] text-white"
                        : "bg-slate-300/60 text-slate-600 dark:bg-white/10 dark:text-white/45",
                    )}
                  >
                    {useBookContext ? "Contexto ON" : "Contexto OFF"}
                  </button>
                  {useBookContext && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          askAboutBook(
                            "Hazme un resumen claro de esta página o capítulo del PDF.",
                          )
                        }
                        disabled={sendingChat}
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-[#0066FF] transition-colors hover:bg-[#0066FF]/10 disabled:opacity-40 dark:text-[#8ab9ff] dark:hover:bg-white/10"
                      >
                        Resumen
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          askAboutBook(
                            "Crea un mapa mental de este texto del PDF, con la idea central y las ramas de ideas principales.",
                          )
                        }
                        disabled={sendingChat}
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-[#0066FF] transition-colors hover:bg-[#0066FF]/10 disabled:opacity-40 dark:text-[#8ab9ff] dark:hover:bg-white/10"
                      >
                        Mapa mental
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            {sourceFiles.length > 0 && (
              <div className="mb-1.5 flex justify-center px-3">
                <div className="flex max-w-full items-center gap-1.5 rounded-full border border-slate-300/45 bg-slate-100/75 px-3 py-1 shadow-[0_10px_30px_-20px_rgba(32,39,48,0.35)] backdrop-blur-3xl dark:border-white/10 dark:bg-black/45">
                  <FileText className="h-3 w-3 shrink-0 text-slate-400 dark:text-white/30" />
                  <select
                    value={chatDocumentId}
                    onChange={(event) => setChatDocumentId(event.target.value)}
                    className="max-w-[220px] truncate border-0 bg-transparent p-0 text-[10px] font-medium text-slate-500 outline-none dark:text-white/40"
                    aria-label="Documento de contexto"
                  >
                    <option value="">Sin documento de contexto</option>
                    {sourceFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.filename}
                      </option>
                    ))}
                  </select>
                  {chatDocumentId && (
                    <button
                      type="button"
                      onClick={() => setChatDocumentId("")}
                      className="rounded-full p-0.5 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/70"
                      aria-label="Quitar documento"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <ChatComposer
              value={chatInput}
              onChange={setChatInput}
              onSend={() => void sendChat()}
              sending={sendingChat}
              listening={listening}
              onToggleMic={() => toggleMicrophone("chat")}
              placeholder="Pregunta lo que necesites…"
              attachments={chatAttachments}
              onAttachFiles={(files) => void attachFiles(files, "chat")}
              onRemoveAttachment={(index) => removeAttachment("chat", index)}
              attaching={attachingMode === "chat"}
            />
          </div>
        </div>
  );
}
