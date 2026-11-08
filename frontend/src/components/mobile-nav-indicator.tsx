"use client";

import { motion, useReducedMotion } from "framer-motion";

// Física del indicador: stiffness 300 / damping 30 deja el muelle en régimen
// casi crítico, así que la burbuja se traslada sin rebote perceptible.
const INDICATOR_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 30,
} as const;

/**
 * Círculo activo de la barra inferior. Vive en su propio módulo para que
 * `framer-motion` no forme parte del JavaScript del primer pintado: la barra
 * dibuja un círculo estático y este componente toma el relevo al hidratar.
 */
export function MobileNavIndicator({ forceReduced = false }: { forceReduced?: boolean }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      layoutId="activeNavIndicator"
      aria-hidden="true"
      className="gpu-layer absolute inset-0 rounded-full bg-[#0066FF] shadow-[0_10px_22px_-12px_rgba(0,102,255,0.95),inset_0_1px_0_rgba(255,255,255,0.28)] dark:bg-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      transition={
        prefersReducedMotion || forceReduced ? { duration: 0 } : INDICATOR_SPRING
      }
    />
  );
}
