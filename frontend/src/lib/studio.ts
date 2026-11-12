import { AudioLines, FileText, GraduationCap, type LucideIcon } from "lucide-react";

import { ApiError } from "@/lib/api";
import type { ChatAttachment } from "@/lib/types";

export type StudioMode = "chat" | "audio" | "document";

export type Kind = "summary" | "infographic" | "mindmap";
export type Segment = { at: string; text: string };

export const MODES: {
  id: StudioMode;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  hint: string;
}[] = [
  {
    id: "chat",
    label: "Chat Tutor SMR",
    shortLabel: "Chat",
    icon: GraduationCap,
    hint: "Dudas de clase, problemas y comandos",
  },
  {
    id: "audio",
    label: "Transcribir Audio",
    shortLabel: "Audio",
    icon: AudioLines,
    hint: "Grabaciones de clase a texto y resumen",
  },
  {
    id: "document",
    label: "Analizar Documento",
    shortLabel: "Documento",
    icon: FileText,
    hint: "Chatea con tus apuntes y exámenes",
  },
];

export const KIND_LABEL: Record<string, string> = {
  summary: "Resumen",
  infographic: "Infografía",
  mindmap: "Mapa mental",
};

export const CHAT_SUGGESTIONS = [
  "¿Qué tareas tengo esta semana?",
  "Ayúdame a planificar el estudio de hoy.",
  "Explícame las redes locales con un ejemplo.",
  "¿Cómo puedo preparar el próximo examen?",
];

export const DOCUMENT_SUGGESTIONS = [
  "Resume este documento en 5 ideas.",
  "Hazme 10 preguntas de repaso.",
  "¿Qué conceptos entran en el examen?",
  "Explícame la parte que no entiendo.",
];

export const DEMO_DURATION_SECONDS = 36;

export const DEMO_TRANSCRIPT = `Hoy vamos a repasar los conceptos principales de la unidad. Primero recordamos qué es una red local y por qué se utiliza en pequeñas empresas y aulas.

Una red local conecta dispositivos dentro de un área limitada. Comparte recursos como impresoras, archivos y conexión a internet. La topología más habitual en clase es la estrella, porque cada equipo se conecta a un switch central.

El switch trabaja en la capa de enlace y aprende las direcciones MAC de los dispositivos. El router, en cambio, permite salir a otras redes y trabaja con direcciones IP.

Para el examen tenéis que distinguir entre dirección MAC y dirección IP, identificar los medios físicos como el cable de par trenzado y explicar para qué sirve un punto de acceso inalámbrico.

Recordad que el cableado estructurado debe seguir las normas de instalación y que conviene etiquetar cada latiguillo. En la práctica revisaremos el panel de parcheo y probaremos la conectividad con ping.

La próxima clase haremos un supuesto práctico de configuración básica y resolveremos dudas del cuaderno.`;

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return "No se pudo conectar con la IA. Comprueba tu conexión e inténtalo de nuevo.";
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export function tempId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function attachmentPreviews(items: ChatAttachment[]): ChatAttachment[] {
  return items.map((item) => ({
    name: item.name,
    mime_type: item.mime_type,
    preview: item.preview ?? null,
    page: item.page ?? null,
    total_pages: item.total_pages ?? null,
  }));
}

export function attachmentCaption(item: ChatAttachment): string {
  if (item.page) {
    return `Página ${item.page}${item.total_pages ? ` de ${item.total_pages}` : ""}`;
  }
  return item.name;
}

export function dateLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function buildSegments(text: string, duration: number): Segment[] {
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

export function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "transcripcion"
  );
}

export function probeAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(0);
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      finish(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}
