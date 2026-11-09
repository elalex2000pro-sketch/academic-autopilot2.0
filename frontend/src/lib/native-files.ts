// Guardar y abrir adjuntos del chat.
//
// En la app de escritorio se usa el puente de Electron: `Guardar` abre el
// diálogo nativo del sistema y `Abrir` lanza el archivo con el programa
// predeterminado. En la web se mantiene un fallback equivalente con descarga y
// una pestaña nueva.

export interface NativeFileResult {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

export interface NativeFilesBridge {
  save: (payload: {
    name: string;
    data: ArrayBuffer;
    mimeType?: string;
  }) => Promise<NativeFileResult>;
  open: (payload: {
    name: string;
    data: ArrayBuffer;
    mimeType?: string;
  }) => Promise<NativeFileResult>;
}

function getBridge(): NativeFilesBridge | null {
  if (typeof window === "undefined") return null;
  return window.autopilotDesktop?.files ?? null;
}

export function isNativeFileHost(): boolean {
  return getBridge() !== null;
}

/** Nombre seguro para el sistema de archivos (sin rutas ni caracteres raros). */
export function safeFileName(value: string): string {
  const cleaned = (value || "adjunto")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return cleaned || "adjunto";
}

function downloadInBrowser(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function openInBrowser(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank");
  if (popup) {
    popup.opener = null;
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.download = safeFileName(name);
    link.click();
  }
  // El navegador necesita la URL viva mientras carga la pestaña o el visor.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Abre el diálogo «Guardar como…» del sistema. Devuelve `browser` cuando no
 * existe el puente de escritorio y se usó la descarga del navegador.
 */
export async function saveFileAs(
  blob: Blob,
  name: string,
): Promise<"saved" | "canceled" | "browser"> {
  const bridge = getBridge();
  const safe = safeFileName(name);
  if (!bridge) {
    downloadInBrowser(blob, safe);
    return "browser";
  }
  const result = await bridge.save({
    name: safe,
    data: await blob.arrayBuffer(),
    mimeType: blob.type || undefined,
  });
  if (result.canceled) return "canceled";
  if (!result.ok) {
    throw new Error(result.error || "No se pudo guardar el archivo.");
  }
  return "saved";
}

/** Abre el archivo con el programa predeterminado del sistema operativo. */
export async function openFileWithSystem(
  blob: Blob,
  name: string,
): Promise<"native" | "browser"> {
  const bridge = getBridge();
  const safe = safeFileName(name);
  if (!bridge) {
    openInBrowser(blob, safe);
    return "browser";
  }
  const result = await bridge.open({
    name: safe,
    data: await blob.arrayBuffer(),
    mimeType: blob.type || undefined,
  });
  if (!result.ok) {
    throw new Error(result.error || "No se pudo abrir el archivo.");
  }
  return "native";
}
