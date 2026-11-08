"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarClock, Check, RefreshCw } from "lucide-react";

import {
  PRIORITY_COLOR,
  dayHeading,
  formatTime,
  isNow,
  minutesBetween,
} from "@/lib/dashboard";
import { cn, formatMinutes } from "@/lib/utils";

export type TimelineItem = {
  task_id: string;
  title: string;
  start_at: string;
  end_at: string;
  priority: string;
  course_name?: string | null;
  estimated_minutes?: number;
  completed?: boolean;
};

export function AgendaTimeline({
  loading,
  dateLabel,
  planProgress,
  totalBlocks,
  totalMinutes,
  hasAnything,
  hasToday,
  todayItems,
  upcomingGroups,
  hasMoreUpcoming,
  onReplan,
  onComplete,
}: {
  loading: boolean;
  dateLabel: string;
  planProgress: number;
  totalBlocks: number;
  totalMinutes: number;
  hasAnything: boolean;
  hasToday: boolean;
  todayItems: TimelineItem[];
  upcomingGroups: Array<[string, TimelineItem[]]>;
  hasMoreUpcoming: boolean;
  onReplan: () => void;
  onComplete: (taskId: string) => void;
}) {
  return (
    <section className="app-glass flex flex-col rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
            Línea de tiempo de hoy
          </h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-white/35">
            {dateLabel} · {totalBlocks} bloque{totalBlocks === 1 ? "" : "s"} ·{" "}
            {formatMinutes(totalMinutes)}
          </p>
        </div>
        <button
          type="button"
          onClick={onReplan}
          disabled={loading}
          className="app-glass-soft flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100/65 hover:text-slate-900 disabled:opacity-50 dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white/85"
        >
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Replanificar
        </button>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#30d158] to-[#64d2ff] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, planProgress))}%` }}
        />
      </div>

      <div className="mt-3 min-h-0 flex-1">
        {loading && (
          <div className="space-y-2 pt-1">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex animate-pulse items-center gap-4 px-2 py-3">
                <span className="h-3 w-10 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07]" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900/[0.08] dark:bg-white/[0.09]" />
                <span className="h-3 flex-1 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.06]" />
              </div>
            ))}
          </div>
        )}

        {!loading && !hasAnything && (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-slate-400 ring-1 ring-slate-900/[0.05] dark:bg-white/[0.05] dark:text-white/35 dark:ring-white/[0.06]">
              <CalendarClock className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <p className="mt-3 text-[13px] font-medium text-slate-700 dark:text-white/70">
              Nada en el horizonte
            </p>
            <p className="mt-1 max-w-xs text-[11.5px] leading-5 text-slate-500 dark:text-white/35">
              No hay bloques para hoy. Añade una tarea o disfruta del tiempo libre.
            </p>
            <Link
              href="/planner"
              className="app-glass-soft mt-4 flex h-11 items-center gap-1.5 rounded-xl px-3 md:h-8 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100/65 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white"
            >
              Abrir planificador
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {!loading && hasAnything && (
          <div>
            {hasToday ? (
              <div className="space-y-0.5">
                {todayItems.map((item) => {
                  const current = isNow(item);
                  const color = PRIORITY_COLOR[item.priority] ?? "#8e8e93";
                  return (
                    <div
                      key={`today-${item.task_id}`}
                      className={cn(
                        "group relative flex items-start gap-3 rounded-2xl px-2 py-2.5 transition-colors",
                        current
                          ? "bg-slate-900/[0.04] dark:bg-white/[0.05]"
                          : "hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.035]",
                      )}
                    >
                      <div className="w-[48px] shrink-0 pt-0.5 text-right">
                        <p
                          className={cn(
                            "text-[11px] font-medium tabular-nums",
                            current
                              ? "text-slate-700 dark:text-white/85"
                              : "text-slate-500 dark:text-white/50",
                          )}
                        >
                          {formatTime(item.start_at)}
                        </p>
                        <p className="mt-0.5 text-[9.5px] tabular-nums text-slate-400 dark:text-white/25">
                          {formatTime(item.end_at)}
                        </p>
                      </div>

                      <div className="relative flex w-3 shrink-0 justify-center self-stretch">
                        <span className="absolute inset-y-0 w-px bg-slate-900/[0.07] dark:bg-white/[0.07]" />
                        <span
                          className="relative mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white/80 dark:ring-black/25"
                          style={{ backgroundColor: color }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p
                            className={cn(
                              "truncate text-[13px] font-[450]",
                              item.completed
                                ? "text-slate-400 line-through opacity-60 dark:text-white/30"
                                : "text-slate-700 dark:text-white/85",
                            )}
                          >
                            {item.title}
                          </p>
                          {current && (
                            <span className="shrink-0 rounded-full bg-[#30d158]/15 px-2 py-0.5 text-[9.5px] font-medium text-[#1a9e3a] dark:text-[#30d158]">
                              Ahora
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-white/30">
                          {item.course_name || "Estudio"} ·{" "}
                          {formatMinutes(minutesBetween(item.start_at, item.end_at))}
                        </p>
                      </div>

                      <button
                        type="button"
                        aria-label={`Completar ${item.title}`}
                        title="Completar bloque"
                        onClick={() => onComplete(item.task_id)}
                        className={cn(
                          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                          item.completed
                            ? "border-[#30d158]/60 bg-[#30d158]/15 text-[#1a9e3a] dark:text-[#30d158]"
                            : "border-slate-300 text-transparent hover:border-[#30d158]/70 hover:bg-[#30d158]/10 hover:text-[#1a9e3a] dark:border-white/20 dark:hover:text-[#30d158]",
                        )}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-2 py-5 text-[11.5px] text-slate-500 dark:text-white/35">
                <CalendarClock className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/25" strokeWidth={1.7} />
                Hoy está libre. Los próximos bloques aparecen abajo.
              </div>
            )}

            {upcomingGroups.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-3 px-2 pb-2">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/25">
                    Próximos bloques
                  </p>
                  <span className="h-px flex-1 bg-slate-900/[0.06] dark:bg-white/[0.06]" />
                </div>

                <div className="space-y-4">
                  {upcomingGroups.map(([dayKey, items]) => (
                    <div key={dayKey}>
                      <p className="px-2 pb-1 text-[10px] font-medium text-slate-500 dark:text-white/35">
                        {dayHeading(items[0].start_at)}
                      </p>
                      <div className="space-y-0.5">
                        {items.map((item) => (
                          <div
                            key={`${item.task_id}-${item.start_at}`}
                            className="flex items-start gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.035]"
                          >
                            <div className="w-[48px] shrink-0 pt-0.5 text-right">
                              <p className="text-[11px] font-medium tabular-nums text-slate-500 dark:text-white/45">
                                {formatTime(item.start_at)}
                              </p>
                              <p className="mt-0.5 text-[9.5px] tabular-nums text-slate-400 dark:text-white/25">
                                {formatTime(item.end_at)}
                              </p>
                            </div>
                            <div className="relative flex w-3 shrink-0 justify-center self-stretch">
                              <span className="absolute inset-y-0 w-px bg-slate-900/[0.07] dark:bg-white/[0.07]" />
                              <span
                                className="relative mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white/80 dark:ring-black/25"
                                style={{
                                  backgroundColor:
                                    PRIORITY_COLOR[item.priority] ?? "#8e8e93",
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12.5px] text-slate-600 dark:text-white/70">
                                {item.title}
                              </p>
                              <p className="mt-0.5 truncate text-[10.5px] text-slate-400 dark:text-white/25">
                                {item.course_name || "Estudio"} ·{" "}
                                {formatMinutes(item.estimated_minutes ?? 0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {hasMoreUpcoming && (
                  <Link
                    href="/planner"
                    className="mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-white/35 dark:hover:text-white/70"
                  >
                    Ver horario completo
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
