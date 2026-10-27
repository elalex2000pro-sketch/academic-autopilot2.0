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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Carga el perfil si hay token guardado.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          tokenStore.clear();
          clearTaskExclusions();
          void clearLocalAppData();
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
      setUser(await api.me());
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
      setUser(await api.me());
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
      setUser(await api.me());
      router.push("/");
    },
    [router],
  );

  const refreshUser = useCallback(async () => {
    setUser(await api.me());
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
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
