"use client";

import { StudioChatPanel } from "@/components/studio/studio-chat-panel";
import { StudioHeader } from "@/components/studio/studio-header";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, FileAudio, FileText, Loader2, Mic, Network, NotebookPen, Sparkles, Square, Trash2, Upload, UploadCloud, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getOpenBook, subscribeOpenBook, type OpenBookContext } from "@/lib/book-context";
import { MAX_ATTACHMENTS, MAX_PDF_PAGES, isSupportedAttachment, prepareAttachmentFile } from "@/lib/pdf-to-images";
import type { AiOutput, AssistantMessage, AssistantStatus, ChatAttachment, DocumentFile, PendingAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ModeTabs } from "@/components/studio/mode-tabs";
import { ChatComposer } from "@/components/studio/chat-composer";
import { MessageBubble, TypingBubble } from "@/components/studio/message-bubble";
import { PendingActionCard } from "@/components/studio/pending-action-card";
import { DEMO_DURATION_SECONDS, DEMO_TRANSCRIPT, DOCUMENT_SUGGESTIONS, KIND_LABEL, attachmentPreviews, buildSegments, clock, dateLabel, errorMessage, fileSize, probeAudioDuration, recognitionConstructor, slugify, tempId, type Kind, type SpeechRecognitionLike, type StudioMode } from "@/lib/studio";

export function IAStudio({
  initialMode = "chat",
  embedded = false,
  onClose,
}: {
  initialMode?: StudioMode;
  /** Dentro del drawer: ocupa el alto del panel en vez de la ventana entera. */
  embedded?: boolean;
  onClose?: () => void;
}) {
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const docScrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bookAbortRef = useRef<AbortController | null>(null);

  const [mode, setMode] = useState<StudioMode>(initialMode);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [docMessages, setDocMessages] = useState<AssistantMessage[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [outputs, setOutputs] = useState<AiOutput[]>([]);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [docInput, setDocInput] = useState("");
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const [docAttachments, setDocAttachments] = useState<ChatAttachment[]>([]);
  const [attachingMode, setAttachingMode] = useState<"chat" | "document" | null>(null);
  const [sendingMode, setSendingMode] = useState<"chat" | "document" | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [listening, setListening] = useState(false);
  const [chatDocumentId, setChatDocumentId] = useState("");
  const [docId, setDocId] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docDragging, setDocDragging] = useState(false);
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [openBook, setOpenBook] = useState<OpenBookContext | null>(null);
  const [useBookContext, setUseBookContext] = useState(true);
  const [extractingBook, setExtractingBook] = useState(false);
  const [changingModel, setChangingModel] = useState(false);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioText, setAudioText] = useState("");
  const [audioTitle, setAudioTitle] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioDragging, setAudioDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [savingNotebook, setSavingNotebook] = useState(false);
  const [notebookSaved, setNotebookSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryOutput, setSummaryOutput] = useState<AiOutput | null>(null);
  const [responsePulse, setResponsePulse] = useState(false);
  const responsePulseTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [history, fileList, outputList, assistantStatus] = await Promise.all([
        api.assistantMessages(120),
        api.files(),
        api.studioOutputs(),
        api.assistantStatus(),
      ]);
      setMessages(history);
      setFiles(fileList);
      setOutputs(outputList);
      setStatus(assistantStatus);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // El lector de la Biblioteca y este panel comparten el PDF abierto.
  useEffect(() => {
    setOpenBook(getOpenBook());
    return subscribeOpenBook(setOpenBook);
  }, []);

  useEffect(() => {
    return () => bookAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    const element = mode === "document" ? docScrollRef.current : chatScrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, docMessages, sendingMode, pending, mode]);

  useEffect(() => {
    if (!recording) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [recording]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (responsePulseTimer.current) window.clearTimeout(responsePulseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (mode === "chat") url.searchParams.delete("mode");
    else url.searchParams.set("mode", mode);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [mode]);

  const sourceFiles = useMemo(
    () => files.filter((file) => !outputs.some((output) => output.output_document_id === file.id)),
    [files, outputs],
  );

  const selectedDocument = useMemo(
    () => sourceFiles.find((file) => file.id === docId) ?? null,
    [sourceFiles, docId],
  );

  const audioSegments = useMemo(
    () => buildSegments(audioText, audioDuration || 240),
    [audioText, audioDuration],
  );

  useEffect(() => {
    if (mode !== "document") return;
    if (docId && !sourceFiles.some((file) => file.id === docId)) {
      setDocId("");
      setDocMessages([]);
      return;
    }
    if (!docId && sourceFiles[0]) setDocId(sourceFiles[0].id);
  }, [mode, docId, sourceFiles]);

  useEffect(() => {
    if (chatDocumentId && !sourceFiles.some((file) => file.id === chatDocumentId)) {
      setChatDocumentId("");
    }
  }, [chatDocumentId, sourceFiles]);

  function changeMode(next: StudioMode) {
    if (next === mode) return;
    if (mode === "audio") stopRecording();
    setMode(next);
    setPending(null);
    setNotice(null);
  }

  async function changeModel(model: string) {
    if (!status || changingModel || model === status.model) return;
    setChangingModel(true);
    setNotice(null);
    try {
      const updated = await api.updateAiProfile({ provider: "gemini", model });
      setStatus(updated);
      setNotice(`Modelo de IA actualizado: ${updated.model}`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setChangingModel(false);
    }
  }

  function toggleMicrophone(target: "chat" | "document") {
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
      const clean = transcript.trim();
      if (!clean) return;
      if (target === "document") {
        setDocInput((current) => `${current}${current ? " " : ""}${clean}`);
      } else {
        setChatInput((current) => `${current}${current ? " " : ""}${clean}`);
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

  async function attachFiles(
    files: FileList | File[] | null | undefined,
    target: "chat" | "document",
  ) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;

    const current = target === "chat" ? chatAttachments : docAttachments;
    const room = MAX_ATTACHMENTS - current.length;
    if (room <= 0) {
      setNotice(`Puedes adjuntar hasta ${MAX_ATTACHMENTS} imágenes por mensaje.`);
      return;
    }

    const supported = list.filter(isSupportedAttachment);
    const rejected = list.length - supported.length;
    const valid = supported.slice(0, room);
    const ignored = supported.length - valid.length;
    const warnings: string[] = [];
    if (ignored > 0) {
      warnings.push(
        `Se han ignorado ${ignored} archivo(s): el máximo es ${MAX_ATTACHMENTS} adjuntos por mensaje.`,
      );
    }
    if (rejected > 0) {
      warnings.push("Solo se admiten imágenes PNG, JPG, WEBP o PDF.");
    }
    if (valid.length === 0) {
      if (warnings.length > 0) setNotice(warnings.join(" "));
      return;
    }

    setAttachingMode(target);
    setNotice(warnings.length > 0 ? warnings.join(" ") : null);
    try {
      const prepared: ChatAttachment[] = [];
      for (const file of valid) {
        prepared.push(...(await prepareAttachmentFile(file)));
      }

      const next = prepared.slice(0, room);
      if (prepared.length > room) {
        warnings.push(
          `Se han añadido los primeros ${room} adjuntos: el máximo es ${MAX_ATTACHMENTS} por mensaje.`,
        );
      } else {
        const truncated = new Set(
          prepared
            .filter((item) => item.total_pages && item.total_pages > MAX_PDF_PAGES)
            .map((item) => item.name),
        );
        if (truncated.size > 0) {
          const names = [...truncated].map((name) => `«${name}»`).join(" y ");
          warnings.push(
            `Se han añadido las primeras ${MAX_PDF_PAGES} páginas de ${names}.`,
          );
        }
      }
      setNotice(warnings.length > 0 ? warnings.join(" ") : null);
      if (next.length === 0) return;

      if (target === "chat") {
        setChatAttachments((previous) => [...previous, ...next]);
      } else {
        setDocAttachments((previous) => [...previous, ...next]);
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setAttachingMode(null);
    }
  }

  function removeAttachment(target: "chat" | "document", index: number) {
    const setter = target === "chat" ? setChatAttachments : setDocAttachments;
    setter((current) => current.filter((_, position) => position !== index));
  }

  /** Destello breve del fondo cuando la IA termina de responder. */
  function markResponsePulse() {
    setResponsePulse(true);
    if (responsePulseTimer.current) window.clearTimeout(responsePulseTimer.current);
    responsePulseTimer.current = window.setTimeout(() => setResponsePulse(false), 1800);
  }

  async function sendChat(override?: string) {
    const content = (override ?? chatInput).trim();
    const attachments = chatAttachments;
    if ((!content && attachments.length === 0) || sendingMode !== null) return;

    const optimistic: AssistantMessage = {
      id: tempId("temp"),
      role: "user",
      content,
      source: null,
      document_id: chatDocumentId || null,
      attachments: attachmentPreviews(attachments),
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setChatInput("");
    setChatAttachments([]);
    setSendingMode("chat");
    setPending(null);
    setNotice(null);

    // Contexto invisible: el texto se extrae en el navegador y viaja al modelo
    // en un campo aparte, así ni la burbuja ni el historial guardado lo muestran.
    let pageContext: string | null = null;
    let pageContextLabel: string | null = null;
    const book = openBook;
    const abort = book && useBookContext ? new AbortController() : null;
    let abortTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      if (book && abort) {
        bookAbortRef.current = abort;
        abortTimer = setTimeout(() => abort.abort(), 20_000);
        setExtractingBook(true);
        try {
          const { extractBookText } = await import("@/lib/book-text");
          const extracted = await extractBookText(book, { signal: abort.signal });
          if (extracted.hasText) {
            pageContext = extracted.text;
            const chapter = extracted.chapterTitle
              ? `«${extracted.chapterTitle}» · `
              : "";
            pageContextLabel = `${extracted.bookTitle} · ${chapter}págs. ${extracted.startPage}-${extracted.endPage}`;
          } else {
            setNotice(
              "Este PDF no tiene texto seleccionable (parece escaneado). Adjunta la página como imagen para que la IA pueda leerla.",
            );
          }
        } catch (error) {
          setNotice(
            abort.signal.aborted
              ? "La lectura del PDF tardó demasiado: he enviado tu pregunta sin el texto."
              : `No se pudo leer el PDF: ${errorMessage(error)}`,
          );
        } finally {
          if (abortTimer) clearTimeout(abortTimer);
          if (bookAbortRef.current === abort) bookAbortRef.current = null;
          setExtractingBook(false);
        }
      }

      const response = await api.chat(
        content,
        chatDocumentId || null,
        attachments,
        pageContext,
        pageContextLabel,
      );
      if (response.pending_action) setPending(response.pending_action);
      setMessages(await api.assistantMessages(120));
      markResponsePulse();
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setChatInput(content);
      setChatAttachments(attachments);
      setNotice(errorMessage(error));
    } finally {
      setSendingMode(null);
    }
  }

  function askAboutBook(prompt: string) {
    if (sendingMode !== null) return;
    void sendChat(prompt);
  }

  async function sendDocument() {
    const content = docInput.trim();
    const attachments = docAttachments;
    if ((!content && attachments.length === 0) || !docId || sendingMode !== null) return;
    const optimistic: AssistantMessage = {
      id: tempId("doc"),
      role: "user",
      content,
      source: null,
      document_id: docId,
      attachments: attachmentPreviews(attachments),
      created_at: new Date().toISOString(),
    };
    setDocMessages((current) => [...current, optimistic]);
    setDocInput("");
    setDocAttachments([]);
    setSendingMode("document");
    setPending(null);
    setNotice(null);
    try {
      const response = await api.chat(content, docId, attachments);
      if (response.pending_action) setPending(response.pending_action);
      setDocMessages((current) => [
        ...current,
        {
          id: tempId("doc-assistant"),
          role: "assistant",
          content: response.reply,
          source: response.source,
          document_id: response.document_id,
          created_at: response.created_at || new Date().toISOString(),
        },
      ]);
      markResponsePulse();
    } catch (error) {
      setDocMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setDocInput(content);
      setDocAttachments(attachments);
      setNotice(errorMessage(error));
    } finally {
      setSendingMode(null);
    }
  }

  async function confirmPending(approve: boolean) {
    if (!pending || confirming) return;
    setConfirming(true);
    setNotice(null);
    try {
      const result = await api.confirmAction(pending.tool, pending.args, approve);
      setPending(null);
      if (mode === "document") {
        setDocMessages((current) => [
          ...current,
          {
            id: tempId("doc-confirm"),
            role: "assistant",
            content: result.reply,
            source: result.source,
            document_id: result.document_id,
            created_at: result.created_at || new Date().toISOString(),
          },
        ]);
      } else {
        setMessages(await api.assistantMessages(120));
      }
      markResponsePulse();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setConfirming(false);
    }
  }

  async function clearChat() {
    if (clearing) return;
    setClearing(true);
    try {
      await api.clearAssistant();
      setMessages([]);
      setDocMessages([]);
      setChatAttachments([]);
      setDocAttachments([]);
      setPending(null);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setClearing(false);
    }
  }

  async function exportChat() {
    if (exporting) return;
    setExporting(true);
    setNotice(null);
    try {
      const history = await api.assistantExport();
      const payload = {
        app: "Academic Autopilot",
        kind: "assistant-chat",
        version: 1,
        exported_at: new Date().toISOString(),
        messages: history.map((message) => ({
          role: message.role,
          content: message.content,
          created_at: message.created_at,
        })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `chat-ia-studio-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  async function importChat(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setNotice(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const rawList = Array.isArray(parsed)
        ? parsed
        : ((parsed as { messages?: unknown }).messages ?? []);
      if (!Array.isArray(rawList) || rawList.length === 0) {
        setNotice("El archivo no contiene mensajes compatibles.");
        return;
      }
      const imported = rawList
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
          (item): item is { role: string; content: string; created_at: string | null } =>
            item !== null,
        )
        .slice(0, 2000);
      if (imported.length === 0) {
        setNotice("El archivo no contiene mensajes compatibles.");
        return;
      }
      await api.assistantImport(imported);
      setMessages(await api.assistantMessages(120));
      setNotice(`Importados ${imported.length} mensajes.`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setNotice("El archivo no es un chat válido (JSON).");
      } else {
        setNotice(errorMessage(error));
      }
    } finally {
      setImporting(false);
    }
  }

  function selectDocument(id: string) {
    setDocId(id);
    setDocMessages([]);
    setPending(null);
    setNotice(null);
  }

  async function uploadDocument(file: File | null | undefined) {
    if (!file || uploadingDoc) return;
    setUploadingDoc(true);
    setNotice(null);
    try {
      const uploaded = await api.uploadFile(file);
      const fileList = await api.files();
      setFiles(fileList);
      setDocId(uploaded.id);
      setDocMessages([]);
      setPending(null);
      setNotice(`«${uploaded.filename}» listo. Pregúntame lo que quieras sobre él.`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setUploadingDoc(false);
    }
  }

  async function generate(kind: Kind) {
    if (!docId || busyKind !== null) return;
    setBusyKind(`${docId}:${kind}`);
    setNotice(null);
    try {
      const output = await api.generateStudio(docId, kind);
      setNotice(`Generado: ${output.title}`);
      const [fileList, outputList] = await Promise.all([api.files(), api.studioOutputs()]);
      setFiles(fileList);
      setOutputs(outputList);
      setDocMessages((current) => [
        ...current,
        {
          id: tempId("doc-studio"),
          role: "assistant",
          content: `He generado «${output.title}». Puedes descargarlo en PDF o Word desde el panel de documentos.`,
          source: "studio",
          document_id: output.output_document_id,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusyKind(null);
    }
  }

  async function removeOutput(id: string) {
    setNotice(null);
    try {
      await api.deleteStudioOutput(id);
      setOutputs(await api.studioOutputs());
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  function downloadPdf(output: AiOutput) {
    if (!output.output_document_id) return;
    void api
      .downloadFile(output.output_document_id, `${output.title}.pdf`)
      .catch((error) => setNotice(errorMessage(error)));
  }

  function downloadWord(output: AiOutput) {
    void api
      .downloadStudioWord(output.id, `${output.title}.docx`)
      .catch((error) => setNotice(errorMessage(error)));
  }

  function chooseAudio(next: File | null) {
    setAudioFile(next);
    setAudioText("");
    setAudioTitle("");
    setAudioDuration(0);
    setNotebookSaved(false);
    setSummaryOutput(null);
    setNotice(null);
    if (next) {
      void probeAudioDuration(next).then((duration) => {
        if (duration > 0) setAudioDuration(duration);
      });
    }
  }

  async function transcribeAudio(target?: File, durationHint?: number) {
    const file = target ?? audioFile;
    if (!file) {
      setNotice("Selecciona primero un archivo de audio.");
      return;
    }
    setAudioLoading(true);
    setNotice(null);
    setAudioText("");
    setNotebookSaved(false);
    setSummaryOutput(null);
    try {
      const result = await api.transcribe(file);
      setAudioFile(file);
      setAudioText(result.text);
      setAudioTitle(
        `Clase transcrita ${new Date().toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
        })}`,
      );
      let duration = durationHint ?? audioDuration;
      if (!duration) duration = await probeAudioDuration(file);
      setAudioDuration(duration || 240);
      setNotice("Transcripción lista. Revísala, guárdala o resúmela con IA.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setAudioLoading(false);
    }
  }

  async function startRecording() {
    if (recording) return;
    setNotice(null);
    setAudioText("");
    setAudioFile(null);
    setAudioDuration(0);
    setNotebookSaved(false);
    setSummaryOutput(null);
    setSeconds(0);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setNotice("Tu navegador no permite grabar audio. Sube un archivo en su lugar.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType = candidates.find(
        (type) =>
          typeof MediaRecorder.isTypeSupported !== "function" ||
          MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const file = new File([blob], `grabacion-${stamp}.${extension}`, { type });
        audioChunksRef.current = [];
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        const finalSeconds = Math.max(
          1,
          Math.round((Date.now() - recordStartedAtRef.current) / 1000),
        );
        setRecording(false);
        setSeconds(finalSeconds);
        setAudioFile(file);
        setAudioDuration(finalSeconds);
        void transcribeAudio(file, finalSeconds);
      };
      recordStartedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch {
      setNotice("No se pudo acceder al micrófono. Revisa los permisos o sube un archivo.");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      return;
    }
    recorder.stop();
  }

  function loadDemoTranscript() {
    setAudioFile(null);
    setAudioText(DEMO_TRANSCRIPT);
    setAudioTitle(
      `Clase de ejemplo ${new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
      })}`,
    );
    setAudioDuration(DEMO_DURATION_SECONDS);
    setNotebookSaved(false);
    setSummaryOutput(null);
    setNotice("Transcripción de ejemplo cargada. Puedes guardarla o resumirla con IA.");
  }

  async function saveNotebook() {
    if (!audioText.trim() || savingNotebook) return;
    setSavingNotebook(true);
    setNotice(null);
    try {
      const title = audioTitle.trim() || "Clase transcrita";
      await api.createNotebook({
        title,
        color: "#0066FF",
        content: `# ${title}\n\n${audioText}`,
      });
      setNotebookSaved(true);
      setNotice("Guardado en Cuadernos.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSavingNotebook(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(audioText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("No se pudo copiar al portapapeles.");
    }
  }

  async function summarizeTranscript() {
    const text = audioText.trim();
    if (!text || summarizing) return;
    setSummarizing(true);
    setNotice(null);
    try {
      const title = audioTitle.trim() || "Transcripción de clase";
      const file = new File([`# ${title}\n\n${text}`], `${slugify(title)}.txt`, {
        type: "text/plain",
      });
      const uploaded = await api.uploadFile(file);
      const output = await api.generateStudio(uploaded.id, "summary");
      setSummaryOutput(output);
      const [fileList, outputList] = await Promise.all([api.files(), api.studioOutputs()]);
      setFiles(fileList);
      setOutputs(outputList);
      setNotice("Resumen generado. Puedes descargarlo en PDF o Word.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSummarizing(false);
    }
  }

  const sendingChat = sendingMode === "chat";
  const sendingDocument = sendingMode === "document";
  const hasConversation = messages.length > 0 || docMessages.length > 0;
  const aiState: "idle" | "thinking" | "responding" =
    sendingMode !== null || confirming || summarizing || busyKind !== null || audioLoading
      ? "thinking"
      : responsePulse
        ? "responding"
        : "idle";

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden",
        embedded
          ? "h-full min-h-0"
          : "h-[calc(100dvh-var(--mobile-header-height))] min-h-[620px] lg:h-dvh",
      )}
    >
      <div className="studio-canvas" data-ai-state={aiState} aria-hidden="true">
        <div className="studio-base" />
        <div className="studio-aurora" />
        <div className="studio-aurora studio-aurora-alt" />
        {responsePulse && <div className="studio-response-flash" />}
        <div className="studio-vignette" />
      </div>

      <StudioHeader
        status={status}
        changingModel={changingModel}
        changeModel={changeModel}
        embedded={embedded}
        aiState={aiState}
        mode={mode}
        importInputRef={importInputRef}
        importChat={importChat}
        importing={importing}
        exportChat={exportChat}
        messages={messages}
        exporting={exporting}
        clearChat={clearChat}
        clearing={clearing}
        hasConversation={hasConversation}
        onClose={onClose}
      />

      <ModeTabs mode={mode} onChange={changeMode} />

      {status && !status.configured && (
        <div className="relative z-10 mx-3 mt-1.5 flex items-start gap-2 rounded-2xl border border-amber-400/35 bg-amber-100/50 px-3 py-2 text-[11px] leading-5 text-slate-600 backdrop-blur-xl dark:border-amber-400/20 dark:bg-amber-500/[0.08] dark:text-white/55 sm:mx-5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
          <span>
            La IA no está configurada.{" "}
            <Link href="/settings" className="font-semibold underline underline-offset-2">
              Elige un motor en Ajustes
            </Link>{" "}
            para respuestas reales; mientras tanto uso el motor local de reglas.
          </span>
        </div>
      )}

      {notice && (
        <div className="relative z-10 mx-3 mb-1 mt-1.5 flex items-start gap-2 rounded-2xl border border-slate-300/40 bg-slate-100/65 px-3 py-2 text-[11px] text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-black/35 dark:text-white/60 sm:mx-5">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            <X className="h-3.5 w-3.5 opacity-50" />
          </button>
        </div>
      )}

      {mode === "chat" && (
        <StudioChatPanel
          chatScrollRef={chatScrollRef}
          embedded={embedded}
          loading={loading}
          messages={messages}
          pending={pending}
          setChatInput={setChatInput}
          status={status}
          sendingChat={sendingChat}
          confirming={confirming}
          confirmPending={confirmPending}
          openBook={openBook}
          useBookContext={useBookContext}
          setUseBookContext={setUseBookContext}
          askAboutBook={askAboutBook}
          sourceFiles={sourceFiles}
          chatDocumentId={chatDocumentId}
          setChatDocumentId={setChatDocumentId}
          chatInput={chatInput}
          sendChat={sendChat}
          listening={listening}
          toggleMicrophone={toggleMicrophone}
          chatAttachments={chatAttachments}
          attachFiles={attachFiles}
          removeAttachment={removeAttachment}
          attachingMode={attachingMode}
        />
      )}

      {mode === "audio" && (
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
      )}

      {mode === "document" && (
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
      )}
    </div>
  );
}

export type { StudioMode } from "@/lib/studio";
