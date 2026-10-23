"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Interruptor tipo iOS: pista azul cuando esta activo y pulgar blanco con una
 * sombra suave. Mantiene el foco visible y el estado accesible.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[30px] w-[52px] shrink-0 items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-200 ease-mac focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0066FF]/25 disabled:cursor-not-allowed disabled:opacity-45",
        checked
          ? "border-[#0066FF]/30 bg-[#0066FF] shadow-[0_6px_18px_-8px_rgba(0,102,255,0.9),inset_0_1px_0_rgba(255,255,255,0.28)]"
          : "border-slate-300/80 bg-slate-300/70 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/15",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block h-[24px] w-[24px] rounded-full bg-white shadow-[0_2px_6px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.9)] transition-transform duration-200 ease-mac",
          checked ? "translate-x-[25px]" : "translate-x-[2px]",
        )}
      />
    </button>
  ),
);
Switch.displayName = "Switch";

export { Switch };
