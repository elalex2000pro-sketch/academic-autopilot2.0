import { parseStickerMessage } from "@/lib/gamification";
import type { ChatConversation, ChatMessage, ChatUser } from "@/lib/types";

export function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Algo salio mal";
}

export function nameOf(user: {
  display_name: string;
  username: string | null;
}): string {
  return user.username ? `@${user.username}` : user.display_name;
}

export function conversationTitle(
  conversation: ChatConversation,
  meId: string,
): string {
  if (conversation.kind === "group") return conversation.title || "Grupo";
  const other = conversation.members.find((member) => member.user.id !== meId);
  return other ? other.user.display_name : "Chat privado";
}

export function conversationSubtitle(
  conversation: ChatConversation,
  meId: string,
): string {
  if (conversation.kind === "group") {
    return `${conversation.members.length} miembros`;
  }
  const other = conversation.members.find((member) => member.user.id !== meId);
  return other?.user.username ? `@${other.user.username}` : "Privado";
}

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function messagePreview(message: ChatMessage): string {
  const sticker = parseStickerMessage(message.content);
  return sticker ? `${sticker.emoji} ${sticker.name}` : message.content;
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "long" });
}

export function isImage(contentType: string, name: string): boolean {
  return (
    contentType.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name)
  );
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function presenceLabel(peer: ChatUser | undefined): string {
  if (peer?.online) return "En línea";
  if (!peer?.last_seen_at) return "Sin conexión";
  const date = new Date(peer.last_seen_at);
  return `Última vez ${formatDay(peer.last_seen_at).toLowerCase()} a las ${formatClock(date.toISOString())}`;
}
