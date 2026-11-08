"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, api, tokenStore } from "@/lib/api";
import { clearLocalAppData } from "@/lib/local-cache";
import { clearTaskExclusions } from "@/lib/task-store";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName?: string,
    recovery?: { question: string; answer: string },
  ) => Promise<void>;
  recover: (email: string, answer: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// El perfil se guarda para pintar el shell de inmediato en el siguiente
// arranque. La sesión se sigue validando contra `/auth/me` en segundo plano.
const USER_CACHE_KEY = "autopilot_user";

function readCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { email?: unknown } | null;
    return value && typeof value.email === "string" ? (value as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // Sin almacenamiento disponible seguimos usando la respuesta de la API.
  }
}

function clearCachedUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Nada que limpiar.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Carga el perfil si hay token guardado. Si existe una copia local, el shell
  // se pinta al instante y la validación real ocurre en segundo plano.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      clearCachedUser();
      setLoading(false);
      return;
    }

    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    api
      .me()
      .then((profile) => {
        setUser(profile);
        writeCachedUser(profile);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          tokenStore.clear();
          clearCachedUser();
          clearTaskExclusions();
          void clearLocalAppData();
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.login({ email, password });
      await clearLocalAppData();
      clearTaskExclusions();
      tokenStore.set(access_token);
      const profile = await api.me();
      writeCachedUser(profile);
      setUser(profile);
      router.push("/");
    },
    [router],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      fullName?: string,
      recovery?: { question: string; answer: string },
    ) => {
      const { access_token } = await api.register({
        email,
        password,
        full_name: fullName,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recovery_question: recovery?.question,
        recovery_answer: recovery?.answer,
      });
      await clearLocalAppData();
      clearTaskExclusions();
      tokenStore.set(access_token);
      const profile = await api.me();
      writeCachedUser(profile);
      setUser(profile);
      router.push("/");
    },
    [router],
  );

  const recover = useCallback(
    async (email: string, answer: string, newPassword: string) => {
      const { access_token } = await api.resetPassword({
        email,
        answer,
        new_password: newPassword,
      });
      await clearLocalAppData();
      clearTaskExclusions();
      tokenStore.set(access_token);
      const profile = await api.me();
      writeCachedUser(profile);
      setUser(profile);
      router.push("/");
    },
    [router],
  );

  const refreshUser = useCallback(async () => {
    const profile = await api.me();
    writeCachedUser(profile);
    setUser(profile);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    clearCachedUser();
    clearTaskExclusions();
    void clearLocalAppData();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, recover, refreshUser, logout }),
    [user, loading, login, register, recover, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
