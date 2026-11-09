"use client";

import { useEffect } from "react";
import { Home, LogOut, RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearSpotifyConnection } from "@/lib/spotify";

/**
 * Si Spotify devuelve una pista con una forma inesperada (por ejemplo un
 * podcast o un anuncio sin artistas), este límite evita que toda la app quede
 * en blanco y muestra el error real para poder diagnosticarlo.
 */
export default function SpotifyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[spotify] error de render", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
        <TriangleAlert className="h-7 w-7" />
      </span>

      <div>
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-800 dark:text-white/90">
          Spotify se ha detenido
        </h1>
        <p className="mt-1 text-[12.5px] leading-5 text-slate-500 dark:text-white/45">
          La conexión se completó, pero el reproductor no pudo pintarse. Esto puede pasar
          con pistas que Spotify entrega sin artistas (podcasts o anuncios) o con una copia
          antigua de la app en la caché del navegador.
        </p>
      </div>

      <pre className="w-full overflow-x-auto whitespace-pre-wrap rounded-xl border border-rose-300/40 bg-rose-50/60 p-3 text-left font-mono text-[10.5px] leading-4 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
        {error.message || "Error desconocido"}
        {error.digest ? `\n\nDigest: ${error.digest}` : ""}
      </pre>

      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()} className="h-9 rounded-xl px-3 text-[11px]">
          <RotateCcw className="h-3.5 w-3.5" /> Reintentar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            clearSpotifyConnection();
            window.location.href = "/spotify";
          }}
          className="h-9 rounded-xl px-3 text-[11px]"
        >
          <LogOut className="h-3.5 w-3.5" /> Desconectar Spotify
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            window.location.href = "/";
          }}
          className="h-9 rounded-xl px-3 text-[11px]"
        >
          <Home className="h-3.5 w-3.5" /> Ir al inicio
        </Button>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-white/30">
        Si vuelve a ocurrir, abre la consola con F12 y copia el error rojo.
      </p>
    </div>
  );
}
