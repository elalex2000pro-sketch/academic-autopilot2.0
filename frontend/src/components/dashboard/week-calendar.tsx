"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";

import { DASHBOARD_ITEM, PRIORITY_COLOR, formatTime } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type WeekDay = { key: string; weekday: string; day: number; isToday: boolean };
type CalendarItem = { start_at: string; title: string; priority: string };

export function WeekCalendar({
  month,
  days,
  items,
  onShiftWeek,
}: {
  month: string;
  days: WeekDay[];
  items: CalendarItem[];
  onShiftWeek: (delta: number) => void;
}) {
  return (
    <motion.section
      variants={DASHBOARD_ITEM}
      className="glass-card flex flex-col rounded-[30px] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            Calendario
          </p>
          <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.035em] text-[#1d1d1f] dark:text-white">
            {month}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onShiftWeek(-1)}
            aria-label="Semana anterior"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.06] bg-white/45 text-black/45 transition-colors hover:bg-white/80 hover:text-black/75 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onShiftWeek(1)}
            aria-label="Semana siguiente"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.06] bg-white/45 text-black/45 transition-colors hover:bg-white/80 hover:text-black/75 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {days.map((day) => (
          <div key={day.key} className="flex min-w-0 flex-col items-center gap-1.5">
            <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-black/35 dark:text-white/30">
              {day.weekday}
            </span>
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                day.isToday
                  ? "bg-[#1b1b1f] text-white shadow-[0_7px_16px_-10px_rgba(20,20,28,0.9)]"
                  : "text-black/55 hover:bg-black/[0.04] dark:text-white/55 dark:hover:bg-white/[0.06]",
              )}
            >
              {day.day}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-1 border-t border-black/[0.06] pt-3 dark:border-white/[0.07]">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${item.start_at}-${item.title}-${index}`}
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOR[item.priority] ?? "#8e8e93" }}
              />
              <span className="w-9 shrink-0 text-[10px] font-medium tabular-nums text-black/35 dark:text-white/30">
                {formatTime(item.start_at)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-black/65 dark:text-white/65">
                {item.title}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-black/[0.08] px-3 py-2.5 text-[11px] leading-4 text-black/40 dark:border-white/10 dark:text-white/35">
            Sin bloques en esta semana. Abre el planificador para repartir tu estudio.
          </p>
        )}
      </div>

      <Link
        href="/planner"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-black/45 transition-colors hover:text-black/80 dark:text-white/40 dark:hover:text-white/80"
      >
        Ver calendario completo
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </motion.section>
  );
}
