/** Clave y eventos del fondo de pantalla guardado en el navegador. */
export const WALLPAPER_STORAGE_KEY = "academic-autopilot-wallpaper";
export const WALLPAPER_EVENT = "autopilot-wallpaper-change";

/** Devuelve la imagen guardada como data URL, o null si no hay ninguna. */
export function readWallpaper(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(WALLPAPER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveWallpaper(dataUrl: string) {
  try {
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, dataUrl);
  } catch {
    throw new Error("No hay espacio en el navegador para guardar la imagen. Prueba con otra más ligera.");
  }
  window.dispatchEvent(new Event(WALLPAPER_EVENT));
}

export function removeWallpaper() {
  try {
    window.localStorage.removeItem(WALLPAPER_STORAGE_KEY);
  } finally {
    window.dispatchEvent(new Event(WALLPAPER_EVENT));
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen."));
    image.src = src;
  });
}

/**
 * Reduce la imagen a 1920 px y la comprime para poder guardarla en
 * localStorage sin agotar la cuota del navegador.
 */
export async function compressWallpaper(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("No se pudo leer la imagen. Prueba con un JPG o un PNG.");
    }
    const maxSide = 1920;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo procesar la imagen.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > 2_800_000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.62);
    }
    if (dataUrl.length > 4_000_000) {
      throw new Error("La imagen sigue siendo demasiado grande. Prueba con otra.");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
