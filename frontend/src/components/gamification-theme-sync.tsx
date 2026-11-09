"use client";

import { useEffect } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  COSMETICS_EVENT,
  XP_EVENT,
  applyCosmeticTheme,
  getGamification,
  getLevelInfo,
  getUnlockedRewards,
} from "@/lib/gamification";

/** Aplica el tema cosmético equipado aunque la tarjeta de nivel no esté visible. */
export function GamificationThemeSync() {
  const { user } = useAuth();

  useEffect(() => {
    const sync = () => {
      if (!user) {
        applyCosmeticTheme(null);
        return;
      }
      const state = getGamification(user.id);
      const level = getLevelInfo(state.xp).level;
      const valid = getUnlockedRewards(level).some(
        (reward) => reward.kind === "theme" && reward.id === state.equippedTheme,
      );
      applyCosmeticTheme(valid ? state.equippedTheme : null);
    };
    sync();
    window.addEventListener(COSMETICS_EVENT, sync);
    window.addEventListener(XP_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COSMETICS_EVENT, sync);
      window.removeEventListener(XP_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [user]);

  return null;
}
