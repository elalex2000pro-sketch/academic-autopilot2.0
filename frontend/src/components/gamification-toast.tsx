"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Trophy } from "lucide-react";

import {
  XP_EVENT,
  type CosmeticReward,
  type LevelInfo,
} from "@/lib/gamification";

interface XpToast {
  id: number;
  amount: number;
  reason: string;
  level: number;
  title: string;
  leveledUp: boolean;
  info: LevelInfo;
  unlocked?: CosmeticReward[];
}

/** Aviso flotante cuando se gana EXP o se sube de nivel. */
export function GamificationToast() {
  const [toast, setToast] = useState<XpToast | null>(null);

  useEffect(() => {
    const onXp = (event: Event) => {
      const detail = (event as CustomEvent<Omit<XpToast, "id">>).detail;
      if (!detail) return;
      setToast({ id: Date.now(), ...detail });
    };
    window.addEventListener(XP_EVENT, onXp);
    return () => window.removeEventListener(XP_EVENT, onXp);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed bottom-[calc(var(--mobile-nav-offset,0px)+1rem)] left-1/2 z-[90] w-[min(92vw,360px)] -translate-x-1/2 md:bottom-6 md:left-6 md:translate-x-0"
          role="status"
          aria-live="polite"
        >
          <div className="app-glass-strong flex items-center gap-3 rounded-2xl border border-white/40 px-3.5 py-3 shadow-[0_24px_60px_-28px_rgba(18,24,38,0.6)] dark:border-white/10">
            <span
              className={
                toast.leveledUp
                  ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]"
              }
            >
              {toast.leveledUp ? (
                <Trophy className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/90">
                {toast.leveledUp
                  ? `¡Nivel ${toast.level}! ${toast.title}`
                  : `+${toast.amount} EXP`}
              </p>
              <p className="truncate text-[10.5px] text-slate-500 dark:text-white/40">
                {toast.leveledUp
                  ? toast.unlocked?.length
                    ? `Desbloqueado: ${toast.unlocked.map((reward) => reward.name).join(", ")}`
                    : toast.reason
                  : `${toast.reason} · ${toast.info.xp} EXP`}
              </p>
            </div>
            {!toast.leveledUp ? (
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#0066FF] dark:text-[#8ab9ff]">
                Nv. {toast.level}
              </span>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
