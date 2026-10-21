"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { SyncLog } from "@/lib/types";

const PROVIDER_LABEL: Record<string, string> = {
  moodle: "Moodle",
  google_classroom: "Google Classroom",
  all: "Todas",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  success: "success",
  partial: "warning",
  error: "destructive",
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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Sincronizacion</CardTitle>
          {syncing ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> sincronizando
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <span className="h-2 w-2 animate-[pulse-ring_1.5s_ease-in-out_infinite] rounded-full bg-emerald-400" />
              en vivo
            </span>
          )}
        </div>
        <Button size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Ultima sincronizacion: {relativeTime(lastSync)}</p>

        <div className="space-y-2">
          {logs.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <WifiOff className="h-4 w-4" /> Aun no hay sincronizaciones.
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                {PROVIDER_LABEL[log.provider] ?? log.provider}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>+{log.created} ~{log.updated} -{log.removed}</span>
                <Badge variant={STATUS_VARIANT[log.status] ?? "secondary"}>
                  {log.status}
                </Badge>
              </span>
            </div>
          ))}
        </div>

        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
