"use client";

import { initials } from "@/lib/chat-format";
import { Check, CheckCheck, Loader2, Users } from "lucide-react";
import { parseStickerMessage } from "@/lib/gamification";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

/** Texto con enlaces clickeables (y vista previa si el enlace es una imagen). */
export function MessageText({ text }: { text: string }) {
  const sticker = parseStickerMessage(text);
  if (sticker) {
    return (
      <span className="flex min-w-[88px] flex-col items-center gap-1 py-1">
        <span className="text-[42px] leading-none drop-shadow-sm">
          {sticker.emoji}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-65">
          {sticker.name}
        </span>
      </span>
    );
  }
  const parts = text.split(URL_PATTERN);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const image = /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(part);
          return (
            <span key={`${part}-${index}`} className="block">
              <a
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2 hover:opacity-80"
              >
                {part}
              </a>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={part}
                  alt="Vista previa del enlace"
                  className="mt-2 max-h-64 w-auto rounded-lg border border-black/10 object-contain"
                  loading="lazy"
                />
              ) : null}
            </span>
          );
        }
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Ticks de WhatsApp en la esquina de la burbuja: un tick gris al enviar, dos
 * grises al entregar y dos azules al leer. El azul es claro para que se vea
 * sobre la burbuja azul del emisor.
 */
export function MessageTicks({
  mine,
  status,
  pending,
}: {
  mine: boolean;
  status?: ChatMessage["status"];
  pending?: boolean;
}) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Enviando
      </span>
    );
  }
  if (!mine) return null;
  const value = status ?? "sent";
  if (value === "sent") {
    return (
      <Check
        className="h-3.5 w-3.5 text-[#75877d] dark:text-[#adbbb2]"
        aria-label="Enviado"
      />
    );
  }
  const read = value === "read";
  return (
    <CheckCheck
      className={cn(
        "h-3.5 w-3.5",
        read
          ? "text-[#168ac2] dark:text-[#6bcfee]"
          : "text-[#75877d] dark:text-[#adbbb2]",
      )}
      aria-label={read ? "Leído" : "Entregado"}
    />
  );
}

export function Avatar({
  name,
  group = false,
  online = false,
}: {
  name: string;
  group?: boolean;
  online?: boolean;
}) {
  return (
    <span className="chat-avatar" aria-hidden="true">
      {group ? <Users className="h-5 w-5" /> : initials(name)}
      {online ? <span className="chat-online-dot" /> : null}
    </span>
  );
}
