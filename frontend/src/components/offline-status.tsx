"use client";

import { useEffect, useState } from "react";
import { CloudOff, HardDrive, WifiOff } from "lucide-react";

import { LOCAL_CACHE_EVENT } from "@/lib/local-cache";

function formatTime(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Aviso discreto cuando no hay red o cuando se esta leyendo la copia local.
export function OfflineStatus() {
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setOffline(!navigator.onLine);
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onCache = (event: Event) => {
      const detail = (event as CustomEvent<{ savedAt?: string }>).detail;
      setCachedAt(detail?.savedAt ?? new Date().toISOString());
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setCachedAt(null), 10000);
    };
    window.addEventListener(LOCAL_CACHE_EVENT, onCache);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(LOCAL_CACHE_EVENT, onCache);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!offline && !cachedAt) return null;

  const savedLabel = formatTime(cachedAt ?? undefined);
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"
    >
      {offline ? (
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <HardDrive className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0">
        {offline
          ? "Sin conexión. Puedes consultar los datos guardados en este dispositivo; los apuntes nuevos se sincronizarán al volver internet."
          : "El servidor no responde. Estás viendo una copia local guardada" +
            (cachedAt ? ` (${savedLabel}).` : ".")}
      </span>
      {!offline && <CloudOff className="ml-auto hidden h-3.5 w-3.5 sm:block" />}
    </div>
  );
}
