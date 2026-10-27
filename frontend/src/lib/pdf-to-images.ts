// Convierte fotos y PDFs escaneados en imágenes listas para la IA.
//
// Los PDFs se renderizan en el navegador con pdf.js (no necesitan capa de
// texto), de modo que un libro escaneado también se puede analizar. Cada página
// se envía como JPEG Base64 y se guarda una miniatura para las burbujas.
import type { ChatAttachment } from "@/lib/types";

export const MAX_ATTACHMENTS = 6;
export const MAX_PDF_PAGES = 3;

const MAX_IMAGE_EDGE = 1600;
const PREVIEW_EDGE = 360;
const JPEG_QUALITY = 0.86;
const PREVIEW_QUALITY = 0.72;

export interface PreparedAttachment extends ChatAttachment {
  data: string;
  mime_type: string;
  preview: string;
}

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

export async function prepareAttachmentFile(file: File): Promise<PreparedAttachment[]> {
  if (isPdf(file)) return renderPdfPages(file);
  if (isImage(file)) return [await prepareImage(file)];
  throw new Error("Formato no admitido. Usa PNG, JPG, WEBP o PDF.");
}

export function isSupportedAttachment(file: File): boolean {
  return isPdf(file) || isImage(file);
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isImage(file: File): boolean {
  return (
    ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
      (file.type || "").toLowerCase(),
    ) || /\.(png|jpe?g|webp)$/i.test(file.name)
  );
}

async function prepareImage(file: File): Promise<PreparedAttachment> {
  const loaded = await loadImage(file);
  try {
    const canvas = drawToCanvas(loaded.source, loaded.width, loaded.height, MAX_IMAGE_EDGE);
    return {
      name: file.name || "imagen",
      mime_type: "image/jpeg",
      data: splitDataUrl(canvas.toDataURL("image/jpeg", JPEG_QUALITY)),
      preview: makePreview(canvas, PREVIEW_EDGE),
      page: null,
      total_pages: null,
    };
  } finally {
    loaded.close();
  }
}

export async function renderPdfPages(
  file: File,
  maxPages = MAX_PDF_PAGES,
): Promise<PreparedAttachment[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  try {
    const totalPages = pdf.numPages;
    const pageCount = Math.min(totalPages, Math.max(1, maxPages));
    const pages: PreparedAttachment[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const longestEdge = Math.max(baseViewport.width, baseViewport.height);
        const scale = Math.max(0.1, Math.min(2.2, MAX_IMAGE_EDGE / longestEdge));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        const context = canvas.getContext("2d");
        if (!context) throw new Error("El navegador no permite renderizar el PDF.");
        // Fondo blanco: los PDFs escaneados suelen tener transparencias que, al
        // guardarse como JPEG, se convertirían en zonas negras.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        // `intent: "print"` desactiva el render progresivo con requestAnimationFrame.
        // Asi la conversion termina aunque la pestana este en segundo plano (Chrome
        // pausa rAF en pestanas ocultas y el render se quedaria colgado).
        await page.render({ canvasContext: context, viewport, intent: "print" }).promise;

        pages.push({
          name: file.name || "documento.pdf",
          mime_type: "image/jpeg",
          data: splitDataUrl(canvas.toDataURL("image/jpeg", JPEG_QUALITY)),
          preview: makePreview(canvas, PREVIEW_EDGE),
          page: pageNumber,
          total_pages: totalPages,
        });
      } finally {
        page.cleanup();
      }
    }

    return pages;
  } finally {
    await pdf.destroy();
  }
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Algunos navegadores no decodifican ciertos formatos con
      // createImageBitmap; se intenta con un <img> normal.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo leer la imagen."));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxEdge: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no permite procesar imágenes.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function makePreview(canvas: HTMLCanvasElement, maxEdge: number): string {
  const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
  const preview = document.createElement("canvas");
  preview.width = Math.max(1, Math.round(canvas.width * scale));
  preview.height = Math.max(1, Math.round(canvas.height * scale));

  const context = preview.getContext("2d");
  if (!context) return canvas.toDataURL("image/jpeg", PREVIEW_QUALITY);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, preview.width, preview.height);
  context.drawImage(canvas, 0, 0, preview.width, preview.height);
  return preview.toDataURL("image/jpeg", PREVIEW_QUALITY);
}

function splitDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("No se pudo convertir la imagen a Base64.");
  return dataUrl.slice(comma + 1);
}
