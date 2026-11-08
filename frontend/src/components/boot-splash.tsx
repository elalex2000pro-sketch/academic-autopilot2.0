"use client";

import { useEffect, useState } from "react";

import { SkeletonScreen } from "@/components/skeleton-screen";

/**
 * Splash inicial renderizado en el HTML del servidor. Permanece visible hasta
 * que React hidrata y se retira en dos frames, dejando ver la interfaz ya
 * pintada. No bloquea clics y respeta `prefers-reduced-motion`.
 */
export function BootSplash() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let firstFrame = 0;
    let secondFrame = 0;
    let timer = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setLeaving(true);
        timer = window.setTimeout(() => setGone(true), 360);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timer);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      data-boot-splash
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[200] overflow-hidden bg-background transition-opacity duration-300 motion-reduce:transition-none"
      style={{ opacity: leaving ? 0 : 1 }}
    >
      <span className="sr-only">Cargando Academic Autopilot…</span>
      <SkeletonScreen />
    </div>
  );
}
