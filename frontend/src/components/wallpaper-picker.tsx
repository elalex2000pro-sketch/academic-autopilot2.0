"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  compressWallpaper,
  readWallpaper,
  removeWallpaper,
  saveWallpaper,
  WALLPAPER_EVENT,
} from "@/lib/wallpaper";

/** Selector del fondo de pantalla que se muestra difuminado detrás de la app. */
export function WallpaperPicker() {
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setImage(readWallpaper());
    sync();
    window.addEventListener(WALLPAPER_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WALLPAPER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setMessage(null);
    try {
      const dataUrl = await compressWallpaper(file);
      saveWallpaper(dataUrl);
      setMessage("Fondo actualizado. Se muestra difuminado detrás de la interfaz.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo usar esa imagen.");
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    removeWallpaper();
    setMessage("Fondo predeterminado restaurado.");
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/60 shadow-sm dark:border-white/10">
          {image ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${image}")` }}
            />
          ) : (
            <div className="wallpaper-swatch h-full w-full" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Fondo de pantalla</p>
          <p className="text-xs leading-4 text-muted-foreground">
            Elige una foto y se verá difuminada detrás del cristal. Se guarda solo en este navegador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {image ? "Cambiar" : "Elegir imagen"}
          </Button>
          {image && (
            <Button size="sm" variant="ghost" onClick={handleRemove} disabled={busy}>
              <RotateCcw className="h-4 w-4" /> Quitar
            </Button>
          )}
        </div>
      </div>

      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          El navegador no puede leer tu fondo del sistema: elige aquí la imagen que quieras usar.
        </p>
      )}
    </div>
  );
}
