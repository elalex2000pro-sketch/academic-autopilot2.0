"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Sparkles, Zap } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { DASHBOARD_ITEM } from "@/lib/dashboard";
import {
  FOCUS_XP,
  TASK_XP,
  XP_EVENT,
  getGamification,
  getLevelInfo,
  type LevelInfo,
} from "@/lib/gamification";

function readLevel(userId: string | undefined): LevelInfo | null {
  if (!userId || typeof window === "undefined") return null;
  return getLevelInfo(getGamification(userId).xp);
}

/** Tarjeta de progreso: nivel, título y EXP, integrada en el cristal del Dashboard. */
export function GamificationCard() {
  const { user } = useAuth();
  const [info, setInfo] = useState<LevelInfo | null>(() => readLevel(user?.id));

  useEffect(() => {
    if (!user) {
      setInfo(null);
      return;
    }
    const sync = () => setInfo(getLevelInfo(getGamification(user.id).xp));
    sync();
    window.addEventListener(XP_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(XP_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [user]);

  if (!user) return null;

  if (!info) {
    return (
      <motion.section
        variants={DASHBOARD_ITEM}
        aria-busy="true"
        className="app-glass-strong relative overflow-hidden rounded-[26px] border border-white/45 p-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.55)] dark:border-white/10 sm:p-5"
      >
        <div className="flex animate-pulse items-center gap-4">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-black/[0.06] dark:bg-white/[0.08]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-2.5 w-36 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
            <div className="h-4 w-52 max-w-full rounded-full bg-black/[0.08] dark:bg-white/[0.1]" />
            <div className="h-1.5 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      variants={DASHBOARD_ITEM}
      aria-label={`Nivel ${info.level}, ${info.title}, ${info.xp} EXP`}
      className="app-glass-strong relative overflow-hidden rounded-[26px] border border-white/45 p-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.55)] dark:border-white/10 sm:p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#0066FF]/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-1/3 h-36 w-36 rounded-full bg-[#c084fc]/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066FF] via-[#6a7bff] to-[#c084fc] text-white shadow-[0_10px_24px_-12px_rgba(0,102,255,0.8)]">
          <span className="text-[7.5px] font-semibold uppercase tracking-[0.14em] opacity-75">
            Nivel
          </span>
          <span className="text-[22px] font-bold leading-none">{info.level}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-white/40">
              <Sparkles className="h-3 w-3 text-[#0066FF] dark:text-[#8ab9ff]" />
              Nivel y experiencia
            </p>
            <p className="text-[10.5px] font-semibold tabular-nums text-slate-500 dark:text-white/40">
              {info.xp} EXP
            </p>
          </div>

          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <p className="text-[17px] font-semibold tracking-[-0.025em] text-slate-800 dark:text-white/90">
              {info.title}
            </p>
            <span className="text-[10px] font-medium text-slate-400 dark:text-white/30">
              Nivel {info.level}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(info.progress * 100)}
            aria-label={`Progreso al nivel ${info.level + 1}`}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, Math.round(info.progress * 100))}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-[#0066FF] to-[#c084fc]"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-white/35">
            {info.toNext > 0
              ? `Te faltan ${info.toNext} EXP para el nivel ${info.level + 1}.`
              : "Nivel máximo alcanzado por ahora."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5 sm:max-w-[230px] sm:justify-end">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#0066FF]/20 bg-[#0066FF]/[0.06] px-2 py-1 text-[9.5px] font-semibold text-[#0055d4] dark:border-[#8ab9ff]/20 dark:bg-[#8ab9ff]/[0.08] dark:text-[#a9ccff]">
            <Zap className="h-2.5 w-2.5" /> +{TASK_XP} por tarea
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/[0.06] px-2 py-1 text-[9.5px] font-semibold text-violet-700 dark:border-violet-300/20 dark:bg-violet-400/[0.08] dark:text-violet-200">
            <Flame className="h-2.5 w-2.5" /> +{FOCUS_XP} por enfoque
          </span>
        </div>
      </div>
    </motion.section>
  );
}
