"use client";

import { Blend, Check, Sparkles, type LucideIcon } from "lucide-react";

import {
  usePreferences,
  type GlassStyle,
} from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

const GLASS_OPTIONS: Array<{
  value: GlassStyle;
  label: string;
  description: string;
  icon: LucideIcon;
  tag?: string;
}> = [
  {
    value: "standard",
    label: "Liquid Glass",
    description: "El cristal actual: translúcido, con contraste y legibilidad máximos.",
    icon: Blend,
  },
  {
    value: "pure",
    label: "Pure Glass",
    description:
      "Superficies casi transparentes con más desenfoque y opacidad mínima. Ideal con fondos claros y coloridos.",
    icon: Sparkles,
    tag: "Nuevo",
  },
];

export function GlassStylePicker() {
  const { glassStyle, performanceProfile, setGlassStyle } = usePreferences();

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium">Estilo de cristal</p>
          <p className="text-[11px] leading-4 text-slate-500 dark:text-white/35">
            Elige cuánto se transparentan las tarjetas, paneles y superficies.
          </p>
        </div>
        <span className="rounded-full border border-[#0066FF]/20 bg-[#0066FF]/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#0066FF] dark:border-[#8ab9ff]/20 dark:bg-[#8ab9ff]/[0.08] dark:text-[#8ab9ff]">
          Full Glassmorphism
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Estilo de cristal"
        className="grid gap-2 sm:grid-cols-2"
      >
        {GLASS_OPTIONS.map(({ value, label, description, icon: Icon, tag }) => {
          const selected = glassStyle === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setGlassStyle(value)}
              className={cn(
                "group flex h-full flex-col gap-2 rounded-xl border p-3 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                selected
                  ? "border-[#0066FF]/35 bg-[#0066FF]/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:border-[#8ab9ff]/25 dark:bg-[#8ab9ff]/[0.08]"
                  : "border-slate-300/45 bg-slate-100/50 hover:border-slate-400/40 hover:bg-slate-200/45 dark:border-white/[0.06] dark:bg-white/[0.025] dark:hover:bg-white/[0.05]",
              )}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    selected
                      ? "bg-[#0066FF] text-white shadow-[0_6px_14px_-8px_rgba(0,102,255,0.9)]"
                      : "bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-white/45",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                {selected ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0066FF] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="h-5 w-5 rounded-full border border-slate-300/70 dark:border-white/15" />
                )}
              </span>

              <span className="flex items-center gap-1.5 text-[12px] font-semibold leading-4 text-slate-800 dark:text-white/85">
                {label}
                {tag && (
                  <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
                    {tag}
                  </span>
                )}
              </span>
              <span className="text-[10.5px] leading-4 text-slate-500 dark:text-white/40">
                {description}
              </span>

              <span
                aria-hidden="true"
                className={cn(
                  "mt-auto flex h-9 items-center gap-1.5 rounded-lg border px-2",
                  value === "pure"
                    ? "border-white/30 bg-white/[0.08] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.035]"
                    : "border-white/45 bg-slate-100/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07]",
                )}
              >
                <span className="h-1.5 w-8 rounded-full bg-[#0066FF]/70" />
                <span className="h-1.5 w-full rounded-full bg-slate-300/70 dark:bg-white/15" />
              </span>
            </button>
          );
        })}
      </div>

      {glassStyle === "pure" && performanceProfile === "efficiency" ? (
        <p className="rounded-lg border border-amber-300/40 bg-amber-100/50 px-2.5 py-2 text-[10px] leading-4 text-amber-800 dark:border-amber-200/15 dark:bg-amber-300/[0.07] dark:text-amber-100/80">
          El Modo Ahorro reduce el desenfoque. Cambia a Modo Calidad para ver Pure Glass
          completo.
        </p>
      ) : null}
    </div>
  );
}
