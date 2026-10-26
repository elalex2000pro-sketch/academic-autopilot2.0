/**
 * Sincronizacion de notas entre el planificador y la vista academica.
 *
 * El backend ya emite el evento realtime "grades", pero la app tambien debe
 * reaccionar cuando no hay WebSocket (modo local, mock o pestanas abiertas a
 * la vez). El evento de ventana cubre la pestana actual y la clave de
 * localStorage avisa a las demas pestanas.
 */
export const GRADE_CHANGE_EVENT = "autopilot-grades-changed";
export const GRADE_CHANGE_STORAGE_KEY = "autopilot-grades-updated-at";

export function notifyGradeChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GRADE_CHANGE_EVENT));
  try {
    window.localStorage.setItem(GRADE_CHANGE_STORAGE_KEY, new Date().toISOString());
  } catch {
    // El evento de ventana ya ha avisado a la pestana actual.
  }
}
