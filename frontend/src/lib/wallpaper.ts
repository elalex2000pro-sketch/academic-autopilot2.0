/** Clave y eventos del fondo de pantalla guardado en el navegador. */
export const WALLPAPER_STORAGE_KEY = "academic-autopilot-wallpaper";
export const WALLPAPER_EVENT = "autopilot-wallpaper-change";

/** Devuelve la imagen guardada como data URL, o null si no hay ninguna. */
export function readWallpaper(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(WALLPAPER_STORAGE_KEY);
    return value && value.startsWith("data:image/") ? value : null;
  } catch {
    return null;
  }
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
 * Reduce la imagen y la comprime para que quepa en `localStorage`. El fondo
 * blanco evita que un PNG transparente se convierta en negro al pasar a JPEG.
 */
export async function compressWallpaper(
  file: File,
  options: { maxSide?: number; quality?: number } = {},
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen.");
  }

  const maxSide = options.maxSide ?? 1920;
  const quality = options.quality ?? 0.82;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("No se pudo leer la imagen. Prueba con un JPG o un PNG.");
    }
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

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Calidades y tamaños que se prueban en orden hasta que la imagen quepa. */
const IMPORT_ATTEMPTS: Array<{ maxSide: number; quality: number }> = [
  { maxSide: 1920, quality: 0.82 },
  { maxSide: 1600, quality: 0.72 },
  { maxSide: 1280, quality: 0.62 },
  { maxSide: 1024, quality: 0.55 },
];

/**
 * Importa una imagen, la comprime y la guarda en `localStorage` como Base64.
 * Si la cuota del navegador se queda corta, reintenta con menos resolución en
 * lugar de fallar a la primera.
 */
export async function importWallpaper(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen.");
  }

  for (const attempt of IMPORT_ATTEMPTS) {
    const dataUrl = await compressWallpaper(file, attempt);
    try {
      window.localStorage.setItem(WALLPAPER_STORAGE_KEY, dataUrl);
    } catch {
      continue;
    }
    if (window.localStorage.getItem(WALLPAPER_STORAGE_KEY) !== dataUrl) continue;
    window.dispatchEvent(new Event(WALLPAPER_EVENT));
    return dataUrl;
  }

  throw new Error(
    "No hay espacio en el navegador para esta imagen. Prueba con una foto más pequeña.",
  );
}
