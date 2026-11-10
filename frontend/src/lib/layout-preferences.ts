// Diseño personalizado de la app: posición y tamaño de los paneles del inicio
// y colocación de la barra lateral. Se guarda en localStorage y se comparte
// entre pestañas.
import { useCallback, useSyncExternalStore } from "react";

export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SidebarSide = "left" | "right";

export interface SidebarLayout {
  side: SidebarSide;
  collapsed: boolean;
}

export interface LayoutPreferences {
  panels: Record<string, PanelRect>;
  sidebar: SidebarLayout;
}

export const LAYOUT_COLUMNS = 12;
export const LAYOUT_ROW_HEIGHT = 80;
export const LAYOUT_GAP = 16;
export const LAYOUT_MIN_ROW = 1;
export const LAYOUT_MAX_ROW = 40;

/** Diseño de fábrica. Restablecer vuelve siempre a este objeto. */
export const DEFAULT_LAYOUT: LayoutPreferences = {
  panels: {
    hero: { x: 0, y: 0, w: 8, h: 4 },
    calendar: { x: 8, y: 0, w: 4, h: 4 },
    stats: { x: 0, y: 4, w: 12, h: 2 },
    agenda: { x: 0, y: 6, w: 8, h: 7 },
    tasks: { x: 8, y: 6, w: 4, h: 7 },
    quickdock: { x: 0, y: 13, w: 12, h: 2 },
  },
  sidebar: { side: "left", collapsed: false },
};

const STORAGE_KEY = "autopilot_layout_v1";
const LAYOUT_EVENT = "autopilot:layout";
const EDIT_EVENT = "autopilot:layout-edit";

function cloneDefault(): LayoutPreferences {
  return {
    panels: Object.fromEntries(
      Object.entries(DEFAULT_LAYOUT.panels).map(([id, rect]) => [id, { ...rect }]),
    ),
    sidebar: { ...DEFAULT_LAYOUT.sidebar },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRect(value: unknown): PanelRect | null {
  if (!value || typeof value !== "object") return null;
  const rect = value as Partial<PanelRect>;
  const numbers = [rect.x, rect.y, rect.w, rect.h];
  if (numbers.some((item) => typeof item !== "number" || !Number.isFinite(item))) return null;
  const w = clamp(Math.round(rect.w as number), 1, LAYOUT_COLUMNS);
  const h = clamp(Math.round(rect.h as number), LAYOUT_MIN_ROW, LAYOUT_MAX_ROW);
  return {
    x: clamp(Math.round(rect.x as number), 0, LAYOUT_COLUMNS - w),
    y: clamp(Math.round(rect.y as number), 0, LAYOUT_MAX_ROW - h),
    w,
    h,
  };
}

function read(): LayoutPreferences {
  const fallback = cloneDefault();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LayoutPreferences> | null;
    if (!parsed || typeof parsed !== "object") return fallback;

    const panels: Record<string, PanelRect> = {};
    for (const [id, rect] of Object.entries(fallback.panels)) {
      const stored = normalizeRect(parsed.panels?.[id]);
      panels[id] = stored ?? rect;
    }

    const side = parsed.sidebar?.side === "right" ? "right" : "left";
    return {
      panels,
      sidebar: { side, collapsed: Boolean(parsed.sidebar?.collapsed) },
    };
  } catch {
    return fallback;
  }
}

let snapshot: LayoutPreferences = read();
let editing = false;

function emitLayout(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LAYOUT_EVENT));
}

function persist(next: LayoutPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento el diseño no sobrevive, pero la sesión sigue igual.
  }
  snapshot = next;
  emitLayout();
}

export function getLayout(): LayoutPreferences {
  return snapshot;
}

export function setPanelRect(id: string, rect: PanelRect): void {
  const normalized = normalizeRect(rect);
  if (!normalized) return;
  persist({
    ...snapshot,
    panels: { ...snapshot.panels, [id]: normalized },
  });
}

export function setSidebarLayout(patch: Partial<SidebarLayout>): void {
  persist({
    ...snapshot,
    sidebar: {
      side: patch.side === "right" ? "right" : patch.side === "left" ? "left" : snapshot.sidebar.side,
      collapsed:
        typeof patch.collapsed === "boolean" ? patch.collapsed : snapshot.sidebar.collapsed,
    },
  });
}

export function resetLayout(): void {
  persist(cloneDefault());
}

export function isLayoutEditing(): boolean {
  return editing;
}

export function setLayoutEditing(value: boolean): void {
  if (editing === value) return;
  editing = value;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EDIT_EVENT));
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      snapshot = read();
      listener();
    }
  };
  window.addEventListener(LAYOUT_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LAYOUT_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeEditing(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EDIT_EVENT, listener);
  return () => window.removeEventListener(EDIT_EVENT, listener);
}

export function useLayoutPreferences() {
  const layout = useSyncExternalStore(subscribe, getLayout, getLayout);

  const updatePanel = useCallback((id: string, rect: PanelRect) => setPanelRect(id, rect), []);
  const updateSidebar = useCallback(
    (patch: Partial<SidebarLayout>) => setSidebarLayout(patch),
    [],
  );
  const reset = useCallback(() => resetLayout(), []);

  return { layout, updatePanel, updateSidebar, reset };
}

export function useLayoutEditing(): boolean {
  return useSyncExternalStore(subscribeEditing, isLayoutEditing, () => false);
}

export function rectsOverlap(a: PanelRect, b: PanelRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Evita solapamientos al soltar: si el panel choca con otro, baja filas hasta
 * encontrar un hueco libre. El diseño nunca queda con tarjetas encimadas.
 */
export function resolveCollisions(
  id: string,
  rect: PanelRect,
  panels: Record<string, PanelRect>,
): PanelRect {
  const others = Object.entries(panels)
    .filter(([otherId]) => otherId !== id)
    .map(([, other]) => other);
  let candidate = { ...rect };
  for (let guard = 0; guard < LAYOUT_MAX_ROW && others.some((other) => rectsOverlap(candidate, other)); guard += 1) {
    candidate = {
      ...candidate,
      y: Math.min(LAYOUT_MAX_ROW - candidate.h, candidate.y + 1),
    };
  }
  return candidate;
}
