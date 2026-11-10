"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Check, GripVertical, Maximize2, RotateCcw } from "lucide-react";

import {
  DEFAULT_SECTION_PANELS,
  LAYOUT_COLUMNS,
  LAYOUT_GAP,
  LAYOUT_MAX_ROW,
  LAYOUT_ROW_HEIGHT,
  getLayout,
  resetLayout,
  resolveCollisions,
  setLayoutEditing,
  useLayoutEditing,
  useLayoutPreferences,
  type LayoutSection,
  type PanelRect,
} from "@/lib/layout-preferences";
import { cn } from "@/lib/utils";

export interface EditablePanelDefinition {
  id: string;
  label: string;
  node: ReactNode;
  minW?: number;
  minH?: number;
}

interface DragState {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  rect: PanelRect;
  strideX: number;
  strideY: number;
  minW: number;
  minH: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cellStyle(rect: PanelRect): CSSProperties {
  return {
    "--panel-x": rect.x,
    "--panel-y": rect.y,
    "--panel-w": rect.w,
    "--panel-h": rect.h,
  } as CSSProperties;
}

export function EditablePanels({
  panels,
  className,
  section,
  label,
}: {
  panels: EditablePanelDefinition[];
  className?: string;
  /** Sección dueña del diseño: cada una guarda su propia cuadrícula. */
  section: LayoutSection;
  label?: string;
}) {
  const { panels: layoutPanels, updatePanel } = useLayoutPreferences(section);
  const editing = useLayoutEditing();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [live, setLive] = useState<Record<string, PanelRect>>({});

  function rectFor(id: string): PanelRect {
    return (
      live[id] ??
      layoutPanels[id] ??
      DEFAULT_SECTION_PANELS[section][id] ?? { x: 0, y: 0, w: LAYOUT_COLUMNS, h: 3 }
    );
  }

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    panel: EditablePanelDefinition,
    mode: "move" | "resize",
  ) {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const columnWidth = (width - LAYOUT_GAP * (LAYOUT_COLUMNS - 1)) / LAYOUT_COLUMNS;
    if (!Number.isFinite(columnWidth) || columnWidth <= 0) return;

    const rect = rectFor(panel.id);
    dragRef.current = {
      id: panel.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      strideX: columnWidth + LAYOUT_GAP,
      strideY: LAYOUT_ROW_HEIGHT + LAYOUT_GAP,
      minW: panel.minW ?? 2,
      minH: panel.minH ?? 1,
    };
    setLive((current) => ({ ...current, [panel.id]: rect }));
    // El cursor se mantiene coherente aunque el puntero pase por encima de
    // otros paneles durante el arrastre.
    document.body.style.cursor = mode === "move" ? "grabbing" : "nwse-resize";
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    if (!editing) {
      dragRef.current = null;
      setLive({});
      return;
    }

    function handleMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (drag.mode === "move") {
        const x = clamp(
          drag.rect.x + Math.round(deltaX / drag.strideX),
          0,
          LAYOUT_COLUMNS - drag.rect.w,
        );
        const y = clamp(
          drag.rect.y + Math.round(deltaY / drag.strideY),
          0,
          LAYOUT_MAX_ROW - drag.rect.h,
        );
        // La vista previa ya muestra el hueco definitivo: al soltar no hay
        // saltos, la tarjeta encaja donde se está viendo.
        setLive((current) => ({
          ...current,
          [drag.id]: resolveCollisions(drag.id, { ...drag.rect, x, y }, getLayout(section)),
        }));
        return;
      }
      const w = clamp(
        drag.rect.w + Math.round(deltaX / drag.strideX),
        drag.minW,
        LAYOUT_COLUMNS - drag.rect.x,
      );
      const h = clamp(
        drag.rect.h + Math.round(deltaY / drag.strideY),
        drag.minH,
        LAYOUT_MAX_ROW - drag.rect.y,
      );
      setLive((current) => ({ ...current, [drag.id]: { ...drag.rect, w, h } }));
    }

    function handleUp() {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setLive((current) => {
        const rect = current[drag.id];
        if (rect) {
          updatePanel(drag.id, resolveCollisions(drag.id, rect, getLayout(section)));
        }
        const next = { ...current };
        delete next[drag.id];
        return next;
      });
    }

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [editing, section, updatePanel]);

  return (
    <div className={cn("space-y-4", className)}>
      {editing ? (
        <div
          role="status"
          className="sticky top-16 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[#0a84ff]/45 bg-[#0a84ff]/[0.08] px-3.5 py-2.5 backdrop-blur-xl md:top-3"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0a84ff]/15 text-[#0066FF] dark:text-[#64a8ff]">
            <GripVertical className="h-4 w-4" strokeWidth={2} />
          </span>
          <p className="min-w-0 flex-1 text-[11.5px] leading-4 text-slate-600 dark:text-white/60">
            <span className="font-semibold text-slate-800 dark:text-white/85">Modo edición.</span>{" "}
            Arrastra una tarjeta por su asa para moverla y usa la esquina inferior derecha para
            cambiar su tamaño. Todo encaja en una cuadrícula de 12 columnas.
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => resetLayout(section)}
              className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-900/[0.06] hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer
            </button>
            <button
              type="button"
              onClick={() => setLayoutEditing(false)}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-[#0a84ff] px-3 text-[11px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(10,132,255,0.9)] transition-[filter] hover:brightness-105"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
              Hecho
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={cn("panel-grid", editing && "panel-grid-editing")}
        aria-label={label ?? "Paneles de la sección"}
      >
        {panels.map((panel) => {
          const rect = rectFor(panel.id);
          return (
            <section
              key={panel.id}
              style={cellStyle(rect)}
              aria-label={editing ? `${panel.label} (editable)` : panel.label}
              className={cn("panel-cell", editing && "panel-cell-editing")}
            >
              {editing ? (
                <>
                  <button
                    type="button"
                    onPointerDown={(event) => startDrag(event, panel, "move")}
                    className="panel-grip"
                    aria-label={`Mover ${panel.label}`}
                    title="Arrastrar"
                  >
                    <GripVertical className="h-3.5 w-3.5" strokeWidth={2.4} />
                    <span>{panel.label}</span>
                    <span className="tabular-nums text-[9.5px] opacity-60">
                      {rect.x},{rect.y} · {rect.w}×{rect.h}
                    </span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={(event) => startDrag(event, panel, "resize")}
                    className="panel-resize"
                    aria-label={`Redimensionar ${panel.label}`}
                    title="Redimensionar"
                  >
                    <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                </>
              ) : null}
              <div className="panel-surface">{panel.node}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
