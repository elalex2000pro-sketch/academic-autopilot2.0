"use client";

import { useEffect, useState } from "react";

import { readWallpaper, WALLPAPER_EVENT } from "@/lib/wallpaper";

type Tone = "light" | "dark";

/** Luminancia media de la imagen para adaptar el velo al tema. */
function detectTone(src: string): Promise<Tone> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve("light");
          return;
        }
        context.drawImage(image, 0, 0, 24, 24);
        const { data } = context.getImageData(0, 0, 24, 24);
        let total = 0;
        for (let index = 0; index < data.length; index += 4) {
          total += (data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722) / 255;
        }
        resolve(total / (data.length / 4) < 0.46 ? "dark" : "light");
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("No se pudo analizar la imagen."));
    image.src = src;
  });
}

/**
 * Capa fija detrás de toda la interfaz. Si hay una imagen guardada se
 * muestra difuminada; si no, se usa el degradado ambiental por defecto.
 */
export function WallpaperBackdrop() {
  const [image, setImage] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone | null>(null);

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

  useEffect(() => {
    if (!image) {
      setTone(null);
      return;
    }
    let cancelled = false;
    detectTone(image)
      .then((value) => {
        if (!cancelled) setTone(value);
      })
      .catch(() => {
        if (!cancelled) setTone("light");
      });
    return () => {
      cancelled = true;
    };
  }, [image]);

  return (
    <div aria-hidden className="wallpaper-layer" data-tone={tone ?? undefined}>
      {image ? (
        <div className="wallpaper-photo" style={{ backgroundImage: `url("${image}")` }} />
      ) : (
        <div className="wallpaper-default wallpaper-swatch" />
      )}
      <div className="wallpaper-veil" />
    </div>
  );
}
