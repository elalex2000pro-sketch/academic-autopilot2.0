"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getChannel,
  getCurrentVersion,
  requestUpdateCheck,
  type UpdateChannel,
} from "@/lib/app-update";
import { cn } from "@/lib/utils";

/**
 * Acción manual para lanzar la misma comprobación que se hace al arrancar.
 * El modal global escucha el evento y muestra el resultado.
 */
export function UpdateCheckButton({ className }: { className?: string }) {
  const [channel, setChannel] = useState<UpdateChannel>("web");
  const [version, setVersion] = useState("");

  useEffect(() => {
    setChannel(getChannel());
    setVersion(getCurrentVersion());
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-slate-300/45 bg-slate-100/45 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06] dark:bg-white/[0.03]",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-white/90">
          <RefreshCw className="h-3.5 w-3.5 text-[#0066FF] dark:text-[#8ab9ff]" />
          Actualizaciones
        </p>
        <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
          {version
            ? `Versión ${channel === "desktop" ? "de escritorio" : "web"} ${version}. `
            : ""}
          La app comprueba si hay novedades al abrirse; también puedes buscarlas ahora.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => requestUpdateCheck()}
        className="h-9 shrink-0 rounded-xl px-3.5"
      >
        <RefreshCw className="h-4 w-4" /> Buscar actualizaciones
      </Button>
    </div>
  );
}
