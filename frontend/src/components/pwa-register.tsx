"use client";

import { useEffect } from "react";

// Registra el service worker que permite abrir la app instalada sin conexion.
// En desarrollo se desactiva para no mezclar versiones antiguas con Next dev.
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Tras un despliegue, una pestaña abierta puede pedir un chunk que ya no
    // existe. Un único recargo por sesión recupera la versión nueva sin bucles.
    const onError = (event: ErrorEvent) => {
      const text = event.message ?? "";
      if (
        !/ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(
          text,
        )
      ) {
        return;
      }
      const key = "autopilot:chunk-reload";
      try {
        if (window.sessionStorage.getItem(key) === "1") return;
        window.sessionStorage.setItem(key, "1");
      } catch {
        return;
      }
      window.location.reload();
    };

    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.warn("No se pudo activar el modo sin conexión", error);
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
