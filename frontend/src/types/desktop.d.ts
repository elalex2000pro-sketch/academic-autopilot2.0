import type { DesktopUpdaterBridge } from "@/lib/desktop-updater";

export {};

interface DesktopSpotifyAuthCallback {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
  cancelled?: boolean;
}

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
      /** Abre el OAuth de Spotify en una ventana hija de Electron. */
      startSpotifyAuth?: (
        url: string,
        redirectUri: string,
      ) => Promise<{ ok: boolean; error?: string }>;
      /** Escucha el código o la cancelación que devuelve la ventana de OAuth. */
      onSpotifyAuth?: (
        callback: (payload: DesktopSpotifyAuthCallback) => void,
      ) => void;
      offSpotifyAuth?: () => void;
      /** Guardar como… y abrir adjuntos con las APIs nativas del sistema. */
      files?: {
        save: (payload: {
          name: string;
          data: ArrayBuffer;
          mimeType?: string;
        }) => Promise<{
          ok: boolean;
          canceled?: boolean;
          path?: string;
          error?: string;
        }>;
        open: (payload: {
          name: string;
          data: ArrayBuffer;
          mimeType?: string;
        }) => Promise<{
          ok: boolean;
          path?: string;
          error?: string;
        }>;
      };
      /** Avisos nativos del sistema operativo (los usa lib/notifications.ts). */
      notify?: (payload: {
        title: string;
        body: string;
        tag?: string;
        url?: string;
      }) => Promise<{ ok: boolean }>;
      /** Actualizaciones silenciosas gestionadas por electron-updater. */
      updater?: DesktopUpdaterBridge;
    };
  }
}
