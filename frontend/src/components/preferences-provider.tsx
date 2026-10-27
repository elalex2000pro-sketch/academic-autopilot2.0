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

export type AnimationLevel = "reduced" | "standard" | "fluid";
export type PerformanceProfile = "efficiency" | "quality";

export interface Preferences {
  /** Aplica tachado y tono apagado a las vencidas dentro del historial. */
  autoStrikeOverdue: boolean;
  /**
   * Ventana sin marco nativo con semáforos de macOS. En el navegador solo
   * controla si se muestran los semáforos decorativos; en Electron además
   * reinicia la ventana con `frame: false`.
   */
  useCustomTitlebar: boolean;
  /** Intensidad global de transiciones y animaciones. */
  animationLevel: AnimationLevel;
  /** Perfil de coste visual: cristal completo o interfaz plana y ligera. */
  performanceProfile: PerformanceProfile;
}

const DEFAULT_PREFERENCES: Preferences = {
  autoStrikeOverdue: true,
  useCustomTitlebar: true,
  animationLevel: "standard",
  performanceProfile: "quality",
};

const ANIMATION_LEVELS: AnimationLevel[] = ["reduced", "standard", "fluid"];
const PERFORMANCE_PROFILES: PerformanceProfile[] = ["efficiency", "quality"];

interface PreferencesContextValue extends Preferences {
  setAutoStrikeOverdue: (value: boolean) => void;
  setUseCustomTitlebar: (value: boolean) => void;
  setAnimationLevel: (value: AnimationLevel) => void;
  setPerformanceProfile: (value: PerformanceProfile) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function isAnimationLevel(value: unknown): value is AnimationLevel {
  return typeof value === "string" && (ANIMATION_LEVELS as string[]).includes(value);
}

function isPerformanceProfile(value: unknown): value is PerformanceProfile {
  return typeof value === "string" && (PERFORMANCE_PROFILES as string[]).includes(value);
}

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
      useCustomTitlebar:
        typeof parsed.useCustomTitlebar === "boolean"
          ? parsed.useCustomTitlebar
          : DEFAULT_PREFERENCES.useCustomTitlebar,
      animationLevel: isAnimationLevel(parsed.animationLevel)
        ? parsed.animationLevel
        : DEFAULT_PREFERENCES.animationLevel,
      performanceProfile: isPerformanceProfile(parsed.performanceProfile)
        ? parsed.performanceProfile
        : DEFAULT_PREFERENCES.performanceProfile,
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

/**
 * Publica el nivel de animación y el perfil de rendimiento en `<html>` para que
 * `globals.css` pueda resolverlos sin que cada componente conozca el estado.
 */
function applyInterfacePreferences(preferences: Preferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.animations = preferences.animationLevel;
  root.dataset.performance = preferences.performanceProfile;
}

/**
 * Pide a Electron que reconstruya la ventana con o sin marco nativo. El proceso
 * principal guarda además la preferencia en disco para aplicarla al arrancar.
 */
function applyTitlebarToDesktop(value: boolean) {
  if (typeof window === "undefined") return;
  const bridge = window.autopilotDesktop;
  if (!bridge?.setCustomTitlebar) return;
  void bridge.setCustomTitlebar(value).catch(() => {
    /* Si el escritorio es antiguo o falla, la web sigue funcionando. */
  });
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  // Mantiene los atributos del documento sincronizados con cada cambio. El
  // primer render usa los valores por defecto; el efecto de montaje aplica los
  // guardados y el script de `layout.tsx` los adelanta antes del primer pintado.
  useEffect(() => {
    applyInterfacePreferences(preferences);
  }, [preferences.animationLevel, preferences.performanceProfile]);

  useEffect(() => {
    const stored = readPreferences();
    setPreferences(stored);
    applyInterfacePreferences(stored);

    // En Electron el proceso principal manda: la ventana ya se creó con un
    // marco concreto antes de que exista el renderer. Sincronizamos el estado
    // para que el interruptor y los semáforos reflejen la ventana real.
    const bridge = window.autopilotDesktop;
    if (!bridge?.getWindowPreferences) return;
    let cancelled = false;
    void bridge
      .getWindowPreferences()
      .then((desktopPreferences) => {
        if (cancelled || typeof desktopPreferences?.useCustomTitlebar !== "boolean") return;
        setPreferences((current) => {
          const next = {
            ...current,
            useCustomTitlebar: desktopPreferences.useCustomTitlebar,
          };
          persistPreferences(next);
          return next;
        });
      })
      .catch(() => {
        /* Sin puente de escritorio seguimos con localStorage. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAutoStrikeOverdue = useCallback((value: boolean) => {
    setPreferences((current) => {
      const next = { ...current, autoStrikeOverdue: value };
      persistPreferences(next);
      return next;
    });
  }, []);

  const setUseCustomTitlebar = useCallback((value: boolean) => {
    setPreferences((current) => {
      const next = { ...current, useCustomTitlebar: value };
      persistPreferences(next);
      return next;
    });
    applyTitlebarToDesktop(value);
  }, []);

  const setAnimationLevel = useCallback((value: AnimationLevel) => {
    setPreferences((current) => {
      const next = { ...current, animationLevel: value };
      persistPreferences(next);
      return next;
    });
  }, []);

  const setPerformanceProfile = useCallback((value: PerformanceProfile) => {
    setPreferences((current) => {
      const next = { ...current, performanceProfile: value };
      persistPreferences(next);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    const next = { ...DEFAULT_PREFERENCES };
    setPreferences(next);
    persistPreferences(next);
    applyInterfacePreferences(next);
    if (preferences.useCustomTitlebar !== next.useCustomTitlebar) {
      applyTitlebarToDesktop(next.useCustomTitlebar);
    }
  }, [preferences.useCustomTitlebar]);

  const value = useMemo(
    () => ({
      ...preferences,
      setAutoStrikeOverdue,
      setUseCustomTitlebar,
      setAnimationLevel,
      setPerformanceProfile,
      resetPreferences,
    }),
    [
      preferences,
      resetPreferences,
      setAnimationLevel,
      setAutoStrikeOverdue,
      setPerformanceProfile,
      setUseCustomTitlebar,
    ],
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
