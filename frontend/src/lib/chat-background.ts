import type { CSSProperties } from "react";

/** Fondo aplicado al hilo de una conversación. */
export interface ChatBackground {
  id: string;
  label: string;
  /** Valor CSS de `background-image` (gradiente, patrón o `url(...)`). */
  image: string | null;
  size: string;
  position: string;
  repeat: "repeat" | "no-repeat";
  /** Capa opcional para oscurecer una foto y mantener legible el texto. */
  overlay: string;
}

export const DEFAULT_CHAT_BACKGROUND: ChatBackground = {
  id: "none",
  label: "Predeterminado",
  image: null,
  size: "auto",
  position: "center",
  repeat: "no-repeat",
  overlay: "transparent",
};

export const CHAT_BACKGROUND_PRESETS: ChatBackground[] = [
  DEFAULT_CHAT_BACKGROUND,
  {
    id: "blue",
    label: "Azul suave",
    image: "linear-gradient(160deg, #eef4ff 0%, #dbeafe 50%, #e0f2fe 100%)",
    size: "cover",
    position: "center",
    repeat: "no-repeat",
    overlay: "transparent",
  },
  {
    id: "mint",
    label: "Menta",
    image: "linear-gradient(160deg, #ecfdf5 0%, #d1fae5 55%, #ccfbf1 100%)",
    size: "cover",
    position: "center",
    repeat: "no-repeat",
    overlay: "transparent",
  },
  {
    id: "sunset",
    label: "Atardecer",
    image: "linear-gradient(160deg, #fff7ed 0%, #ffe4e6 55%, #fef3c7 100%)",
    size: "cover",
    position: "center",
    repeat: "no-repeat",
    overlay: "transparent",
  },
  {
    id: "lavender",
    label: "Lavanda",
    image: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 55%, #fce7f3 100%)",
    size: "cover",
    position: "center",
    repeat: "no-repeat",
    overlay: "transparent",
  },
  {
    id: "dots",
    label: "Puntos",
    image:
      "radial-gradient(circle at 1px 1px, rgba(71,85,105,0.20) 1.2px, transparent 0)",
    size: "18px 18px",
    position: "top left",
    repeat: "repeat",
    overlay: "transparent",
  },
  {
    id: "grid",
    label: "Cuadrícula",
    image:
      "linear-gradient(rgba(100,116,139,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.14) 1px, transparent 1px)",
    size: "28px 28px",
    position: "top left",
    repeat: "repeat",
    overlay: "transparent",
  },
  {
    id: "diagonal",
    label: "Diagonal",
    image:
      "repeating-linear-gradient(135deg, rgba(148,163,184,0.14) 0 10px, transparent 10px 22px)",
    size: "auto",
    position: "center",
    repeat: "repeat",
    overlay: "transparent",
  },
];

const STORAGE_PREFIX = "academic-autopilot-chat-background:";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1920;

function isChatBackground(value: unknown): value is ChatBackground {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    (candidate.image === null || typeof candidate.image === "string") &&
    typeof candidate.size === "string" &&
    typeof candidate.position === "string" &&
    (candidate.repeat === "repeat" || candidate.repeat === "no-repeat") &&
    typeof candidate.overlay === "string"
  );
}

export function loadChatBackground(conversationId: string): ChatBackground {
  if (!conversationId || typeof window === "undefined") {
    return DEFAULT_CHAT_BACKGROUND;
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${conversationId}`);
    if (!raw) return DEFAULT_CHAT_BACKGROUND;
    const parsed: unknown = JSON.parse(raw);
    if (!isChatBackground(parsed)) return DEFAULT_CHAT_BACKGROUND;
    return parsed;
  } catch {
    return DEFAULT_CHAT_BACKGROUND;
  }
}

export function saveChatBackground(
  conversationId: string,
  background: ChatBackground,
): void {
  if (!conversationId) return;
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${conversationId}`,
      JSON.stringify(background),
    );
  } catch {
    throw new Error(
      "No hay espacio para guardar esta imagen. Prueba con una foto más pequeña.",
    );
  }
}

export function backgroundStyle(
  background: ChatBackground | null | undefined,
): CSSProperties | undefined {
  if (!background?.image) return undefined;
  const layers =
    background.overlay && background.overlay !== "transparent"
      ? `${background.overlay}, ${background.image}`
      : background.image;
  return {
    backgroundImage: layers,
    backgroundSize: background.size,
    backgroundPosition: background.position,
    backgroundRepeat: background.repeat,
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = url;
  });
}

/** Optimiza la foto elegida y la convierte en un fondo guardable. */
export async function imageBackgroundFromFile(
  file: File,
): Promise<ChatBackground> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elige una imagen JPG, PNG o WebP.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("La imagen supera 15 MB. Usa una más pequeña.");
  }

  const image = await loadImageElement(file);
  const scale = Math.min(
    1,
    MAX_EDGE / Math.max(1, image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no permite procesar la imagen.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.84);

  return {
    id: `custom-${Date.now()}`,
    label: "Mi imagen",
    image: `url("${dataUrl}")`,
    size: "cover",
    position: "center",
    repeat: "no-repeat",
    overlay:
      "linear-gradient(rgba(15,23,42,0.16), rgba(15,23,42,0.16))",
  };
}
