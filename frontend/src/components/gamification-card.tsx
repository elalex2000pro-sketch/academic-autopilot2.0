"use client";

import { useEffect, useState } from "react";
import { Flame, Sparkles, Trophy, Zap } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { SettingsCard } from "@/components/settings/settings-ui";
import {
  FOCUS_XP,
  TASK_XP,
  XP_EVENT,
  getGamification,
  getLevelInfo,
  type LevelInfo,
} from "@/lib/gamification";

/** Tarjeta de perfil con nivel, EXP y recompensas por estudiar. */
export function GamificationCard() {
  const { user } = useAuth();
  const [info, setInfo] = useState<LevelInfo | null>(null);

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

  if (!user || !info) return null;

  return (
    <SettingsCard
      icon={Trophy}
      title="Nivel y experiencia"
      description="Gana EXP cada vez que tachas una tarea o completas una sesión de enfoque."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066FF] via-[#6a7bff] to-[#c084fc] text-white shadow-lg shadow-[#0066FF]/25">
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.14em] opacity-75">
            Nivel
          </span>
          <span className="text-[22px] font-bold leading-none">{info.level}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold text-slate-800 dark:text-white/85">
              {info.title}
            </p>
            <p className="text-[10.5px] font-medium tabular-nums text-slate-500 dark:text-white/40">
              {info.xp} EXP
            </p>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0066FF] to-[#c084fc] transition-[width] duration-500"
              style={{ width: `${Math.max(4, Math.round(info.progress * 100))}%` }}
            />
          </div>
          <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/35">
            {info.toNext > 0
              ? `Te faltan ${info.toNext} EXP para el nivel ${info.level + 1}.`
              : "Nivel máximo alcanzado por ahora."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0066FF]/20 bg-[#0066FF]/[0.06] px-2.5 py-1 text-[10px] font-semibold text-[#0055d4] dark:border-[#8ab9ff]/20 dark:bg-[#8ab9ff]/[0.08] dark:text-[#a9ccff]">
          <Zap className="h-3 w-3" /> +{TASK_XP} EXP por tarea
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.06] px-2.5 py-1 text-[10px] font-semibold text-violet-700 dark:border-violet-300/20 dark:bg-violet-400/[0.08] dark:text-violet-200">
          <Flame className="h-3 w-3" /> +{FOCUS_XP} EXP por enfoque
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/40 bg-white/40 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/40">
          <Sparkles className="h-3 w-3" /> Sube de nivel para desbloquear títulos
        </span>
      </div>
    </SettingsCard>
  );
}
