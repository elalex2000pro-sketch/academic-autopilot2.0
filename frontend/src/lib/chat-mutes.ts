// Silenciado de conversaciones del chat. Se guarda en localStorage para que
// sobreviva a recargas y se comparta entre pestañas del mismo dispositivo.
const MUTED_KEY = "autopilot_muted_chats_v1";

export const CHAT_MUTES_EVENT = "autopilot:chat-mutes";

function normalize(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      ),
    ),
  );
}

export function getMutedChats(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MUTED_KEY);
    return raw ? normalize(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function isChatMuted(conversationId: string): boolean {
  return getMutedChats().includes(conversationId);
}

export function setChatMuted(conversationId: string, muted: boolean): string[] {
  if (typeof window === "undefined") return [];
  const current = new Set(getMutedChats());
  if (muted) current.add(conversationId);
  else current.delete(conversationId);
  const next = Array.from(current);
  try {
    window.localStorage.setItem(MUTED_KEY, JSON.stringify(next));
  } catch {
    // Sin localStorage el silencio no sobrevive, pero la UI sigue funcionando.
  }
  window.dispatchEvent(new Event(CHAT_MUTES_EVENT));
  return next;
}

/** Escucha cambios propios y de otras pestañas. */
export function subscribeChatMutes(
  listener: (mutedChats: string[]) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const emit = () => listener(getMutedChats());
  const onStorage = (event: StorageEvent) => {
    if (event.key === MUTED_KEY) emit();
  };
  window.addEventListener(CHAT_MUTES_EVENT, emit);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHAT_MUTES_EVENT, emit);
    window.removeEventListener("storage", onStorage);
  };
}
