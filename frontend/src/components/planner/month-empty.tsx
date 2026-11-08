"use client";

import { CalendarDays, Coffee } from "lucide-react";

export function MonthEmpty({ weekend }: { weekend: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-900/[0.02] px-6 py-10 text-center dark:bg-white/[0.02]">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066FF]/10 text-[#0066FF] ring-1 ring-[#0066FF]/15 dark:bg-[#0066FF]/15 dark:text-[#7fb2ff] dark:ring-[#0066FF]/20">
        {weekend ? <Coffee className="h-6 w-6" strokeWidth={1.7} /> : <CalendarDays className="h-6 w-6" strokeWidth={1.7} />}
      </span>
      <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
        {weekend ? "Día sin clases lectivas" : "No hay clases este día"}
      </p>
      <p className="mt-1 max-w-xs text-[11.5px] leading-5 text-slate-500 dark:text-white/40">
        {weekend
          ? "Descansa, adelanta apuntes o disfruta del fin de semana. Las entregas siguen visibles abajo."
          : "Puedes añadir una clase al horario o usar este hueco para estudiar."}
      </p>
    </div>
  );
}
