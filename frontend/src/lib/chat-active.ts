// Conversación del chat que el usuario está leyendo en este momento.
//
// Vive en un módulo para que el WebSocket global pueda saber si el mensaje que
// acaba de llegar es el que ya se está viendo y no hace falta interrumpir.
let activeConversationId: string | null = null;

export function setActiveChatConversation(id: string | null): void {
  activeConversationId = id;
}

export function getActiveChatConversation(): string | null {
  return activeConversationId;
}
