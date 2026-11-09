"use client";

import { useState } from "react";
import { Lock, Smile, Sparkles, X } from "lucide-react";

import {
  CHAT_STICKERS,
  type ChatSticker,
} from "@/lib/gamification";
import { cn } from "@/lib/utils";

const EMOJI_GROUPS = [
  {
    label: "Reacciones",
    emojis: ["😀", "😂", "😍", "🥳", "👍", "👏", "🔥", "💙", "🙌", "😎", "🤔", "😅", "🤯", "✨", "💪", "🫶"],
  },
  {
    label: "Estudio",
    emojis: ["📚", "📝", "🧠", "🎯", "⏰", "☕", "💡", "✅", "📌", "🧪", "📐", "🌱"],
  },
];

export function ChatExtrasPicker({
  level,
  onEmoji,
  onSticker,
  onClose,
}: {
  level: number;
  onEmoji: (emoji: string) => void;
  onSticker: (sticker: ChatSticker) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"emojis" | "stickers">("emojis");
  const unlocked = CHAT_STICKERS.filter((sticker) => sticker.level <= level);

  return (
    <div
      className="absolute bottom-full left-0 z-30 mb-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-2xl"
      role="dialog"
      aria-label="Emotes y stickers"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setTab("emojis")}
            aria-pressed={tab === "emojis"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
              tab === "emojis" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Smile className="h-3.5 w-3.5" /> Emotes
          </button>
          <button
            type="button"
            onClick={() => setTab("stickers")}
            aria-pressed={tab === "stickers"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
              tab === "stickers" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" /> Stickers
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
              {unlocked.length}
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar selector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {tab === "emojis" ? (
        <div className="max-h-64 space-y-3 overflow-y-auto p-3">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onEmoji(emoji)}
                    className="flex h-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted"
                    aria-label={`Añadir ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto p-2">
          <p className="px-1 pb-2 text-[10px] text-muted-foreground">
            Los stickers se desbloquean jugando y subiendo de nivel · nivel {level}
          </p>
          <div className="grid grid-cols-3 gap-1">
            {CHAT_STICKERS.map((sticker) => {
              const isUnlocked = sticker.level <= level;
              return (
                <button
                  key={sticker.id}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => onSticker(sticker)}
                  title={isUnlocked ? `${sticker.name} · Pack ${sticker.pack}` : `Se desbloquea en el nivel ${sticker.level}`}
                  className={cn(
                    "relative flex min-h-[74px] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-colors",
                    isUnlocked
                      ? "border-border bg-background/60 hover:border-primary/35 hover:bg-primary/5"
                      : "cursor-not-allowed border-dashed border-border/60 bg-muted/30 opacity-55",
                  )}
                >
                  <span className="text-3xl leading-none">{sticker.emoji}</span>
                  <span className="max-w-full truncate text-[9.5px] font-medium text-muted-foreground">
                    {sticker.name}
                  </span>
                  {!isUnlocked ? (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-muted px-1 py-0.5 text-[8px] font-semibold text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" /> {sticker.level}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
