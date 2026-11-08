/**
 * Fallback de las vistas cargadas bajo demanda. Mantiene la silueta del
 * contenido para que la navegación no muestre una pantalla vacía.
 */
export function ViewLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="mx-auto w-full max-w-5xl px-4 pb-10 pt-7"
    >
      <div className="animate-pulse space-y-4 motion-reduce:animate-none">
        <div className="space-y-2">
          <div className="h-2.5 w-20 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.05]" />
          <div className="h-7 w-2/3 max-w-sm rounded-full bg-slate-900/[0.08] dark:bg-white/[0.08]" />
          <div className="h-3 w-1/2 max-w-xs rounded-full bg-slate-900/[0.05] dark:bg-white/[0.05]" />
        </div>
        <div className="h-24 rounded-3xl border border-white/40 bg-slate-100/60 dark:border-white/[0.06] dark:bg-white/[0.035]" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-40 rounded-3xl border border-white/40 bg-slate-100/60 dark:border-white/[0.06] dark:bg-white/[0.035]" />
          <div className="h-40 rounded-3xl border border-white/40 bg-slate-100/60 dark:border-white/[0.06] dark:bg-white/[0.035]" />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
