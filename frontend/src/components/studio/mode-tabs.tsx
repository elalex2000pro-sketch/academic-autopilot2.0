"use client";

import { MODES, type StudioMode } from "@/lib/studio";
import { cn } from "@/lib/utils";

export function ModeTabs({
  mode,
  onChange,
}: {
  mode: StudioMode;
  onChange: (mode: StudioMode) => void;
}) {
  return (
    <div className="relative z-10 px-3 pt-2 sm:px-5">
      <div
        role="tablist"
        aria-label="Modos de IA Studio"
        className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto rounded-2xl border border-slate-300/40 bg-slate-100/70 p-1 shadow-[0_16px_40px_-30px_rgba(32,39,48,0.35)] backdrop-blur-3xl dark:border-white/10 dark:bg-black/30"
      >
        {MODES.map(({ id, label, shortLabel, icon: Icon, hint }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              title={hint}
              onClick={() => onChange(id)}
              className={cn(
                "flex h-9 min-w-[104px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-[11px] font-medium transition-all duration-200 sm:text-[11.5px]",
                active
                  ? "bg-[#0066FF] text-white shadow-[0_10px_24px_-14px_rgba(0,102,255,0.95)]"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white/85",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
