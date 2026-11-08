"use client";

import { motion } from "framer-motion";

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
  return (
    <motion.div
      layoutId="activeNavIndicator"
      aria-hidden="true"
      className="gpu-layer absolute inset-0 rounded-full bg-[#e9e4f6] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.7)]"
      transition={forceReduced ? { duration: 0 } : INDICATOR_SPRING}
    />
  );
}
