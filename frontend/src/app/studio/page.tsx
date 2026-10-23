"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Mic,
  Network,
  PanelRight,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { AiOutput, AssistantMessage, DocumentFile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "summary" | "infographic" | "mindmap";

const KIND_LABEL: Record<string, string> = {
  summary: "Resumen",
  infographic: "Infografía",
  mindmap: "Mapa mental",
};

const SUGGESTIONS = [
  "¿Qué tareas tengo esta semana?",
  "Ayúdame a planificar el estudio de hoy.",
  "Resume lo más importante de mis apuntes.",
  "¿Cómo puedo preparar el próximo examen?",
];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export default function StudioPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [outputs, setOutputs] = useState<AiOutput[]>([]);
  const [input, setInput] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [history, fileList, outputList] = await Promise.all([
        api.assistantMessages(80),
        api.files(),
        api.studioOutputs(),
      ]);
      setMessages(history);
      setFiles(fileList);
      setOutputs(outputList);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const sourceFiles = files.filter(
    (file) => !outputs.some((output) => output.output_document_id === file.id),
  );

  async function sendMessage(event?: React.FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const optimistic: AssistantMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      source: null,
      document_id: documentId || null,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setInput("");
    setSending(true);
    setNotice(null);
    try {
      const response = await api.chat(content, documentId || null);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.reply,
          source: response.source,
          document_id: response.document_id,
          created_at: response.created_at || new Date().toISOString(),
        },
      ]);
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setInput(content);
      setNotice(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function clearChat() {
    if (clearing) return;
    setClearing(true);
    try {
      await api.clearAssistant();
      setMessages([]);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setClearing(false);
    }
  }

  function toggleMicrophone() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setNotice("Tu navegador no permite dictado por voz. Escribe tu pregunta.");
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }
      if (transcript.trim()) {
        setInput((current) => `${current}${current ? " " : ""}${transcript.trim()}`);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setNotice("No se pudo escuchar el micrófono.");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function generate(documentIdValue: string, kind: Kind) {
    setBusyId(`${documentIdValue}:${kind}`);
    setNotice(null);
    try {
      const output = await api.generateStudio(documentIdValue, kind);
      setNotice(`Generado: ${output.title}`);
      const [fileList, outputList] = await Promise.all([api.files(), api.studioOutputs()]);
      setFiles(fileList);
      setOutputs(outputList);
      setMessages((current) => [
        ...current,
        {
          id: `studio-${output.id}`,
          role: "assistant",
          content: `He generado «${output.title}». Puedes descargarlo en PDF o Word desde el panel de herramientas.`,
          source: "studio",
          document_id: output.output_document_id,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function removeOutput(id: string) {
    setNotice(null);
    try {
      await api.deleteStudioOutput(id);
      const outputList = await api.studioOutputs();
      setOutputs(outputList);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <div className="relative flex h-[calc(100dvh-104px)] min-h-[620px] flex-col overflow-hidden lg:h-dvh">
      <div className="studio-aurora" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/35 dark:from-black/5 dark:to-black/35" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/55 text-[#0066FF] shadow-sm backdrop-blur-xl dark:bg-white/10 dark:text-[#8ab9ff]">
            <Wand2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white/90">
              IA Studio
            </h1>
            <p className="truncate text-[10px] text-slate-500 dark:text-white/35">
              Tu copiloto académico · chat, documentos y resúmenes
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Badge
            variant="secondary"
            className="hidden rounded-full border border-white/45 bg-white/40 text-[9.5px] font-semibold text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white/45 sm:flex"
          >
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-[#34C759]" /> En línea
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void clearChat()}
            disabled={clearing || messages.length === 0}
            className="h-8 rounded-full text-[11px]"
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Limpiar</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setToolsOpen(true)}
            className="h-8 rounded-full text-[11px]"
          >
            <PanelRight className="h-3.5 w-3.5" /> Herramientas
          </Button>
        </div>
      </header>

      {notice && (
        <div className="relative z-10 mx-3 mb-1 flex items-start gap-2 rounded-2xl border border-white/40 bg-white/45 px-3 py-2 text-[11px] text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-black/35 dark:text-white/60 sm:mx-5">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            <X className="h-3.5 w-3.5 opacity-50" />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 pb-40 pt-2 sm:px-6"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-4">
          {loading ? (
            <div className="flex flex-1 items-center justify-center pb-20">
              <span className="flex items-center gap-2 rounded-full border border-white/40 bg-white/45 px-4 py-2 text-[11px] text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-black/35 dark:text-white/45">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066FF]" /> Abriendo el chat…
              </span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/50 bg-white/50 text-[#0066FF] shadow-[0_24px_60px_-28px_rgba(0,102,255,0.7)] backdrop-blur-3xl dark:border-white/10 dark:bg-white/[0.08] dark:text-[#8ab9ff]">
                <Sparkles className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-slate-900 dark:text-white/95">
                ¿Qué quieres resolver hoy?
              </h2>
              <p className="mt-1 max-w-md text-[12px] leading-5 text-slate-600 dark:text-white/45">
                Pregunta por tus tareas, pide un plan de estudio o genera un resumen a partir de tus
                documentos. El contexto de tus asignaturas está disponible.
              </p>
              <div className="mt-5 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="rounded-2xl border border-white/50 bg-white/35 px-3 py-2.5 text-left text-[11.5px] font-medium text-slate-600 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/80 hover:bg-white/55 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/55 dark:hover:border-white/20 dark:hover:bg-white/[0.09]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={cn("flex w-full gap-2.5", isUser ? "justify-end" : "justify-start")}
                >
                  {!isUser && (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/45 text-[#0066FF] backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-[#8ab9ff]">
                      <Wand2 className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[86%] rounded-3xl px-4 py-3 text-[13px] leading-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.7)] backdrop-blur-xl sm:max-w-[78%]",
                      isUser
                        ? "rounded-br-lg border border-white/15 bg-[#0057D9]/75 text-white shadow-[0_18px_40px_-28px_rgba(0,87,217,0.9)]"
                        : "rounded-bl-lg border border-white/15 bg-slate-900/70 text-white/90 dark:border-white/10 dark:bg-slate-950/65",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <div
                      className={cn(
                        "mt-1.5 flex items-center gap-1.5 text-[9px]",
                        isUser ? "justify-end text-white/60" : "text-white/40",
                      )}
                    >
                      {!isUser && message.source === "local" && <span>modo local</span>}
                      {!isUser && message.source === "studio" && <span>generador</span>}
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
              );
            })
          )}

          {sending && (
            <div className="flex w-full items-center gap-2.5">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/45 text-[#0066FF] backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-[#8ab9ff]">
                <Wand2 className="h-3.5 w-3.5" />
              </span>
              <div className="flex items-center gap-1 rounded-3xl rounded-bl-lg border border-white/15 bg-slate-900/75 px-4 py-3.5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={sendMessage}
        className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 lg:left-[calc(50%+118px)]"
      >
        {sourceFiles.length > 0 && (
          <div className="mb-1.5 flex justify-center px-3">
            <div className="flex max-w-full items-center gap-1.5 rounded-full border border-white/55 bg-white/70 px-3 py-1 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.55)] backdrop-blur-3xl dark:border-white/10 dark:bg-black/45">
              <FileText className="h-3 w-3 shrink-0 text-slate-400 dark:text-white/30" />
              <select
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value)}
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
              {documentId && (
                <button
                  type="button"
                  onClick={() => setDocumentId("")}
                  className="rounded-full p-0.5 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/70"
                  aria-label="Quitar documento"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="rounded-full border border-white/55 bg-white/65 p-2 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.65)] backdrop-blur-3xl dark:border-white/10 dark:bg-black/45">
          <div className="flex items-end gap-1.5">
            <button
              type="button"
              onClick={toggleMicrophone}
              className={cn(
                "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                listening
                  ? "bg-[#FF3B30]/12 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/80",
              )}
              aria-label={listening ? "Detener dictado" : "Dictar mensaje"}
            >
              {listening ? <Mic className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
            </button>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="Pregunta lo que necesites…"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-[13px] leading-5 text-slate-800 outline-none placeholder:text-slate-400 dark:text-white/90 dark:placeholder:text-white/25"
              aria-label="Mensaje para la IA"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || sending}
              className="mb-0.5 h-9 w-9 shrink-0 rounded-full"
              aria-label="Enviar mensaje"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[9px] text-slate-500/70 dark:text-white/25">
          La IA puede cometer errores. Comprueba la información importante.
        </p>
      </form>

      {toolsOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm"
          onClick={() => setToolsOpen(false)}
        >
          <aside
            className="flex h-full w-full max-w-md flex-col border-l border-white/50 bg-white/80 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/92"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/50 px-4 py-3 dark:border-white/10">
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                  Herramientas
                </p>
                <h2 className="mt-0.5 flex items-center gap-1.5 text-[16px] font-semibold text-slate-900 dark:text-white/90">
                  <MessageSquare className="h-4 w-4" /> Documentos y PDFs
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-white/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Cerrar herramientas"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                  Mis documentos
                </h3>
                <div className="mt-2 space-y-2">
                  {sourceFiles.map((file) => (
                    <div
                      key={file.id}
                      className="rounded-2xl border border-white/55 bg-white/35 p-3 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <p className="truncate text-[11.5px] font-medium text-slate-800 dark:text-white/80">
                        {file.filename}
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        {(["summary", "infographic", "mindmap"] as Kind[]).map((kind) => (
                          <Button
                            key={kind}
                            variant="secondary"
                            size="sm"
                            disabled={busyId !== null}
                            onClick={() => void generate(file.id, kind)}
                            className="h-7 px-1 text-[9.5px]"
                          >
                            {busyId === `${file.id}:${kind}` ? (
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
                  ))}
                  {sourceFiles.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-white/60 px-3 py-5 text-center text-[10.5px] text-slate-500 dark:border-white/10 dark:text-white/35">
                      Sube documentos en Archivos para resumirlos aquí.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                  Resultados generados
                </h3>
                <div className="mt-2 space-y-2">
                  {outputs.map((output) => (
                    <div
                      key={output.id}
                      className="rounded-2xl border border-white/55 bg-white/35 p-3 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Badge variant="secondary" className="rounded-full text-[8.5px]">
                            {KIND_LABEL[output.kind] ?? output.kind}
                          </Badge>
                          <p className="mt-1 truncate text-[11.5px] font-medium text-slate-800 dark:text-white/80">
                            {output.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeOutput(output.id)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 dark:text-white/30"
                          aria-label="Eliminar resultado"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {output.output_document_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[9.5px]"
                            onClick={() =>
                              output.output_document_id &&
                              api.downloadFile(output.output_document_id, `${output.title}.pdf`)
                            }
                          >
                            <Download className="h-3 w-3" /> PDF
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[9.5px]"
                          onClick={() => api.downloadStudioWord(output.id, `${output.title}.docx`)}
                        >
                          <FileText className="h-3 w-3" /> Word
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[9.5px]"
                          onClick={() => window.open("https://www.canva.com/create/", "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" /> Canva
                        </Button>
                      </div>
                    </div>
                  ))}
                  {outputs.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-white/60 px-3 py-5 text-center text-[10.5px] text-slate-500 dark:border-white/10 dark:text-white/35">
                      Todavía no has generado ningún resumen, infografía ni mapa mental.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
