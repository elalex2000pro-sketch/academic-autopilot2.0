"use client";

import { useEffect } from "react";

/**
 * Actualiza la posición del puntero dentro de la tarjeta que se está
 * recorriendo para que la luz de `[data-spotlight]` la siga.
 * Un único listener global, limitado a un frame de animación.
 */
export function CursorGlow() {
  useEffect(() => {
    let frame = 0;
    let last: PointerEvent | null = null;

    const update = () => {
      frame = 0;
      if (!last) return;
      const target =
        last.target instanceof Element ? last.target.closest("[data-spotlight]") : null;
      if (!(target instanceof HTMLElement)) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${last.clientX - rect.left}px`);
      target.style.setProperty("--my", `${last.clientY - rect.top}px`);
    };

    const onMove = (event: PointerEvent) => {
      last = event;
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
