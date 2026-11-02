"use client";

import { useEffect } from "react";

/**
 * Superficies que reciben la luz radial del puntero. Las tarjetas (`Card`)
 * llevan `data-spotlight`; los paneles grandes usan las clases de cristal.
 */
const GLOW_SELECTOR =
  "[data-spotlight], .glass-card, .glass-strong, .app-glass, .app-glass-strong";

/** La luz se apaga con movimiento reducido o con el perfil de ahorro. */
function glowEnabled(): boolean {
  const root = document.documentElement;
  return root.dataset.animations !== "reduced" && root.dataset.performance !== "efficiency";
}

/**
 * Actualiza la posición del puntero dentro de la tarjeta que se está
 * recorriendo para que la luz de `[data-spotlight]` la siga.
 *
 * Un único listener global y pasivo, limitado a un frame de animación. Solo
 * se activa en dispositivos con puntero fino (ratón/trackpad); en táctil no
 * se registra ningún trabajo.
 */
export function CursorGlow() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    let last: PointerEvent | null = null;

    const update = () => {
      frame = 0;
      const event = last;
      last = null;

      if (!event || event.pointerType === "touch" || !glowEnabled()) return;

      const target =
        event.target instanceof Element ? event.target.closest(GLOW_SELECTOR) : null;
      if (!(target instanceof HTMLElement)) return;

      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${Math.round(event.clientX - rect.left)}px`);
      target.style.setProperty("--my", `${Math.round(event.clientY - rect.top)}px`);
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
