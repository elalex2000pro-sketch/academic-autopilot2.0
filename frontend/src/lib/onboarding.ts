/**
 * Persistencia del tour de bienvenida.
 *
 * La marca vive en `localStorage` y no incluye la versión de la app: así el
 * tour solo aparece la primera vez que se abre Autopilot en este dispositivo.
 * Reiniciar, navegar entre vistas o actualizar la aplicación no la borra.
 */
export const ONBOARDING_STORAGE_KEY = "hasCompletedOnboarding_v1";

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // En algunos contextos (modo privado estricto, iframes bloqueados) el
    // acceso a localStorage lanza. Sin almacenamiento no podemos garantizar
    // que el tour no vuelva a aparecer, así que lo tratamos como completado.
    return null;
  }
}

export function hasCompletedOnboarding(): boolean {
  const storage = readStorage();
  if (!storage) return true;
  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function markOnboardingCompleted(): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // Si el almacenamiento está lleno o bloqueado, la app sigue funcionando;
    // el tour se ocultará durante esta sesión.
  }
}

/** Solo para pruebas o para un botón explícito de "volver a ver el tour". */
export function resetOnboarding(): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
}
