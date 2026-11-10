// Avisos nativos del sistema operativo.
//
// Este modulo NO calcula que hay que avisar: eso lo hace `lib/notifications.ts`
// (el mismo listado que alimenta el centro de avisos). Aqui solo se decide como
// se muestra el aviso y se evita repetirlo:
//   - Navegador / PWA -> API HTML5 `new Notification()`.
//   - Escritorio       -> puente IPC `autopilotDesktop.notify`, que usa el
//                         proceso principal de Electron para lanzar la
//                         notificacion nativa aunque la ventana este oculta.

export interface SystemNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

interface DesktopNotificationsBridge {
  notify?: (
    payload: SystemNotificationPayload,
  ) => Promise<{ ok: boolean }> | { ok: boolean };
}

const SENT_KEY = "autopilot_notified_v1";

function desktopBridge(): DesktopNotificationsBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { autopilotDesktop?: DesktopNotificationsBridge })
    .autopilotDesktop;
  return bridge && typeof bridge.notify === "function" ? bridge : null;
}

export function supportsSystemNotifications(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(desktopBridge()) || "Notification" in window;
}

/** En Electron el permiso lo controla la app; en web lo decide el navegador. */
export function systemNotificationPermission(): NotificationPermission | "unsupported" {
  if (desktopBridge()) return "granted";
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function canNotifySystem(): boolean {
  return systemNotificationPermission() === "granted";
}

/**
 * Pide permiso solo si aun no se ha decidido. Nunca insiste si el usuario ya lo
 * rechazo: en ese caso devuelve `false` y la app sigue funcionando sin avisos.
 */
export async function ensureSystemNotificationPermission(): Promise<boolean> {
  if (desktopBridge()) return true;
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export async function showSystemNotification(
  payload: SystemNotificationPayload,
): Promise<boolean> {
  const bridge = desktopBridge();
  if (bridge?.notify) {
    try {
      const result = await bridge.notify(payload);
      // Si Electron no puede mostrar avisos, se intenta la API del navegador
      // en lugar de dar el aviso por enviado.
      if (!result || result.ok !== false) return true;
    } catch {
      // Se intenta la ruta web antes de rendirse.
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      silent: false,
    });
    notification.onclick = () => {
      window.focus();
      if (payload.url) window.location.assign(payload.url);
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

// --- Control de avisos ya mostrados hoy ------------------------------------

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readSent(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function wasNotified(key: string): boolean {
  return readSent()[key] === todayKey();
}

export function markNotified(key: string): void {
  if (typeof window === "undefined") return;
  const today = todayKey();
  const pruned: Record<string, string> = {};
  for (const [name, date] of Object.entries(readSent())) {
    if (date === today) pruned[name] = date;
  }
  pruned[key] = today;
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify(pruned));
  } catch {
    // Sin localStorage se pierde el control de duplicados, no el aviso.
  }
}

/** Muestra el aviso una sola vez al dia por clave. */
export async function notifyOnce(
  key: string,
  payload: SystemNotificationPayload,
): Promise<boolean> {
  if (wasNotified(key)) return false;
  const shown = await showSystemNotification(payload);
  if (shown) markNotified(key);
  return shown;
}
