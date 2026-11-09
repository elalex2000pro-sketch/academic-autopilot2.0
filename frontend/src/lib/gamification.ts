/**
 * Gamificación local por usuario: EXP, niveles y recompensas.
 *
 * Se guarda en localStorage porque es progreso personal del dispositivo. Las
 * tareas premiadas se recuerdan por id para que desmarcar y volver a marcar no
 * genere EXP infinito.
 */

export const XP_EVENT = "autopilot:xp";
export const LEVEL_UP_EVENT = "autopilot:level-up";
export const TASK_XP = 15;
export const FOCUS_XP = 25;

const TITLES = [
  "Aprendiz",
  "Explorador",
  "Analista",
  "Arquitecto",
  "Ingeniero",
  "Maestro",
  "Leyenda",
];

export interface GamificationState {
  xp: number;
  awardedTasks: string[];
}

export interface LevelInfo {
  xp: number;
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  toNext: number;
}

function storageKey(userId: string): string {
  return `autopilot:gamification:${userId}`;
}

/** EXP acumulada necesaria para alcanzar un nivel. Nivel 1 = 0. */
export function xpForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return 50 * (safe - 1) * safe;
}

export function getLevelInfo(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < 99 && safeXp >= xpForLevel(level + 1)) level += 1;

  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const progress = Math.max(0, Math.min(1, (safeXp - currentLevelXp) / span));

  return {
    xp: safeXp,
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    currentLevelXp,
    nextLevelXp,
    progress,
    toNext: Math.max(0, nextLevelXp - safeXp),
  };
}

export function getGamification(userId: string): GamificationState {
  if (typeof window === "undefined" || !userId) {
    return { xp: 0, awardedTasks: [] };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { xp: 0, awardedTasks: [] };
    const parsed = JSON.parse(raw) as Partial<GamificationState>;
    return {
      xp: typeof parsed.xp === "number" && Number.isFinite(parsed.xp) ? Math.max(0, parsed.xp) : 0,
      awardedTasks: Array.isArray(parsed.awardedTasks)
        ? parsed.awardedTasks.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return { xp: 0, awardedTasks: [] };
  }
}

function writeGamification(userId: string, state: GamificationState): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* Sin almacenamiento, el progreso no persiste. */
  }
}

export function awardXp(
  userId: string,
  amount: number,
  reason: string,
): LevelInfo | null {
  if (!userId || amount <= 0) return null;

  const state = getGamification(userId);
  const before = getLevelInfo(state.xp);
  const nextXp = state.xp + Math.round(amount);
  const after = getLevelInfo(nextXp);

  writeGamification(userId, { ...state, xp: nextXp });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(XP_EVENT, {
        detail: {
          xp: after.xp,
          amount: Math.round(amount),
          reason,
          level: after.level,
          title: after.title,
          leveledUp: after.level > before.level,
          info: after,
        },
      }),
    );
    if (after.level > before.level) {
      window.dispatchEvent(
        new CustomEvent(LEVEL_UP_EVENT, {
          detail: { level: after.level, title: after.title, xp: after.xp },
        }),
      );
    }
  }

  return after;
}

/** Premia una tarea una única vez. Devuelve true si se otorgó EXP. */
export function awardTaskXp(userId: string, taskId: string): boolean {
  if (!userId || !taskId) return false;
  const state = getGamification(userId);
  if (state.awardedTasks.includes(taskId)) return false;

  writeGamification(userId, {
    ...state,
    awardedTasks: [...state.awardedTasks, taskId].slice(-2000),
  });
  awardXp(userId, TASK_XP, "Tarea completada");
  return true;
}

export function awardFocusXp(userId: string): void {
  awardXp(userId, FOCUS_XP, "Sesión de enfoque completada");
}
