"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const CursorGlow = lazy(() =>
  import("@/components/cursor-glow").then((module) => ({
    default: module.CursorGlow,
  })),
);
const UpdateModal = lazy(() =>
  import("@/components/update-modal").then((module) => ({
    default: module.UpdateModal,
  })),
);

/**
 * Elementos globales que no hacen falta para el primer pintado: el brillo del
 * cursor y el comprobador de actualizaciones. Se cargan en tiempo de espera
 * para que el arranque del dashboard no pague su JavaScript.
 */
export function AppChrome() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const activate = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(activate, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const id = window.setTimeout(activate, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <CursorGlow />
      <UpdateModal />
    </Suspense>
  );
}
