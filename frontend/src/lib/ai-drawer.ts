/** Evento global para abrir el drawer de IA desde cualquier pantalla. */
export const AI_DRAWER_EVENT = "autopilot:open-ai";

export function openAiDrawer(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AI_DRAWER_EVENT));
}
