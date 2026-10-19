// Subida por trozos con progreso y reanudacion (archivos grandes, hasta 20 GB).
//
// El backend divide el trabajo en trozos de `chunk_size` bytes; cada trozo se
// envia en una peticion corta, asi ningun proxy corta la subida. Si una
// peticion falla, se reintenta y, si hace falta, se resincroniza el estado
// consultando al servidor para continuar desde el ultimo byte confirmado.
import { ApiError, api, apiBase, tokenStore } from "@/lib/api";
import type { DocumentFile } from "@/lib/types";

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface UploadOptions {
  courseId?: string | null;
  classId?: string | null;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

const MAX_RETRIES = 5;

export async function uploadFileInChunks(
  file: File,
  options: UploadOptions = {},
): Promise<DocumentFile> {
  const session = await api.createUpload({
    filename: file.name,
    size_bytes: file.size,
    content_type: file.type || "application/octet-stream",
    course_id: options.courseId ?? null,
    class_id: options.classId ?? null,
  });

  let received = session.received_bytes;
  const chunkSize = session.chunk_size;
  let failures = 0;

  try {
    while (received < file.size) {
      const index = Math.floor(received / chunkSize);
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const blob = file.slice(start, end);

      try {
        const result = await sendChunk(
          session.id,
          index,
          blob,
          (loaded) => reportProgress(options, start + loaded, file.size),
          options.signal,
        );
        received =
          result >= 0
            ? result
            : (await api.uploadStatus(session.id)).received_bytes;
        failures = 0;
      } catch (error) {
        if (options.signal?.aborted) throw error;
        failures += 1;
        if (failures > MAX_RETRIES) throw error;
        // Resincroniza con el servidor (el trozo pudo llegar aunque se
        // perdiera la respuesta) y espera antes de reintentar.
        const status = await api.uploadStatus(session.id).catch(() => null);
        if (status) received = status.received_bytes;
        await sleep(Math.min(1000 * 2 ** failures, 15000));
      }
    }

    const document = await api.completeUpload(session.id);
    reportProgress(options, file.size, file.size);
    return document;
  } catch (error) {
    if (options.signal?.aborted) {
      await api.abortUpload(session.id).catch(() => undefined);
    }
    throw error;
  }
}

function reportProgress(
  options: UploadOptions,
  uploadedBytes: number,
  totalBytes: number,
): void {
  options.onProgress?.({
    uploadedBytes,
    totalBytes,
    percent: totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Envia un trozo con XMLHttpRequest para poder mostrar progreso real.
function sendChunk(
  uploadId: string,
  index: number,
  blob: Blob,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "PUT",
      `${apiBase()}/api/v1/files/uploads/${uploadId}/chunk?index=${index}`,
    );
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as {
            received_bytes?: number;
          };
          resolve(
            typeof data.received_bytes === "number" ? data.received_bytes : -1,
          );
        } catch {
          resolve(-1);
        }
        return;
      }
      reject(new ApiError(xhr.status, extractDetail(xhr.responseText)));
    };
    xhr.onerror = () =>
      reject(new ApiError(0, "Error de red durante la subida"));
    xhr.onabort = () => reject(new ApiError(0, "Subida cancelada"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(blob);
  });
}

function extractDetail(body: string): string {
  try {
    const data = JSON.parse(body) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (data.detail && typeof data.detail === "object") {
      const message = (data.detail as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  } catch {
    // Sin JSON: se usa el mensaje generico.
  }
  return "Fallo al enviar el trozo";
}
