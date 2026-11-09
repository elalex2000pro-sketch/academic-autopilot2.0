/** Eventos de la sección Documentos. */
export const NEW_NOTEBOOK_EVENT = "autopilot:new-notebook";

export function requestNewNotebook(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NEW_NOTEBOOK_EVENT));
}
