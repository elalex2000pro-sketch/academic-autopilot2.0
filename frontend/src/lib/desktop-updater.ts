/**
 * Contrato del actualizador silencioso que expone Electron.
 *
 * El proceso principal descarga el instalador en segundo plano; el renderer
 * solo recibe el estado y, cuando está listo, pide el reinicio. En web este
 * puente no existe y se usa el flujo de `app-update.ts`.
 */

export type DesktopUpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "current"
  | "error"
  | "disabled";

export interface DesktopUpdaterState {
  status: DesktopUpdaterStatus;
  version: string | null;
  progress: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
  releaseNotes: string;
  releaseDate: string | null;
  error: string | null;
}

export interface DesktopUpdaterInstallResult {
  ok: boolean;
  reason?: string;
}

export interface DesktopUpdaterBridge {
  getState: () => Promise<DesktopUpdaterState>;
  check: () => Promise<DesktopUpdaterState>;
  download: () => Promise<DesktopUpdaterState>;
  install: () => Promise<DesktopUpdaterInstallResult>;
  onState: (callback: (state: DesktopUpdaterState) => void) => () => void;
}

/** Devuelve el puente solo cuando la app corre dentro de Electron. */
export function getDesktopUpdater(): DesktopUpdaterBridge | null {
  if (typeof window === "undefined") return null;
  return window.autopilotDesktop?.updater ?? null;
}
