"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { DailyFocus } from "@/components/daily-focus";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { DailyAgenda } from "@/lib/types";

/**
 * Modo Enfoque: vista de pantalla completa que muestra unicamente el plan del
 * dia. El boton de pantalla completa elimina distracciones del navegador.
 */
export default function FocusPage() {
  const [agenda, setAgenda] = useState<DailyAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgenda(await api.today());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  const handleComplete = useCallback(
    async (id: string) => {
      await api.completeTask(id);
      await load();
    },
    [load],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modo Enfoque</h1>
          <p className="text-sm text-muted-foreground">
            Solo lo que toca hacer hoy. Una cosa despues de otra.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {fullscreen ? "Salir" : "Pantalla completa"}
        </Button>
      </header>

      <DailyFocus agenda={agenda} loading={loading} onComplete={handleComplete} onReplan={load} />
    </div>
  );
}
