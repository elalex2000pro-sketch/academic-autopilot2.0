/** Eventos de la sección Documentos. */
export const NEW_NOTEBOOK_EVENT = "autopilot:new-notebook";
export const NEW_CANVAS_EVENT = "autopilot:new-canvas";

export function requestNewNotebook(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NEW_NOTEBOOK_EVENT));
}

export function requestNewCanvas(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NEW_CANVAS_EVENT));
}
