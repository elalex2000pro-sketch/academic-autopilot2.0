"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { usePreferences } from "@/components/preferences-provider";

/**
 * Transición compartida por todas las vistas del App Router.
 *
 * En una SPA clásica esto viviría junto al router; aquí `usePathname()` es la
 * fuente de verdad y `AppShell` envuelve el árbol de páginas. La clave cambia
 * con cada ruta para que AnimatePresence pueda esperar la salida antes de
 * montar la siguiente vista.
 */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
      ease: "easeOut",
    },
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

const INSTANT_VARIANTS: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, transition: { duration: 0 } },
};

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const systemReduced = useReducedMotion();
  const { animationLevel } = usePreferences();
  const reduced = systemReduced || animationLevel === "reduced";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        data-page-transition={pathname}
        variants={reduced ? INSTANT_VARIANTS : pageVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="min-w-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
