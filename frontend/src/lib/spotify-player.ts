/**
 * Carga del Web Playback SDK de Spotify y tipos mínimos del reproductor.
 * El SDK solo existe en el navegador, así que se carga bajo demanda.
 */

import { getValidAccessToken } from "@/lib/spotify";

interface RawPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  track_window?: { current_track?: unknown };
}

export interface SpotifyWebPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (payload: unknown) => void) => void;
  getCurrentState: () => Promise<RawPlaybackState | null>;
}

interface SpotifySdk {
  Player: new (options: {
    name: string;
    volume: number;
    getOAuthToken: (callback: (token: string) => void) => void;
  }) => SpotifyWebPlayer;
}

declare global {
  interface Window {
    Spotify?: SpotifySdk;
    onSpotifyWebPlaybackSDKReady?: () => void;
    __autopilotSpotifySdk?: Promise<SpotifySdk>;
  }
}

/** Inyecta el script oficial una sola vez y espera a que esté disponible. */
export function loadSpotifySdk(): Promise<SpotifySdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("El reproductor solo está disponible en el navegador."));
  }
  if (window.Spotify) return Promise.resolve(window.Spotify);
  if (window.__autopilotSpotifySdk) return window.__autopilotSpotifySdk;

  const promise = new Promise<SpotifySdk>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("El reproductor de Spotify tardó demasiado en cargar."));
    }, 15_000);

    const previous = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previous?.();
      if (window.Spotify) {
        window.clearTimeout(timeout);
        resolve(window.Spotify);
      } else {
        window.clearTimeout(timeout);
        reject(new Error("Spotify no pudo inicializar el reproductor."));
      }
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-spotify-sdk="true"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.dataset.spotifySdk = "true";
      document.body.appendChild(script);
    }
  });

  window.__autopilotSpotifySdk = promise;
  promise.catch(() => {
    if (window.__autopilotSpotifySdk === promise) delete window.__autopilotSpotifySdk;
  });

  return promise;
}

/** Crea el reproductor con el token renovado automáticamente. */
export async function createSpotifyPlayer(): Promise<SpotifyWebPlayer> {
  const sdk = await loadSpotifySdk();
  return new sdk.Player({
    name: "Academic Autopilot",
    volume: 0.8,
    getOAuthToken: (callback) => {
      void getValidAccessToken().then((token) => {
        if (token) callback(token);
      });
    },
  });
}
