"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Gift, Lock, Sparkles, Trophy } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  COSMETIC_REWARDS,
  COSMETICS_EVENT,
  XP_EVENT,
  applyCosmeticTheme,
  getGamification,
  getNextReward,
  getUnlockedRewards,
  getUnlockedStickers,
  setEquippedBadge,
  setEquippedTheme,
} from "@/lib/gamification";
import { cn } from "@/lib/utils";

/**
 * Estantería compacta de recompensas. Las insignias y los temas se eligen a
 * mano, pero se desbloquean automáticamente al alcanzar su nivel.
 */
export function RewardShelf({ level }: { level: number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const sync = () => setRevision((value) => value + 1);
    window.addEventListener(COSMETICS_EVENT, sync);
    window.addEventListener(XP_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COSMETICS_EVENT, sync);
      window.removeEventListener(XP_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const state = useMemo(
    () => (user ? getGamification(user.id) : null),
    [revision, user],
  );
  const unlocked = useMemo(() => getUnlockedRewards(level), [level]);
  const unlockedStickers = useMemo(() => getUnlockedStickers(level), [level]);
  const next = useMemo(() => getNextReward(level), [level]);
  const badges = COSMETIC_REWARDS.filter((reward) => reward.kind === "badge");
  const themes = COSMETIC_REWARDS.filter((reward) => reward.kind === "theme");
  const currentBadge = state?.equippedBadge ?? null;
  const currentTheme = state?.equippedTheme ?? null;

  if (!user) return null;

  function equipBadge(id: string | null) {
    if (!user) return;
    if (setEquippedBadge(user.id, id)) setRevision((value) => value + 1);
  }

  function equipTheme(id: string | null) {
    if (!user) return;
    if (setEquippedTheme(user.id, id)) {
      applyCosmeticTheme(id);
      setRevision((value) => value + 1);
    }
  }

  return (
    <div className="mt-3 border-t border-black/[0.06] pt-3 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-[10px] font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:text-white/40 dark:hover:text-white/75"
      >
        <Gift className="h-3.5 w-3.5" />
        Recompensas de nivel
        <span className="rounded-full bg-[#0066FF]/10 px-1.5 py-0.5 text-[9px] tabular-nums text-[#0066FF] dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]">
          {unlocked.length}/{COSMETIC_REWARDS.length}
        </span>
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="mt-2.5 rounded-xl border border-slate-300/35 bg-slate-100/45 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
              Insignia de perfil
            </p>
            {currentBadge ? (
              <button
                type="button"
                onClick={() => equipBadge(null)}
                className="text-[9px] text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white/70"
              >
                Quitar
              </button>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {badges.map((reward) => {
              const isUnlocked = reward.level <= level;
              const selected = currentBadge === reward.id;
              return (
                <button
                  key={reward.id}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => equipBadge(reward.id)}
                  title={isUnlocked ? `Equipar ${reward.name}` : `Se desbloquea en el nivel ${reward.level}`}
                  aria-label={isUnlocked ? `Equipar insignia ${reward.name}` : `${reward.name}, bloqueada hasta el nivel ${reward.level}`}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-lg border px-2 text-[10px] font-medium transition-colors",
                    selected
                      ? "border-[#0066FF]/35 bg-[#0066FF]/10 text-[#0055d4] dark:border-[#8ab9ff]/25 dark:bg-[#8ab9ff]/10 dark:text-[#a9ccff]"
                      : isUnlocked
                        ? "border-slate-300/40 bg-white/45 text-slate-600 hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                        : "cursor-not-allowed border-dashed border-slate-300/30 text-slate-400 opacity-60 dark:border-white/10 dark:text-white/25",
                  )}
                >
                  {isUnlocked ? <span>{reward.emoji}</span> : <Lock className="h-2.5 w-2.5" />}
                  {reward.name}
                  {selected ? <Check className="h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
            Tema exclusivo
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {themes.map((reward) => {
              const isUnlocked = reward.level <= level;
              const selected = currentTheme === reward.id;
              return (
                <button
                  key={reward.id}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => equipTheme(selected ? null : reward.id)}
                  title={isUnlocked ? reward.description : `Se desbloquea en el nivel ${reward.level}`}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors",
                    selected
                      ? "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:border-violet-300/25 dark:bg-violet-400/10 dark:text-violet-200"
                      : isUnlocked
                        ? "border-slate-300/40 bg-white/45 text-slate-600 hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                        : "cursor-not-allowed border-dashed border-slate-300/30 text-slate-400 opacity-60 dark:border-white/10 dark:text-white/25",
                  )}
                >
                  {isUnlocked ? <span>{reward.emoji}</span> : <Lock className="h-2.5 w-2.5" />}
                  {reward.name}
                  {selected ? <Check className="h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-slate-500 dark:text-white/35">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-[#0066FF]" />
              {unlockedStickers.length} stickers desbloqueados
            </span>
            {next ? (
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-2.5 w-2.5 text-amber-500" />
                Siguiente: {next.name} · Nv. {next.level}
              </span>
            ) : (
              <span>Todas las recompensas desbloqueadas.</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
