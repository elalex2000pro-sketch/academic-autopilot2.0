"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { api } from "@/lib/api";
import type { SyncLog } from "@/lib/types";

const PROVIDER_LABEL: Record<string, string> = {
  moodle: "Moodle",
  google_classroom: "Google Classroom",
  all: "Todas",
};

const STATUS_COLOR: Record<string, string> = {
  success: "#30d158",
  partial: "#ff9f0a",
  error: "#ff453a",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/**
 * Panel de sincronizacion: dispara un sync manual y muestra el estado en vivo
 * (ultima ejecucion por proveedor, con auto-refresco cada 20s).
 */
export function SyncStatus({ onSynced }: { onSynced?: () => void }) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLogs(await api.syncStatus());
    } catch {
      /* silencio: el indicador no debe romper la UI */
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const results = await api.triggerSync("all");
      const summary = results
        .map((r) => `${PROVIDER_LABEL[r.provider]}: +${r.created} ~${r.updated} -${r.removed}`)
        .join(" · ");
      setMessage(summary || "Sincronizado");
      await refresh();
      onSynced?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [refresh, onSynced]);

  const lastSync = logs[0]?.finished_at ?? logs[0]?.started_at ?? null;

  return (
    <section className="app-glass rounded-3xl p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              syncing ? "bg-[#ff9f0a]" : "bg-[#30d158]"
            }`}
          />
          <p className="truncate text-[12px] font-medium text-slate-700 dark:text-white/75">
            Sincronización
          </p>
          <span className="truncate text-[9.5px] text-slate-400 dark:text-white/25">
            {syncing ? "trabajando…" : relativeTime(lastSync)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          title="Sincronizar ahora"
          aria-label="Sincronizar ahora"
          className="app-glass-soft flex h-7 w-7 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-900/[0.05] hover:text-slate-800 disabled:opacity-50 dark:text-white/35 dark:hover:bg-white/[0.08] dark:hover:text-white/75"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/30">
          <WifiOff className="h-3 w-3" /> Aún no hay sincronizaciones.
        </p>
      ) : (
        <div className="mt-2.5 space-y-1">
          {logs.slice(0, 3).map((log) => (
            <div key={log.id} className="flex items-center justify-between gap-2 text-[10.5px]">
              <span className="flex min-w-0 items-center gap-1.5 text-slate-500 dark:text-white/40">
                <Wifi className="h-3 w-3 shrink-0" />
                <span className="truncate">{PROVIDER_LABEL[log.provider] ?? log.provider}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="tabular-nums text-slate-400 dark:text-white/25">
                  +{log.created} ~{log.updated} -{log.removed}
                </span>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[log.status] ?? "#8e8e93" }}
                  title={log.status}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      {message && (
        <p className="mt-2 truncate text-[10px] text-slate-500 dark:text-white/30" title={message}>
          {message}
        </p>
      )}
    </section>
  );
}
