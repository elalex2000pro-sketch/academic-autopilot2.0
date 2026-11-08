"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

export type StatsCardTone = "positive" | "warning" | "neutral";

export interface StatsCardProps {
  title: string;
  value: ReactNode;
  change: ReactNode;
  icon: LucideIcon;
  gradient: string;
  tone?: StatsCardTone;
  className?: string;
}

const TONE_CLASS: Record<StatsCardTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  neutral: "text-slate-500 dark:text-white/50",
};

// Las tarjetas heredan el estado de la transición de página y se escalonan
// entre sí cuando el contenedor entra en `visible`.
const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 26 },
  },
};

/**
 * Tarjeta de métrica del Dashboard V18.
 *
 * La superficie, el borde luminoso y el desenfoque viven en `.glass-card` para
 * que el resto de paneles compartan el mismo material. El icono en degradado
 * añade el acento de color y Framer Motion eleva la tarjeta al pasar el cursor.
 */
export function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  gradient,
  tone = "positive",
  className,
}: StatsCardProps) {
  const { animationLevel } = usePreferences();
  const reduceMotion = animationLevel === "reduced";

  return (
    <motion.div
      variants={CARD_VARIANTS}
      whileHover={reduceMotion ? undefined : { y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn("glass-card group relative overflow-hidden rounded-2xl p-6", className)}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-gradient-to-br opacity-[0.13] blur-3xl transition-opacity duration-500 group-hover:opacity-25",
          gradient,
        )}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-black/45 dark:text-white/60">{title}</p>
          <h2 className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.055em] text-[#1d1d1f] dark:text-white">
            {value}
          </h2>
          <p className={cn("mt-3 flex items-center gap-1 text-[12px] font-medium", TONE_CLASS[tone])}>
            <ArrowUpRight aria-hidden="true" size={15} strokeWidth={2.2} />
            <span>{change}</span>
          </p>
        </div>

        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[0_10px_22px_-14px_rgba(15,23,42,0.65),inset_0_1px_0_rgba(255,255,255,0.3)] ring-1 ring-white/25",
            gradient,
          )}
        >
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
      </div>
    </motion.div>
  );
}
