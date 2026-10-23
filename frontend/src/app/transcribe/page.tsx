"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  Copy,
  FileAudio,
  Loader2,
  Mic,
  NotebookPen,
  Square,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Segment = { at: string; text: string };

// La transcripción de demostración tiene 11 fragmentos: 36 s permiten que las
// marcas de tiempo y la duración que se muestra en la cabecera coincidan.
const DEMO_DURATION_SECONDS = 36;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function buildSegments(text: string, duration: number): Segment[] {
  const chunks = text
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunks.length === 0) return [];
  const totalWords = chunks.reduce((sum, chunk) => sum + chunk.split(/\s+/).length, 0) || 1;
  let cursor = 0;
  return chunks.map((chunk) => {
    const words = chunk.split(/\s+/).length;
    const at = clock(cursor);
    cursor += Math.max(3, (words / totalWords) * Math.max(duration, 30));
    return { at, text: chunk };
  });
}

const DEMO_TRANSCRIPT = `Hoy vamos a repasar los conceptos principales de la unidad. Primero recordamos qué es una red local y por qué se utiliza en pequeñas empresas y aulas.

Una red local conecta dispositivos dentro de un área limitada. Comparte recursos como impresoras, archivos y conexión a internet. La topología más habitual en clase es la estrella, porque cada equipo se conecta a un switch central.

El switch trabaja en la capa de enlace y aprende las direcciones MAC de los dispositivos. El router, en cambio, permite salir a otras redes y trabaja con direcciones IP.

Para el examen tenéis que distinguir entre dirección MAC y dirección IP, identificar los medios físicos como el cable de par trenzado y explicar para qué sirve un punto de acceso inalámbrico.

Recordad que el cableado estructurado debe seguir las normas de instalación y que conviene etiquetar cada latiguillo. En la práctica revisaremos el panel de parcheo y probaremos la conectividad con ping.

La próxima clase haremos un supuesto práctico de configuración básica y resolveremos dudas del cuaderno.`;

export default function TranscribePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);

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

  const segments = useMemo(() => buildSegments(text, duration || 240), [text, duration]);

  function chooseFile(next: File | null) {
    setFile(next);
    setText("");
    setSaved(false);
    setNotice(null);
    setDuration(0);
  }

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
      setDuration(240);
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

  function startRecording() {
    setFile(null);
    setText("");
    setSaved(false);
    setNotice(null);
    setSeconds(0);
    setDuration(0);
    setRecording(true);
  }

  function stopRecording() {
    const finalSeconds = Math.max(seconds, DEMO_DURATION_SECONDS);
    setRecording(false);
    setSeconds(finalSeconds);
    setDuration(finalSeconds);
    setText(DEMO_TRANSCRIPT);
    setTitle(
      `Clase grabada ${new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
      })}`,
    );
    setNotice("Grabación simulada: revisa el texto y guárdalo como cuaderno si te sirve.");
  }

  async function saveNotebook() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.createNotebook({
        title: title.trim() || "Clase transcrita",
        color: "#0066FF",
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
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("No se pudo copiar al portapapeles.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-10">
      <header className="app-glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0066FF] dark:text-[#8ab9ff]">
              Audio a apuntes
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-[28px] font-semibold tracking-[-0.045em] text-slate-900 dark:text-white/95">
              <AudioLines className="h-7 w-7 text-[#0066FF]" />
              Transcribir
            </h1>
            <p className="mt-1 max-w-xl text-[12px] leading-5 text-slate-500 dark:text-white/40">
              Sube una grabación o simula una clase. El resultado se muestra como un texto de
              lectura con marcas de tiempo y se puede guardar en Cuadernos.
            </p>
          </div>
          <Badge
            variant="secondary"
            className="rounded-full border border-white/50 bg-white/45 px-3 py-1 text-[10px] font-semibold text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white/45"
          >
            Whisper · español
          </Badge>
        </div>
      </header>

      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-[#0066FF]/20 bg-[#0066FF]/[0.06] px-4 py-3 text-[12px] text-slate-600 backdrop-blur-2xl dark:text-white/60">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            <Check className="h-3.5 w-3.5 opacity-50" />
          </button>
        </div>
      )}

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="app-glass rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                Archivo de audio
              </p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
                Suelta o elige una grabación
              </h2>
            </div>
            <FileAudio className="h-5 w-5 text-slate-300 dark:text-white/20" />
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "mt-4 flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-9 text-center transition-all duration-200",
              dragging
                ? "border-[#0066FF]/60 bg-[#0066FF]/10"
                : "border-white/30 bg-white/20 hover:border-white/60 hover:bg-white/35 dark:border-white/15 dark:bg-white/[0.025] dark:hover:border-white/30 dark:hover:bg-white/[0.05]",
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/50 text-[#0066FF] shadow-sm backdrop-blur-xl dark:bg-white/10 dark:text-[#8ab9ff]">
              <UploadCloud className="h-6 w-6" />
            </span>
            <span className="mt-3 text-[13px] font-semibold text-slate-700 dark:text-white/80">
              {file ? file.name : "Arrastra un MP3, M4A, WAV, OGG o WEBM"}
            </span>
            <span className="mt-1 text-[10.5px] text-slate-500 dark:text-white/35">
              Máximo 24 MB · el audio no se guarda en la biblioteca
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,.m4a,.wav,.ogg,.webm,.mp4,.mpeg,.mpga,.flac,audio/*"
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-slate-400 dark:text-white/30">
              {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB listos` : "Ningún archivo seleccionado"}
            </p>
            <Button onClick={() => void transcribe()} disabled={loading || !file} className="h-9 rounded-full px-4">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileAudio className="h-4 w-4" />}
              {loading ? "Transcribiendo…" : "Transcribir audio"}
            </Button>
          </div>
        </div>

        <div className="app-glass rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                Simulador
              </p>
              <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
                Grabar clase
              </h2>
            </div>
            <span
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold",
                recording
                  ? "bg-[#FF3B30]/12 text-[#d92b22] dark:bg-[#FF3B30]/15 dark:text-[#ff8a80]"
                  : "bg-white/45 text-slate-500 dark:bg-white/[0.06] dark:text-white/45",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", recording ? "animate-pulse bg-[#FF3B30]" : "bg-slate-400 dark:bg-white/30")} />
              {recording ? "Grabando" : "Listo"}
            </span>
          </div>

          <div className="mt-4 rounded-3xl border border-white/40 bg-slate-900/[0.03] p-4 dark:border-white/10 dark:bg-black/20">
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
                    height: recording ? `${16 + ((index * 13) % 42)}px` : `${8 + ((index * 7) % 18)}px`,
                    animationDelay: `${(index % 9) * 0.08}s`,
                    animationDuration: `${0.65 + (index % 5) * 0.12}s`,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-white/35">
              <span className="font-medium tabular-nums text-slate-700 dark:text-white/70">{clock(seconds)}</span>
              <span>{recording ? "Escuchando…" : "Simulación local"}</span>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {recording ? (
              <Button variant="destructive" className="h-9 flex-1 rounded-full" onClick={stopRecording}>
                <Square className="h-3.5 w-3.5" /> Detener y generar texto
              </Button>
            ) : (
              <Button className="h-9 flex-1 rounded-full" onClick={startRecording}>
                <Mic className="h-4 w-4" /> Grabar clase
              </Button>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-400 dark:text-white/30">
            El simulador genera una transcripción de demostración con marcas de tiempo. Para una
            transcripción real, sube un archivo de audio.
          </p>
        </div>
      </section>

      {text && (
        <section className="app-glass overflow-hidden rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/45 px-4 py-3 dark:border-white/10 sm:px-5">
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                Modo lectura
              </p>
              <h2 className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
                {title || "Clase transcrita"}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-white/45 bg-white/40 px-2.5 py-1 text-[9.5px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/45">
                {clock(duration)} · {segments.length} fragmentos
              </span>
              <Button variant="secondary" size="sm" onClick={() => void copyText()} className="h-8">
                {copied ? <Check className="h-3.5 w-3.5 text-[#34C759]" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>

          <article className="max-h-[520px] overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-5">
              {segments.map((segment, index) => (
                <div key={`${segment.at}-${index}`} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
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

          <div className="border-t border-white/45 px-4 py-4 dark:border-white/10 sm:px-5">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] flex-1">
                <span className="mb-1 block text-[10px] font-medium text-slate-500 dark:text-white/40">
                  Título del cuaderno
                </span>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Clase de redes"
                  className="h-9"
                />
              </label>
              <Button onClick={() => void saveNotebook()} disabled={saving} className="h-9 rounded-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <NotebookPen className="h-4 w-4" />}
                {saved ? "Guardado" : "Guardar como cuaderno"}
              </Button>
            </div>
            {saved && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#1a9e3a] dark:text-[#7ee69a]">
                <Check className="h-3.5 w-3.5" /> Guardado en Cuadernos. Ya puedes generar flashcards o un resumen.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
