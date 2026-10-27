"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, X, type LucideIcon } from "lucide-react";

import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

interface TrafficLightProps {
  label: string;
  title: string;
  color: string;
  icon: LucideIcon;
  onClick?: () => void;
}

/**
 * Esfera visual de 16 px centrada en un área de clic de 28 px. El hitbox
 * grande hace que el control sea fácil de pulsar sin agrandar el semáforo.
 * Los íconos solo aparecen al pasar el cursor o al enfocar con el teclado.
 */
function TrafficLight({ label, title, color, icon: Icon, onClick }: TrafficLightProps) {
  const sphere = (
    <span
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded-full shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.18)] transition-transform duration-150 group-hover:scale-105 group-active:scale-95",
        color,
      )}
    >
      <Icon
        aria-hidden
        className="h-2.5 w-2.5 text-black/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        strokeWidth={3}
      />
    </span>
  );

  // En el navegador los semáforos son decorativos: misma vista, sin acción.
  if (!onClick) {
    return (
      <span className="group flex h-7 w-7 cursor-default items-center justify-center" aria-hidden>
        {sphere}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 dark:focus-visible:ring-white/40"
    >
      {sphere}
    </button>
  );
}

/**
 * Semáforos de macOS. En Electron controlan la ventana frameless mediante el
 * puente de `desktop/preload.js`; en el navegador son decorativos.
 *
 * Si el usuario desactiva «Modo Marco Transparente» se ocultan por completo:
 * la ventana vuelve a usar la barra de título nativa del sistema.
 */
export function WindowControls() {
  const { useCustomTitlebar } = usePreferences();
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(Boolean(window.autopilotDesktop));
  }, []);

  if (!useCustomTitlebar) return null;

  const lights = [
    {
      key: "close",
      label: "Cerrar ventana",
      title: "Cerrar",
      color: "bg-[#ff5f57]",
      icon: X,
      onClick: () => window.autopilotDesktop?.close(),
    },
    {
      key: "minimize",
      label: "Minimizar ventana",
      title: "Minimizar",
      color: "bg-[#febc2e]",
      icon: Minus,
      onClick: () => window.autopilotDesktop?.minimize(),
    },
    {
      key: "maximize",
      label: "Maximizar o restaurar ventana",
      title: "Maximizar / Restaurar",
      color: "bg-[#28c840]",
      icon: Plus,
      onClick: () => window.autopilotDesktop?.toggleMaximize(),
    },
  ];

  return (
    <span
      className={cn("flex items-center gap-0.5", desktop && "app-no-drag")}
      role={desktop ? "group" : undefined}
      aria-label={desktop ? "Controles de ventana" : undefined}
      aria-hidden={desktop ? undefined : true}
    >
      {lights.map(({ key, ...light }) => (
        <TrafficLight key={key} {...light} onClick={desktop ? light.onClick : undefined} />
      ))}
    </span>
  );
}
