"use client";

import { useRef, useState } from "react";
import {
  AudioLines,
  Check,
  Copy,
  FileAudio,
  Loader2,
  NotebookPen,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export default function TranscribePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function transcribe() {
    if (!file) {
      setNotice("Selecciona primero un archivo de audio.");
      return;
    }
    setLoading(true);
    setNotice(null);
    setText("");
    setSaved(false);
    try {
      const result = await api.transcribe(file);
      setText(result.text);
      setTitle(
        `Clase transcrita ${new Date().toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
        })}`,
      );
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveNotebook() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.createNotebook({
        title: title.trim() || "Clase transcrita",
        color: "#8b5cf6",
        content: `# ${title.trim() || "Clase transcrita"}\n\n${text}`,
      });
      setSaved(true);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("No se pudo copiar al portapapeles.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 animate-fade-up">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <AudioLines className="h-6 w-6 text-fuchsia-600" />
          Transcribir una clase
        </h1>
        <p className="text-sm text-muted-foreground">
          Sube la grabación y obtén el texto completo para guardarlo como cuaderno y estudiarlo
          después.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/40 p-8 text-center transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-50"
        >
          <UploadCloud className="h-9 w-9 text-fuchsia-400" />
          <span className="font-semibold text-slate-700">
            {file ? file.name : "Pulsa para elegir un audio"}
          </span>
          <span className="text-xs text-muted-foreground">
            MP3, M4A, WAV, OGG, WEBM o MP4 · máximo 24 MB
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.m4a,.wav,.ogg,.webm,.mp4,.mpeg,.mpga,.flac,audio/*"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setText("");
            setNotice(null);
          }}
        />
        <Button className="mt-4 w-full" onClick={transcribe} disabled={loading || !file}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileAudio className="h-4 w-4" />}
          {loading ? "Transcribiendo... puede tardar unos minutos" : "Transcribir audio"}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          La transcripción usa Whisper de OpenAI. Configura una clave de OpenAI en Ajustes para que
          funcione (los proveedores sin audio devolverán un aviso).
        </p>
      </section>

      {notice && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {notice}
        </p>
      )}

      {text && (
        <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Transcripción
            </h2>
            <Button variant="secondary" size="sm" onClick={copyText}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-[280px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-6 outline-none focus:border-fuchsia-300 focus:bg-white"
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[220px] flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-600">Título del cuaderno</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-300"
                placeholder="Clase de Historia"
              />
            </label>
            <Button onClick={saveNotebook} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <NotebookPen className="h-4 w-4" />}
              {saved ? "Guardado" : "Guardar como cuaderno"}
            </Button>
          </div>
          {saved && (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> Guardado en Cuadernos. Ya puedes generar flashcards o un
              resumen.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
