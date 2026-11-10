// Avisos de mensajes nuevos del chat. La decisión vive aquí para que el
// WebSocket global pueda avisar aunque el usuario esté en otra sección.
import type { RealtimeEvent } from "@/components/realtime-provider";
import { getActiveChatConversation } from "@/lib/chat-active";
import { isChatMuted } from "@/lib/chat-mutes";
import { parseStickerMessage } from "@/lib/gamification";
import type { ChatMessage } from "@/lib/types";
import {
  ensureSystemNotificationPermission,
  showSystemNotification,
  systemNotificationPermission,
} from "@/lib/system-notifications";

export interface ChatRealtimePayload {
  conversation_id?: string;
  conversation_kind?: "direct" | "group" | string;
  conversation_title?: string | null;
  action?: string;
  message?: ChatMessage;
}

// Evita duplicados: el WebSocket global y la vista de chat pueden recibir el
// mismo mensaje y ambos piden el aviso.
const notifiedMessages = new Set<string>();

function bodyFor(message: ChatMessage): string {
  const sticker = parseStickerMessage(message.content);
  const text = sticker
    ? `${sticker.emoji} ${sticker.name}`
    : message.content.trim();
  if (text) return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  if (message.attachment) return `Adjunto: ${message.attachment.name}`;
  return "Nuevo mensaje";
}

function titleFor(data: ChatRealtimePayload, message: ChatMessage): string {
  if (data.conversation_kind === "group") {
    return data.conversation_title?.trim() || "Grupo";
  }
  return message.sender_name || "Nuevo mensaje";
}

/**
 * Lanza una notificación nativa solo para mensajes ajenos, con la ventana sin
 * foco y la conversación no silenciada. Devuelve true si se mostró.
 */
export async function notifyChatMessage(
  event: RealtimeEvent,
  meId: string,
): Promise<boolean> {
  if (!meId || event.event !== "chat") return false;
  const data = event.data as ChatRealtimePayload | undefined;
  const message = data?.message;
  if (
    !data?.conversation_id ||
    data.action !== "message" ||
    !message ||
    String(message.sender_id) === String(meId)
  ) {
    return false;
  }

  const dedupeKey = message.id
    ? `${data.conversation_id}:${message.id}`
    : "";
  if (dedupeKey && notifiedMessages.has(dedupeKey)) return false;
  if (dedupeKey) notifiedMessages.add(dedupeKey);

  // Solo se calla si la ventana tiene el foco Y la conversación abierta es
  // justo esta: en cualquier otra sección el aviso sí debe saltar.
  const focused =
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus();
  if (focused && getActiveChatConversation() === data.conversation_id) {
    return false;
  }

  // Este es el último filtro antes de tocar el sistema operativo.
  if (isChatMuted(data.conversation_id)) return false;

  // En el navegador el permiso nace en "default": se pide aquí para que el
  // primer mensaje no se pierda en silencio. En escritorio el permiso lo
  // gestiona Electron y esta llamada devuelve true sin preguntar.
  if (systemNotificationPermission() === "default") {
    const granted = await ensureSystemNotificationPermission();
    if (!granted) return false;
  }

  try {
    return await showSystemNotification({
    title: titleFor(data, message),
    body: bodyFor(message),
      tag: `chat-${data.conversation_id}`,
      url: "/chat",
    });
  } catch (error) {
    console.warn("No se pudo mostrar el aviso del chat", error);
    return false;
  }
}
