import type { DesktopUpdaterBridge } from "@/lib/desktop-updater";

export {};

declare global {
  interface Window {
    /** Puente mínimo que expone la ventana de Electron al renderer. */
    autopilotDesktop?: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      /** Reconstruye la ventana con marco nativo (`false`) o frameless (`true`). */
      setCustomTitlebar?: (
        enabled: boolean,
      ) => Promise<{ ok: boolean; useCustomTitlebar: boolean }>;
      /** Alias explícito solicitado por la integración. */
      setFrameless?: (
        enabled: boolean,
      ) => Promise<{ ok: boolean; useCustomTitlebar: boolean }>;
      /** Preferencia que el proceso principal aplicó al crear la ventana. */
      getWindowPreferences?: () => Promise<{ useCustomTitlebar: boolean }>;
      /** Actualizaciones silenciosas gestionadas por electron-updater. */
      updater?: DesktopUpdaterBridge;
    };
  }
}
