"use client";

import type * as React from "react";
import type { RefObject } from "react";
import { Cpu, Download, Loader2, Trash2, Upload, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-center";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODEL_OPTIONS, GEMINI_RETIRED_NOTE } from "@/lib/ai-models";
import type { AssistantMessage, AssistantStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type StudioMode } from "@/lib/studio";

type Props = {
  status: AssistantStatus | null;
  changingModel: boolean;
  changeModel: (model: string) => Promise<void>;
  embedded: boolean;
  aiState: "idle" | "thinking" | "responding";
  mode: StudioMode;
  importInputRef: RefObject<HTMLInputElement>;
  importChat: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  importing: boolean;
  exportChat: () => Promise<void>;
  messages: AssistantMessage[];
  exporting: boolean;
  clearChat: () => Promise<void>;
  clearing: boolean;
  hasConversation: boolean;
  onClose: (() => void) | undefined;
};

export function StudioHeader({ status, changingModel, changeModel, embedded, aiState, mode, importInputRef, importChat, importing, exportChat, messages, exporting, clearChat, clearing, hasConversation, onClose }: Props) {
  return (
<header className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100/60 text-[#0066FF] shadow-sm backdrop-blur-xl dark:bg-white/10 dark:text-[#8ab9ff]">
            <Wand2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white/90">
              IA Studio
            </h1>
            <p className="truncate text-[10px] text-slate-500 dark:text-white/35">
              Tu centro de IA: chat tutor, audio y documentos
            </p>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-0.5">
          {status?.provider === "gemini" && (
            <label
              title={GEMINI_RETIRED_NOTE}
              className="mr-1 flex h-8 max-w-[128px] items-center gap-1 rounded-full border border-slate-300/45 bg-slate-100/65 pl-2 pr-1 text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white/50"
            >
              {changingModel ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#0066FF]" />
              ) : (
                <Cpu className="h-3 w-3 shrink-0 text-[#0066FF] dark:text-[#8ab9ff]" />
              )}
              <select
                value={status.model}
                onChange={(event) => void changeModel(event.target.value)}
                disabled={changingModel}
                aria-label="Modelo de Gemini"
                className="min-w-0 flex-1 cursor-pointer appearance-none truncate border-0 bg-transparent p-0 text-[10px] font-semibold text-slate-600 outline-none disabled:opacity-50 dark:text-white/60"
              >
                {GEMINI_MODEL_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-white text-slate-800 dark:bg-[#10151f] dark:text-white"
                  >
                    {option.label.split(" · ")[0].replace(/^Gemini\s+/, "")}
                  </option>
                ))}
                {!GEMINI_MODEL_OPTIONS.some((option) => option.value === status.model) && (
                  <option
                    value={status.model}
                    className="bg-white text-slate-800 dark:bg-[#10151f] dark:text-white"
                  >
                    {status.model}
                  </option>
                )}
              </select>
              <span aria-hidden className="pr-0.5 text-[8px] opacity-60">
                ▾
              </span>
            </label>
          )}
          {status?.provider === "gemini" && status.model !== DEFAULT_GEMINI_MODEL && (
            <Button
              variant="ghost"
              size="sm"
              disabled={changingModel}
              onClick={() => void changeModel(DEFAULT_GEMINI_MODEL)}
              className="h-8 rounded-full px-2 text-[10px]"
            >
              Modelo por defecto
            </Button>
          )}
          <NotificationBell className={cn(embedded ? "hidden" : "hidden lg:inline-flex")} />
          <Badge
            variant="secondary"
            className={cn(
              "mr-1 hidden rounded-full border text-[9.5px] font-semibold backdrop-blur-xl transition-colors duration-500 sm:flex",
              embedded && "sm:hidden",
              aiState === "idle" &&
                "border-slate-300/40 bg-slate-100/60 text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/45",
              aiState === "thinking" &&
                "border-violet-400/30 bg-violet-500/10 text-violet-600 dark:border-violet-300/20 dark:bg-violet-400/10 dark:text-violet-200",
              aiState === "responding" &&
                "border-cyan-400/35 bg-cyan-400/10 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-400/10 dark:text-cyan-200",
            )}
          >
            <span
              className={cn(
                "mr-1 h-1.5 w-1.5 rounded-full transition-colors duration-500",
                aiState === "idle" && "bg-[#34C759]",
                aiState === "thinking" && "animate-pulse bg-violet-500 dark:bg-violet-300",
                aiState === "responding" && "bg-cyan-500 dark:bg-cyan-300",
              )}
            />
            {aiState === "idle" ? "En línea" : aiState === "thinking" ? "Pensando…" : "Respondiendo"}
          </Badge>
          {mode === "chat" && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={importChat}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                title="Importar una conversación exportada"
                className="h-8 rounded-full px-2 text-[11px]"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span className={embedded ? "hidden" : "hidden sm:inline"}>Importar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void exportChat()}
                disabled={messages.length === 0 || exporting}
                title="Descargar la conversación"
                className="h-8 rounded-full px-2 text-[11px]"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className={embedded ? "hidden" : "hidden sm:inline"}>Exportar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void clearChat()}
                disabled={clearing || !hasConversation}
                className="h-8 rounded-full px-2 text-[11px]"
              >
                {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span className={embedded ? "hidden" : "hidden sm:inline"}>Limpiar</span>
              </Button>
            </>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Cerrar IA Studio"
              title="Cerrar"
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>
  );
}
