"use client";

import { Check, Loader2, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PendingAction } from "@/lib/types";

export function PendingActionCard({
  pending,
  confirming,
  onConfirm,
}: {
  pending: PendingAction;
  confirming: boolean;
  onConfirm: (approve: boolean) => void;
}) {
  return (
    <div className="animate-fade-up rounded-3xl border border-amber-400/45 bg-amber-100/55 p-3 text-slate-700 backdrop-blur-xl dark:border-amber-400/20 dark:bg-amber-500/[0.08] dark:text-white/75">
      <p className="flex items-center gap-2 text-[12px] font-semibold">
        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" /> Confirmar acción
      </p>
      <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-white/50">
        La IA quiere ejecutar <code className="rounded bg-slate-100/70 px-1 py-0.5 dark:bg-white/10">{pending.tool}</code>.
      </p>
      <pre className="mt-1.5 max-h-24 overflow-auto rounded-xl bg-slate-100/55 p-2 text-[9.5px] leading-4 text-slate-500 dark:bg-black/20 dark:text-white/40">
        {JSON.stringify(pending.args, null, 2)}
      </pre>
      <div className="mt-2.5 flex gap-1.5">
        <Button size="sm" onClick={() => onConfirm(true)} disabled={confirming}>
          {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Sí, adelante
        </Button>
        <Button size="sm" variant="outline" onClick={() => onConfirm(false)} disabled={confirming}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
