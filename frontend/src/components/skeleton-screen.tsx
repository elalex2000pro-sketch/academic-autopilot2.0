/**
 * Estructura visual de la app con CSS puro. Se renderiza en el HTML inicial
 * (dentro de `BootSplash`) para que no haya pantalla en blanco mientras se
 * descargan e hidratan los chunks de React.
 */
export function SkeletonScreen() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-dvh flex-col bg-transparent"
    >
      <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-slate-300/40 px-3 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-[10px] bg-slate-900/[0.08] dark:bg-white/[0.08]" />
          <span className="space-y-1.5">
            <span className="block h-2.5 w-28 rounded-full bg-slate-900/[0.08] dark:bg-white/[0.08]" />
            <span className="block h-2 w-20 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.05]" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-slate-900/[0.05] dark:bg-white/[0.05]" />
          <span className="h-7 w-7 rounded-lg bg-slate-900/[0.05] dark:bg-white/[0.05]" />
          <span className="h-7 w-7 rounded-lg bg-slate-900/[0.05] dark:bg-white/[0.05]" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1500px] flex-1 space-y-5 px-4 pb-28 pt-6">
        <div className="space-y-3">
          <span className="block h-2.5 w-24 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.05]" />
          <span className="block h-8 w-[68%] max-w-sm rounded-full bg-slate-900/[0.08] dark:bg-white/[0.08]" />
          <span className="block h-3 w-[48%] max-w-xs rounded-full bg-slate-900/[0.05] dark:bg-white/[0.05]" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[132px] rounded-3xl border border-white/40 bg-slate-100/60 dark:border-white/[0.06] dark:bg-white/[0.035]"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="h-[288px] rounded-3xl border border-white/40 bg-slate-100/60 dark:border-white/[0.06] dark:bg-white/[0.035]" />
          <div className="space-y-4">
            <div className="h-[144px] rounded-3xl border border-white/40 bg-slate-100/60 dark:border-white/[0.06] dark:bg-white/[0.035]" />
            <div className="h-[120px] rounded-3xl border border-white/40 bg-slate-100/60 dark:border-white/[0.06] dark:bg-white/[0.035]" />
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-10 mx-auto max-w-md">
        <div className="flex h-[68px] items-center gap-0.5 rounded-[28px] border border-white/50 bg-slate-100/85 p-1.5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0a0e16]/85">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="flex h-14 flex-1 flex-col items-center justify-center gap-1">
              <span
                className={
                  item === 0
                    ? "h-11 w-11 rounded-full bg-[#0066FF]/25 dark:bg-white/12"
                    : "h-5 w-5 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07]"
                }
              />
              <span className="h-2 w-9 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.05]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
