"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minus, X } from "lucide-react";

/**
 * Semáforos de macOS. En Electron controlan la ventana frameless mediante el
 * puente de `desktop/preload.js`; en el navegador son decorativos.
 */
export function WindowControls() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(Boolean(window.autopilotDesktop));
  }, []);

  if (!desktop) {
    return (
      <span className="flex items-center gap-2" aria-hidden>
        <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.18)]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.16)]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.16)]" />
      </span>
    );
  }

  return (
    <span className="app-no-drag flex items-center gap-2">
      <button
        type="button"
        aria-label="Cerrar ventana"
        title="Cerrar"
        onClick={() => window.autopilotDesktop?.close()}
        className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <X className="h-2 w-2 text-black/60 opacity-0 group-hover:opacity-100" strokeWidth={3} />
      </button>
      <button
        type="button"
        aria-label="Minimizar ventana"
        title="Minimizar"
        onClick={() => window.autopilotDesktop?.minimize()}
        className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Minus className="h-2 w-2 text-black/60 opacity-0 group-hover:opacity-100" strokeWidth={3} />
      </button>
      <button
        type="button"
        aria-label="Maximizar ventana"
        title="Maximizar"
        onClick={() => window.autopilotDesktop?.toggleMaximize()}
        className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Maximize2
          className="h-2 w-2 text-black/60 opacity-0 group-hover:opacity-100"
          strokeWidth={3}
        />
      </button>
    </span>
  );
}
