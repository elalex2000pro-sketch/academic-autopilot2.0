"use client";

import type * as React from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import { Check, Copy, Download, FileAudio, FileText, Loader2, Mic, NotebookPen, Sparkles, Square, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiOutput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { clock, fileSize, type Segment } from "@/lib/studio";

type Props = {
  audioInputRef: RefObject<HTMLInputElement>;
  setAudioDragging: Dispatch<SetStateAction<boolean>>;
  chooseAudio: (next: File | null) => void;
  audioDragging: boolean;
  audioLoading: boolean;
  audioFile: File | null;
  transcribeAudio: (target?: File, durationHint?: number) => Promise<void>;
  recording: boolean;
  seconds: number;
  stopRecording: () => void;
  startRecording: () => Promise<void>;
  loadDemoTranscript: () => void;
  audioText: string;
  audioTitle: string;
  setAudioTitle: Dispatch<SetStateAction<string>>;
  audioDuration: number;
  audioSegments: Segment[];
  copyText: () => Promise<void>;
  copied: boolean;
  saveNotebook: () => Promise<void>;
  savingNotebook: boolean;
  notebookSaved: boolean;
  summarizeTranscript: () => Promise<void>;
  summarizing: boolean;
  summaryOutput: AiOutput | null;
  downloadPdf: (output: AiOutput) => void;
  downloadWord: (output: AiOutput) => void;
};

export function StudioAudioPanel({
  audioInputRef,
  setAudioDragging,
  chooseAudio,
  audioDragging,
  audioLoading,
  audioFile,
  transcribeAudio,
  recording,
  seconds,
  stopRecording,
  startRecording,
  loadDemoTranscript,
  audioText,
  audioTitle,
  setAudioTitle,
  audioDuration,
  audioSegments,
  copyText,
  copied,
  saveNotebook,
  savingNotebook,
  notebookSaved,
  summarizeTranscript,
  summarizing,
  summaryOutput,
  downloadPdf,
  downloadWord,
}: Props) {
  return (
<div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(var(--mobile-nav-offset)+1.5rem)] pt-2 sm:px-5 lg:pb-8">
          <div className="mx-auto max-w-5xl space-y-3">
            <section className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="app-glass rounded-3xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                      Audio a apuntes
                    </p>
                    <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
                      Sube una grabación
                    </h2>
                  </div>
                  <FileAudio className="h-5 w-5 text-slate-300 dark:text-white/20" />
                </div>

                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setAudioDragging(true);
                  }}
                  onDragLeave={() => setAudioDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setAudioDragging(false);
                    chooseAudio(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={cn(
                    "mt-4 flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-9 text-center transition-all duration-200",
                    audioDragging
                      ? "border-[#0066FF]/60 bg-[#0066FF]/10"
                      : "border-slate-300/35 bg-slate-100/30 hover:border-slate-400/45 hover:bg-slate-100/50 dark:border-white/15 dark:bg-white/[0.025] dark:hover:border-white/30 dark:hover:bg-white/[0.05]",
                  )}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100/60 text-[#0066FF] shadow-sm backdrop-blur-xl dark:bg-white/10 dark:text-[#8ab9ff]">
                    {audioLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <UploadCloud className="h-6 w-6" />
                    )}
                  </span>
                  <span className="mt-3 text-[13px] font-semibold text-slate-700 dark:text-white/80">
                    {audioFile ? audioFile.name : "Arrastra un MP3, M4A, WAV, OGG o WEBM"}
                  </span>
                  <span className="mt-1 text-[10.5px] text-slate-500 dark:text-white/35">
                    Máximo 24 MB · el audio no se guarda en la biblioteca
                  </span>
                </button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3,.m4a,.wav,.ogg,.webm,.mp4,.mpeg,.mpga,.flac,audio/*"
                  className="hidden"
                  onChange={(event) => chooseAudio(event.target.files?.[0] ?? null)}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400 dark:text-white/30">
                    {audioFile ? `${fileSize(audioFile.size)} listos` : "Ningún archivo seleccionado"}
                  </p>
                  <Button
                    onClick={() => void transcribeAudio()}
                    disabled={audioLoading || !audioFile}
                    className="h-9 rounded-full px-4"
                  >
                    {audioLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileAudio className="h-4 w-4" />
                    )}
                    {audioLoading ? "Transcribiendo…" : "Transcribir audio"}
                  </Button>
                </div>
              </div>

              <div className="app-glass rounded-3xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                      Grabadora
                    </p>
                    <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
                      Graba una clase
                    </h2>
                  </div>
                  <span
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold",
                      recording
                        ? "bg-[#FF3B30]/12 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                        : "bg-slate-100/60 text-slate-500 dark:bg-white/[0.06] dark:text-white/45",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        recording ? "animate-pulse bg-[#FF3B30]" : "bg-slate-400 dark:bg-white/30",
                      )}
                    />
                    {recording ? "Grabando" : "Listo"}
                  </span>
                </div>

                <div className="mt-4 rounded-3xl border border-slate-300/40 bg-slate-900/[0.03] p-4 dark:border-white/10 dark:bg-black/20">
                  <div className="flex h-16 items-center justify-center gap-[3px]">
                    {Array.from({ length: 36 }, (_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "w-[3px] rounded-full transition-all duration-300",
                          recording
                            ? "animate-waveform bg-[#0066FF]"
                            : "bg-slate-300/80 dark:bg-white/20",
                        )}
                        style={{
                          height: recording
                            ? `${16 + ((index * 13) % 42)}px`
                            : `${8 + ((index * 7) % 18)}px`,
                          animationDelay: `${(index % 9) * 0.08}s`,
                          animationDuration: `${0.65 + (index % 5) * 0.12}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-white/35">
                    <span className="font-medium tabular-nums text-slate-700 dark:text-white/70">
                      {clock(seconds)}
                    </span>
                    <span>{recording ? "Escuchando…" : "Micrófono del navegador"}</span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {recording ? (
                    <Button
                      variant="destructive"
                      className="h-9 flex-1 rounded-full"
                      onClick={stopRecording}
                    >
                      <Square className="h-3.5 w-3.5" /> Detener y transcribir
                    </Button>
                  ) : (
                    <Button className="h-9 flex-1 rounded-full" onClick={() => void startRecording()}>
                      <Mic className="h-4 w-4" /> Grabar clase
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex items-start justify-between gap-2">
                  <p className="text-[10px] leading-4 text-slate-400 dark:text-white/30">
                    La grabación se envía a Whisper al detenerla. Necesita micrófono y un motor de
                    IA configurado.
                  </p>
                  <button
                    type="button"
                    onClick={loadDemoTranscript}
                    className="shrink-0 text-[10px] font-medium text-[#0066FF] underline underline-offset-2 dark:text-[#8ab9ff]"
                  >
                    Usar ejemplo
                  </button>
                </div>
              </div>
            </section>

            {audioText && (
              <section className="app-glass overflow-hidden rounded-3xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300/40 px-4 py-3 dark:border-white/10 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                      Modo lectura
                    </p>
                    <input
                      value={audioTitle}
                      onChange={(event) => setAudioTitle(event.target.value)}
                      className="mt-0.5 w-full min-w-0 border-0 bg-transparent p-0 text-[17px] font-semibold tracking-[-0.02em] text-slate-800 outline-none dark:text-white/90"
                      aria-label="Título de la transcripción"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full border border-slate-300/40 bg-slate-100/60 px-2.5 py-1 text-[9.5px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/45">
                      {clock(audioDuration)} · {audioSegments.length} fragmentos
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => void copyText()} className="h-8">
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-[#34C759]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </div>

                <article className="max-h-[420px] overflow-y-auto px-4 py-5 sm:px-6">
                  <div className="mx-auto max-w-3xl space-y-5">
                    {audioSegments.map((segment, index) => (
                      <div
                        key={`${segment.at}-${index}`}
                        className="grid grid-cols-[52px_minmax(0,1fr)] gap-3"
                      >
                        <span className="pt-0.5 text-right text-[10.5px] font-semibold tabular-nums text-[#0066FF] dark:text-[#8ab9ff]">
                          {segment.at}
                        </span>
                        <p className="text-[14px] leading-7 text-slate-700 dark:text-white/70">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>

                <div className="border-t border-slate-300/40 px-4 py-4 dark:border-white/10 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => void saveNotebook()}
                      disabled={savingNotebook || notebookSaved}
                      className="h-9 rounded-full"
                    >
                      {savingNotebook ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <NotebookPen className="h-4 w-4" />
                      )}
                      {notebookSaved ? "Guardado en Cuadernos" : "Guardar como cuaderno"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void summarizeTranscript()}
                      disabled={summarizing}
                      className="h-9 rounded-full"
                    >
                      {summarizing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {summarizing ? "Resumiendo…" : "Resumir con IA"}
                    </Button>
                  </div>

                  {notebookSaved && (
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#1a9e3a] dark:text-[#7ee69a]">
                      <Check className="h-3.5 w-3.5" /> Guardado en Cuadernos. Ya puedes generar
                      flashcards o un resumen.
                    </p>
                  )}

                  {summaryOutput && (
                    <div className="mt-3 rounded-2xl border border-slate-300/40 bg-slate-100/55 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[11px] font-medium text-slate-800 dark:text-white/80">
                        {summaryOutput.title}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {summaryOutput.output_document_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[9.5px]"
                            onClick={() => downloadPdf(summaryOutput)}
                          >
                            <Download className="h-3 w-3" /> PDF
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[9.5px]"
                          onClick={() => downloadWord(summaryOutput)}
                        >
                          <FileText className="h-3 w-3" /> Word
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
  );
}
