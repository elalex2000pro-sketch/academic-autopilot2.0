"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "academic-autopilot-preferences";

export interface Preferences {
  /** Aplica tachado y tono apagado a las vencidas dentro del historial. */
  autoStrikeOverdue: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  autoStrikeOverdue: true,
};

interface PreferencesContextValue extends Preferences {
  setAutoStrikeOverdue: (value: boolean) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      autoStrikeOverdue:
        typeof parsed.autoStrikeOverdue === "boolean"
          ? parsed.autoStrikeOverdue
          : DEFAULT_PREFERENCES.autoStrikeOverdue,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function persistPreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    /* El almacenamiento puede estar bloqueado; la preferencia sigue en memoria. */
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPreferences(readPreferences());
  }, []);

  const setAutoStrikeOverdue = useCallback((value: boolean) => {
    setPreferences((current) => {
      const next = { ...current, autoStrikeOverdue: value };
      persistPreferences(next);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    persistPreferences(DEFAULT_PREFERENCES);
  }, []);

  const value = useMemo(
    () => ({ ...preferences, setAutoStrikeOverdue, resetPreferences }),
    [preferences, resetPreferences, setAutoStrikeOverdue],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences debe usarse dentro de PreferencesProvider");
  }
  return context;
}
