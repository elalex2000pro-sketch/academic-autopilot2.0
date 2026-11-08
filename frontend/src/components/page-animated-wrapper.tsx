"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import {
  usePreferences,
  type AnimationLevel,
} from "@/components/preferences-provider";

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
 * Desenfoque de movimiento al entrar y salir de una vista, en píxeles. Se
 * mantiene bajo a propósito: la intención es que el cambio de pantalla se
 * sienta continuo, no que la interfaz parezca desenfocada.
 */
const MOTION_BLUR_PX: Record<Exclude<AnimationLevel, "reduced">, number> = {
  standard: 1.6,
  ultra: 2.4,
};

/**
 * Entrada del contenedor de ruta. No ocultamos el wrapper para no dejar la
 * página en blanco si Framer aún no ha hidratado; el desplazamiento ya hace
 * visible la transición incluso en vistas sin bloques `pageItem` (por ejemplo,
 * Academic-Office).
 *
 * El `filter` se limpia con `transitionEnd` en cuanto acaba la entrada: dejarlo
 * en `blur(0px)` crearía un bloque contenedor y desplazaría los elementos
 * `fixed` que viven dentro de la página.
 */
function createPageShell(blurPx: number): Variants {
  if (blurPx <= 0) {
    return {
      hidden: { y: 12 },
      visible: { y: 0, transition: { duration: 0.28, ease: "easeOut" } },
      exit: { opacity: 0, y: -12, transition: { duration: 0.18, ease: "easeOut" } },
    };
  }

  return {
    hidden: { y: 12, filter: `blur(${blurPx}px)` },
    visible: {
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.28, ease: "easeOut" },
      transitionEnd: { filter: "none" },
    },
    exit: {
      opacity: 0,
      y: -12,
      filter: `blur(${blurPx}px)`,
      transition: { duration: 0.18, ease: "easeOut" },
    },
  };
}

/** Entrada del contenedor de ruta en el nivel estándar. */
export const pageShell: Variants = createPageShell(MOTION_BLUR_PX.standard);

const pageShellByLevel: Record<AnimationLevel, Variants> = {
  reduced: INSTANT_VARIANTS,
  standard: pageShell,
  ultra: createPageShell(MOTION_BLUR_PX.ultra),
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
  const shellVariants = pageShellByLevel[animationLevel] ?? pageShell;

  return (
    <motion.div
      variants={shellVariants}
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
