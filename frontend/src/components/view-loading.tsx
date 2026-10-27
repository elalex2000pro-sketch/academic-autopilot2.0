import { Loader2 } from "lucide-react";

/** Fallback compartido por las vistas que se cargan bajo demanda. */
export function ViewLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-2.5 px-6 text-[12.5px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-[#0066FF]" />
      <span>{label}</span>
    </div>
  );
}
