"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import { usePreferences } from "@/components/preferences-provider";

/** Separación entre la entrada de cada bloque de una vista. */
export const PAGE_STAGGER_CHILDREN = 0.1;

/** Contenedor común: la vista entra en cascada y sale antes de la siguiente. */
export const pageStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: PAGE_STAGGER_CHILDREN,
      delayChildren: 0.08,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

/** Bloque individual de una vista. Se hereda desde `PageAnimatedWrapper`. */
export const pageItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.16, ease: "easeOut" },
  },
};

const INSTANT_VARIANTS: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, transition: { duration: 0 } },
};

/**
 * Entrada del contenedor de ruta. No ocultamos el wrapper para no dejar la
 * página en blanco si Framer aún no ha hidratado; el desplazamiento ya hace
 * visible la transición incluso en vistas sin bloques `pageItem` (por ejemplo,
 * Academic-Office).
 */
const pageShell: Variants = {
  hidden: { y: 12 },
  visible: { y: 0, transition: { duration: 0.28, ease: "easeOut" } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.18, ease: "easeOut" } },
};

/**
 * Envoltorio de entrada de todas las vistas.
 *
 * Al vivir dentro de `AnimatePresence`, la vista actual termina su salida antes
 * de que se monte la siguiente. Los bloques marcados con `variants={pageItem}`
 * aparecen uno a uno con `staggerChildren: 0.1`.
 */
export function PageAnimatedWrapper({
  children,
  className,
  dataPageTransition,
}: {
  children: ReactNode;
  className?: string;
  dataPageTransition?: string;
}) {
  const { animationLevel } = usePreferences();
  // La preferencia explícita de la app manda: el nivel reducido sigue apagando
  // el movimiento, pero el sistema no anula los niveles estándar/ultra.
  const reduced = animationLevel === "reduced";

  return (
    <motion.div
      variants={reduced ? INSTANT_VARIANTS : pageShell}
      initial={reduced ? false : "hidden"}
      animate="visible"
      exit="exit"
      className={className}
      data-page-transition={dataPageTransition}
    >
      {children}
    </motion.div>
  );
}
