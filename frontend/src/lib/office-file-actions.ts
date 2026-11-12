import { downloadFile } from "./office-doc";

/** Comparte el transporte; cada vista conserva sus mensajes y formatos. */
export async function saveOfficeFile(name: string, blob: Blob, mimeType?: string) {
  const bridge = window.autopilotDesktop?.files;
  if (bridge) {
    return bridge.save({ name, data: await blob.arrayBuffer(), ...(mimeType ? { mimeType } : {}) });
  }
  downloadFile(name, mimeType ? new Blob([blob], { type: mimeType }) : blob);
  return { ok: true, canceled: false, error: undefined };
}

export async function pickOfficeFile() {
  const bridge = window.autopilotDesktop?.files;
  if (!bridge) return null;
  const result = await bridge.open({ mode: "pick-office" });
  const file = result.ok && result.name && (result.data || result.text !== undefined)
    ? new File([result.data || result.text!], result.name)
    : null;
  return { ...result, file };
}
