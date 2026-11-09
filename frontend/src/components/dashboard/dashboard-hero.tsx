"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { openAiDrawer } from "@/lib/ai-drawer";

import { DASHBOARD_ITEM } from "@/lib/dashboard";

export function DashboardHero({
  dateLabel,
  greeting,
  name,
  taskCount,
  planProgress,
  impulse,
  urgentCount,
}: {
  dateLabel: string;
  greeting: string;
  name: string;
  taskCount: number;
  planProgress: number;
  impulse: string;
  urgentCount: number;
}) {
  return (
    <motion.section
      variants={DASHBOARD_ITEM}
      className="relative overflow-hidden rounded-[30px] border border-white/55 bg-[linear-gradient(118deg,#e9e4f8_0%,#f2eefb_52%,#ddd7f3_100%)] p-6 text-[#28233a] shadow-[0_22px_58px_-42px_rgba(55,45,90,0.4),inset_0_1px_0_rgba(255,255,255,0.82)] sm:p-7"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-[#c8bdf2]/55 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 top-8 h-36 w-36 rotate-45 rounded-[38%] border border-white/55 bg-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/30 blur-3xl"
      />

      <div className="relative z-10 flex h-full min-h-[238px] flex-col justify-between gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b536e] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]" />
            {dateLabel}
          </span>
          <span className="hidden rounded-full bg-white/45 px-2.5 py-1 text-[10px] font-semibold text-[#5b536e] sm:block">
            Tu espacio
          </span>
        </div>

        <div>
          <h1 className="max-w-2xl text-[30px] font-semibold leading-[1.02] tracking-[-0.055em] text-[#211d2e] sm:text-[40px]">
            {greeting}, {name}.
          </h1>
          <p className="mt-2 max-w-xl text-[12.5px] leading-5 text-[#5b536e] sm:text-[13px]">
            {taskCount > 0
              ? `Tienes ${taskCount} tarea${taskCount === 1 ? "" : "s"} pendiente${
                  taskCount === 1 ? "" : "s"
                } · ${planProgress}% del plan de hoy completado.`
              : "No tienes tareas pendientes. Buen momento para adelantar apuntes o crear un cuaderno nuevo."}
          </p>
          <p className="mt-2 flex max-w-xl items-start gap-1.5 text-[11px] leading-5 text-[#5b536e]/80">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6d5ca8]" strokeWidth={1.8} />
            <span className="line-clamp-2">{impulse}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/planner"
            className="inline-flex h-11 touch-manipulation items-center gap-1.5 rounded-full bg-[#1b1b1f] px-4 text-[11.5px] font-semibold text-white shadow-[0_12px_26px_-14px_rgba(20,20,28,0.9)] transition-transform hover:-translate-y-0.5"
          >
            Abrir planificador
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={openAiDrawer}
            className="inline-flex h-11 touch-manipulation items-center gap-1.5 rounded-full border border-white/60 bg-white/45 px-4 text-[11.5px] font-semibold text-[#3f3852] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition-colors hover:bg-white/65"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Crear con IA
          </button>
          {urgentCount > 0 ? (
            <span className="ml-auto hidden rounded-full bg-[#ff3b30]/10 px-2.5 py-1 text-[10px] font-semibold text-[#a52b24] md:block">
              {urgentCount} urgente{urgentCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
