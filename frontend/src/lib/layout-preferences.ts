// Diseño personalizado de la app: cada sección tiene su propia cuadrícula de
// paneles y su propia clave de localStorage, de modo que mover una tarjeta en
// el inicio no toca el diseño de Documentos o del Planificador.
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

export type LayoutSection =
  | "dashboard"
  | "documents"
  | "planner"
  | "library"
  | "academics";

export const LAYOUT_SECTIONS: LayoutSection[] = [
  "dashboard",
  "documents",
  "planner",
  "library",
  "academics",
];

export const LAYOUT_COLUMNS = 12;
export const LAYOUT_ROW_HEIGHT = 80;
export const LAYOUT_GAP = 16;
export const LAYOUT_MIN_ROW = 1;
export const LAYOUT_MAX_ROW = 40;

/** Diseño de fábrica de cada sección. */
export const DEFAULT_SECTION_PANELS: Record<LayoutSection, Record<string, PanelRect>> = {
  dashboard: {
    hero: { x: 0, y: 0, w: 8, h: 4 },
    calendar: { x: 8, y: 0, w: 4, h: 4 },
    stats: { x: 0, y: 4, w: 12, h: 2 },
    agenda: { x: 0, y: 6, w: 8, h: 7 },
    tasks: { x: 8, y: 6, w: 4, h: 7 },
    quickdock: { x: 0, y: 13, w: 12, h: 2 },
  },
  documents: {
    editor: { x: 0, y: 0, w: 12, h: 10 },
  },
  planner: {
    calendar: { x: 0, y: 0, w: 12, h: 10 },
  },
  library: {
    books: { x: 0, y: 0, w: 12, h: 8 },
  },
  academics: {
    content: { x: 0, y: 0, w: 12, h: 8 },
  },
};

export const DEFAULT_SIDEBAR: SidebarLayout = { side: "left", collapsed: false };

/** Clave de almacenamiento propia por sección. */
export function sectionStorageKey(section: LayoutSection): string {
  return `layout_${section}`;
}

const SIDEBAR_KEY = "layout_sidebar";
const LEGACY_KEY = "autopilot_layout_v1";
const LAYOUT_EVENT = "autopilot:layout";
const EDIT_EVENT = "autopilot:layout-edit";

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

function defaultsFor(section: LayoutSection): Record<string, PanelRect> {
  return Object.fromEntries(
    Object.entries(DEFAULT_SECTION_PANELS[section]).map(([id, rect]) => [id, { ...rect }]),
  );
}

function mergePanels(
  section: LayoutSection,
  stored: unknown,
): Record<string, PanelRect> {
  const base = defaultsFor(section);
  if (!stored || typeof stored !== "object") return base;
  const panels: Record<string, PanelRect> = { ...base };
  for (const [id, rect] of Object.entries(stored as Record<string, unknown>)) {
    const normalized = normalizeRect(rect);
    if (normalized) panels[id] = normalized;
  }
  return panels;
}

function readSectionPanels(section: LayoutSection): Record<string, PanelRect> {
  if (typeof window === "undefined") return defaultsFor(section);
  try {
    const raw = window.localStorage.getItem(sectionStorageKey(section));
    if (raw) return mergePanels(section, JSON.parse(raw));
    // Migración: el diseño antiguo era único y solo afectaba al inicio.
    if (section === "dashboard") {
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as { panels?: unknown } | null;
        return mergePanels(section, parsed?.panels);
      }
    }
    return defaultsFor(section);
  } catch {
    return defaultsFor(section);
  }
}

function readSidebar(): SidebarLayout {
  if (typeof window === "undefined") return { ...DEFAULT_SIDEBAR };
  try {
    const raw = window.localStorage.getItem(SIDEBAR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SidebarLayout> | null;
      return {
        side: parsed?.side === "right" ? "right" : "left",
        collapsed: Boolean(parsed?.collapsed),
      };
    }
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { sidebar?: Partial<SidebarLayout> } | null;
      return {
        side: parsed?.sidebar?.side === "right" ? "right" : "left",
        collapsed: Boolean(parsed?.sidebar?.collapsed),
      };
    }
    return { ...DEFAULT_SIDEBAR };
  } catch {
    return { ...DEFAULT_SIDEBAR };
  }
}

const cache = new Map<LayoutSection, Record<string, PanelRect>>();
let sidebarSnapshot: SidebarLayout | null = null;
let editing = false;

function getPanels(section: LayoutSection): Record<string, PanelRect> {
  let panels = cache.get(section);
  if (!panels) {
    panels = readSectionPanels(section);
    cache.set(section, panels);
  }
  return panels;
}

function getSidebar(): SidebarLayout {
  if (!sidebarSnapshot) sidebarSnapshot = readSidebar();
  return sidebarSnapshot;
}

function emitLayout(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LAYOUT_EVENT));
}

function persistPanels(section: LayoutSection, panels: Record<string, PanelRect>): void {
  cache.set(section, panels);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(sectionStorageKey(section), JSON.stringify(panels));
    } catch {
      // Sin almacenamiento el diseño no sobrevive, pero la sesión sigue igual.
    }
  }
  emitLayout();
}

function persistSidebar(sidebar: SidebarLayout): void {
  sidebarSnapshot = sidebar;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, JSON.stringify(sidebar));
    } catch {
      // Igual que arriba: solo se pierde la persistencia.
    }
  }
  emitLayout();
}

export function getLayout(section: LayoutSection = "dashboard"): Record<string, PanelRect> {
  return getPanels(section);
}

export function setPanelRect(section: LayoutSection, id: string, rect: PanelRect): void {
  const normalized = normalizeRect(rect);
  if (!normalized) return;
  persistPanels(section, { ...getPanels(section), [id]: normalized });
}

export function setSidebarLayout(patch: Partial<SidebarLayout>): void {
  const current = getSidebar();
  persistSidebar({
    side: patch.side === "right" ? "right" : patch.side === "left" ? "left" : current.side,
    collapsed: typeof patch.collapsed === "boolean" ? patch.collapsed : current.collapsed,
  });
}

/** Restablece una sección concreta a su diseño de fábrica. */
export function resetLayout(section: LayoutSection): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(sectionStorageKey(section));
    } catch {
      // Sin almacenamiento no hay nada que borrar.
    }
  }
  cache.delete(section);
  emitLayout();
}

/** Restablece todas las secciones y la barra lateral. */
export function resetAllLayouts(): void {
  for (const section of LAYOUT_SECTIONS) resetLayout(section);
  persistSidebar({ ...DEFAULT_SIDEBAR });
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
    if (!event.key) return;
    if (event.key.startsWith("layout_") || event.key === LEGACY_KEY) {
      cache.clear();
      sidebarSnapshot = null;
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

export function useLayoutPreferences(section: LayoutSection) {
  const panels = useSyncExternalStore(
    subscribe,
    () => getPanels(section),
    () => getPanels(section),
  );

  const updatePanel = useCallback(
    (id: string, rect: PanelRect) => setPanelRect(section, id, rect),
    [section],
  );
  const reset = useCallback(() => resetLayout(section), [section]);

  return { panels, updatePanel, reset };
}

export function useSidebarPreferences() {
  const sidebar = useSyncExternalStore(subscribe, getSidebar, getSidebar);

  const updateSidebar = useCallback(
    (patch: Partial<SidebarLayout>) => setSidebarLayout(patch),
    [],
  );

  return { sidebar, updateSidebar };
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
