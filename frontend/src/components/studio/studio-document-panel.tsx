"use client";

import type * as React from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import { Check, Download, ExternalLink, FileText, Loader2, Network, Sparkles, Trash2, Upload, UploadCloud, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AiOutput, AssistantMessage, ChatAttachment, DocumentFile, PendingAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChatComposer } from "@/components/studio/chat-composer";
import { MessageBubble, TypingBubble } from "@/components/studio/message-bubble";
import { PendingActionCard } from "@/components/studio/pending-action-card";
import { DOCUMENT_SUGGESTIONS, KIND_LABEL, dateLabel, fileSize, type Kind } from "@/lib/studio";

type Props = {
  docInputRef: RefObject<HTMLInputElement>;
  uploadingDoc: boolean;
  setDocDragging: Dispatch<SetStateAction<boolean>>;
  uploadDocument: (file: File | null | undefined) => Promise<void>;
  docDragging: boolean;
  sourceFiles: DocumentFile[];
  docId: string;
  selectDocument: (id: string) => void;
  loading: boolean;
  selectedDocument: DocumentFile | null;
  busyKind: string | null;
  generate: (kind: Kind) => Promise<void>;
  outputs: AiOutput[];
  removeOutput: (id: string) => Promise<void>;
  downloadPdf: (output: AiOutput) => void;
  downloadWord: (output: AiOutput) => void;
  setDocMessages: Dispatch<SetStateAction<AssistantMessage[]>>;
  setPending: Dispatch<SetStateAction<PendingAction | null>>;
  docMessages: AssistantMessage[];
  docScrollRef: RefObject<HTMLDivElement>;
  pending: PendingAction | null;
  setDocInput: Dispatch<SetStateAction<string>>;
  sendingDocument: boolean;
  confirming: boolean;
  confirmPending: (approve: boolean) => Promise<void>;
  docInput: string;
  sendDocument: () => Promise<void>;
  listening: boolean;
  toggleMicrophone: (target: "chat" | "document") => void;
  docAttachments: ChatAttachment[];
  attachFiles: (files: FileList | File[] | null | undefined, target: "chat" | "document") => Promise<void>;
  removeAttachment: (target: "chat" | "document", index: number) => void;
  attachingMode: "chat" | "document" | null;
};

export function StudioDocumentPanel({
  docInputRef,
  uploadingDoc,
  setDocDragging,
  uploadDocument,
  docDragging,
  sourceFiles,
  docId,
  selectDocument,
  loading,
  selectedDocument,
  busyKind,
  generate,
  outputs,
  removeOutput,
  downloadPdf,
  downloadWord,
  setDocMessages,
  setPending,
  docMessages,
  docScrollRef,
  pending,
  setDocInput,
  sendingDocument,
  confirming,
  confirmPending,
  docInput,
  sendDocument,
  listening,
  toggleMicrophone,
  docAttachments,
  attachFiles,
  removeAttachment,
  attachingMode,
}: Props) {
  return (
<div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(var(--mobile-nav-offset)+1.5rem)] pt-2 sm:px-5 lg:overflow-hidden lg:pb-6">
          <div className="mx-auto grid max-w-6xl gap-3 lg:h-full lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <div className="app-glass rounded-3xl p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                      Documentos
                    </p>
                    <h2 className="mt-0.5 text-[14px] font-semibold text-slate-800 dark:text-white/90">
                      Tus apuntes
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploadingDoc}
                    aria-label="Subir documento"
                    className="h-8 w-8 rounded-full"
                  >
                    {uploadingDoc ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDocDragging(true);
                  }}
                  onDragLeave={() => setDocDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDocDragging(false);
                    void uploadDocument(event.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "mt-3 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-3 py-4 text-center transition-all",
                    docDragging
                      ? "border-[#0066FF]/60 bg-[#0066FF]/10"
                      : "border-slate-300/35 bg-slate-100/30 hover:border-slate-400/45 hover:bg-slate-100/50 dark:border-white/15 dark:bg-white/[0.025] dark:hover:border-white/30",
                  )}
                >
                  {uploadingDoc ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#0066FF]" />
                  ) : (
                    <UploadCloud className="h-5 w-5 text-[#0066FF] dark:text-[#8ab9ff]" />
                  )}
                  <span className="mt-1.5 text-[10.5px] font-medium text-slate-600 dark:text-white/60">
                    {uploadingDoc ? "Subiendo…" : "Arrastra o pulsa para subir"}
                  </span>
                  <span className="mt-0.5 text-[9px] text-slate-400 dark:text-white/30">
                    PDF, Word, Excel, TXT o imagen
                  </span>
                </button>
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp"
                  className="hidden"
                  onChange={(event) => void uploadDocument(event.target.files?.[0])}
                />

                <div className="mt-3 space-y-1.5">
                  {sourceFiles.map((file) => {
                    const active = file.id === docId;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => selectDocument(file.id)}
                        className={cn(
                          "w-full rounded-2xl border px-2.5 py-2 text-left transition-all",
                          active
                            ? "border-[#0066FF]/45 bg-[#0066FF]/10 shadow-[0_10px_24px_-20px_rgba(0,102,255,0.8)] dark:border-[#8ab9ff]/25 dark:bg-[#0066FF]/15"
                            : "border-slate-300/40 bg-slate-100/50 hover:border-slate-400/45 hover:bg-slate-100/70 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <FileText
                            className={cn(
                              "mt-0.5 h-3.5 w-3.5 shrink-0",
                              active
                                ? "text-[#0066FF] dark:text-[#8ab9ff]"
                                : "text-slate-400 dark:text-white/30",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10.5px] font-medium text-slate-700 dark:text-white/75">
                              {file.filename}
                            </span>
                            <span className="mt-0.5 block text-[8.5px] text-slate-400 dark:text-white/30">
                              {fileSize(file.size_bytes)} · {dateLabel(file.created_at)}
                            </span>
                          </span>
                          {active && <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#0066FF] dark:text-[#8ab9ff]" />}
                        </div>
                      </button>
                    );
                  })}
                  {!loading && sourceFiles.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-300/40 px-3 py-4 text-center text-[10px] text-slate-500 dark:border-white/10 dark:text-white/35">
                      Sube tus apuntes para empezar.
                    </p>
                  )}
                </div>
              </div>

              {selectedDocument && (
                <div className="app-glass rounded-3xl p-3.5">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                    Generar con IA
                  </p>
                  <p className="mt-1 truncate text-[10.5px] font-medium text-slate-700 dark:text-white/70">
                    {selectedDocument.filename}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {(["summary", "infographic", "mindmap"] as Kind[]).map((kind) => (
                      <Button
                        key={kind}
                        variant="secondary"
                        size="sm"
                        disabled={busyKind !== null}
                        onClick={() => void generate(kind)}
                        className="h-8 px-1 text-[9px]"
                      >
                        {busyKind === `${selectedDocument.id}:${kind}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : kind === "summary" ? (
                          <Sparkles className="h-3 w-3" />
                        ) : kind === "infographic" ? (
                          <Wand2 className="h-3 w-3" />
                        ) : (
                          <Network className="h-3 w-3" />
                        )}
                        {KIND_LABEL[kind]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="app-glass rounded-3xl p-3.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                  Resultados generados
                </p>
                <div className="mt-2 space-y-2">
                  {outputs.slice(0, 8).map((output) => (
                    <div
                      key={output.id}
                      className="rounded-2xl border border-slate-300/40 bg-slate-100/55 p-2.5 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Badge variant="secondary" className="rounded-full text-[8px]">
                            {KIND_LABEL[output.kind] ?? output.kind}
                          </Badge>
                          <p className="mt-1 truncate text-[10.5px] font-medium text-slate-800 dark:text-white/80">
                            {output.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeOutput(output.id)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 dark:text-white/30"
                          aria-label="Eliminar resultado"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {output.output_document_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[8.5px]"
                            onClick={() => downloadPdf(output)}
                          >
                            <Download className="h-2.5 w-2.5" /> PDF
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[8.5px]"
                          onClick={() => downloadWord(output)}
                        >
                          <FileText className="h-2.5 w-2.5" /> Word
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[8.5px]"
                          onClick={() => window.open("https://www.canva.com/create/", "_blank")}
                        >
                          <ExternalLink className="h-2.5 w-2.5" /> Canva
                        </Button>
                      </div>
                    </div>
                  ))}
                  {outputs.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-300/40 px-3 py-4 text-center text-[10px] text-slate-500 dark:border-white/10 dark:text-white/35">
                      Todavía no has generado ningún resumen, infografía ni mapa mental.
                    </p>
                  )}
                </div>
              </div>
            </aside>

            <section className="flex min-h-[540px] flex-col overflow-hidden rounded-3xl border border-slate-300/40 bg-slate-100/70 shadow-[0_28px_80px_-48px_rgba(32,39,48,0.35)] backdrop-blur-3xl dark:border-white/10 dark:bg-black/25 lg:min-h-0">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-300/40 px-3 py-2.5 dark:border-white/10 sm:px-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                    Analizar documento
                  </p>
                  <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/85">
                    {selectedDocument?.filename ?? "Elige un documento"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDocMessages([]);
                    setPending(null);
                  }}
                  disabled={docMessages.length === 0}
                  className="h-8 rounded-full text-[10.5px]"
                >
                  Nueva
                </Button>
              </div>

              <div ref={docScrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                <div className="flex min-h-full flex-col justify-end gap-3">
                  {docMessages.length === 0 && !pending ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-3xl border border-slate-300/40 bg-slate-100/65 text-[#0066FF] shadow-[0_24px_60px_-28px_rgba(0,102,255,0.7)] backdrop-blur-3xl dark:border-white/10 dark:bg-white/[0.08] dark:text-[#8ab9ff]">
                        <FileText className="h-6 w-6" />
                      </span>
                      <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/95">
                        Chatea con tus apuntes
                      </h3>
                      <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-500 dark:text-white/40">
                        Sube un PDF (aunque esté escaneado), Word, Excel, texto o una foto de la
                        pizarra y pregúntale lo que necesites. También puedes generar un resumen
                        o un mapa mental.
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                        {DOCUMENT_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setDocInput(suggestion)}
                            disabled={!selectedDocument}
                            className="rounded-full border border-slate-300/40 bg-slate-100/55 px-2.5 py-1 text-[9.5px] font-medium text-slate-600 backdrop-blur-xl transition-colors hover:bg-slate-100/75 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50 dark:hover:bg-white/[0.09]"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {docMessages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                      {sendingDocument && <TypingBubble label="Leyendo el documento…" />}
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

              <div className="shrink-0 border-t border-slate-300/40 p-2.5 dark:border-white/10 sm:p-3">
                <ChatComposer
                  value={docInput}
                  onChange={setDocInput}
                  onSend={() => void sendDocument()}
                  sending={sendingDocument}
                  listening={listening}
                  onToggleMic={() => toggleMicrophone("document")}
                  placeholder={
                    selectedDocument
                      ? `Pregunta sobre «${selectedDocument.filename}»…`
                      : "Elige o sube un documento para empezar"
                  }
                  disabled={!selectedDocument}
                  contextLabel={selectedDocument?.filename ?? null}
                  onClearContext={() => selectDocument("")}
                  attachments={docAttachments}
                  onAttachFiles={(files) => void attachFiles(files, "document")}
                  onRemoveAttachment={(index) => removeAttachment("document", index)}
                  attaching={attachingMode === "document"}
                  hint="El documento se usa como contexto. Comprueba los datos importantes."
                />
              </div>
            </section>
          </div>
        </div>
  );
}
