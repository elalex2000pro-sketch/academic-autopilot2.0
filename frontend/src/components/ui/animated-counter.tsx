"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValueEvent, useSpring } from "framer-motion";

import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Cuenta desde 0 hasta el valor real con un muelle de Framer Motion.
 * El primer render también es 0, así que la hidratación no cambia el HTML.
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  ariaLabel,
}: AnimatedCounterProps) {
  const { animationLevel } = usePreferences();
  const reduceMotion = animationLevel === "reduced";
  const safeValue = Number.isFinite(value) ? value : 0;
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.9 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      spring.jump(safeValue);
      setDisplayValue(safeValue);
      return;
    }
    spring.set(safeValue);
  }, [reduceMotion, safeValue, spring]);

  useMotionValueEvent(spring, "change", (latest) => {
    setDisplayValue(latest);
  });

  const text = useMemo(
    () =>
      new Intl.NumberFormat("es-ES", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(displayValue),
    [decimals, displayValue],
  );

  return (
    <motion.span
      className={cn("inline-block tabular-nums", className)}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.68 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 260, damping: 22, delay: 0.04 }
      }
      aria-label={ariaLabel}
    >
      {prefix}
      {text}
      {suffix}
    </motion.span>
  );
}
