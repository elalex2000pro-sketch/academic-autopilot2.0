"use client";

import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageAnimatedWrapper } from "@/components/page-animated-wrapper";

export { pageItem, pageStagger } from "@/components/page-animated-wrapper";

/**
 * Transición compartida por todas las vistas del App Router.
 *
 * En una SPA clásica esto viviría junto al router; aquí `usePathname()` es la
 * fuente de verdad y `AppShell` envuelve el árbol de páginas. La clave cambia
 * con cada ruta para que AnimatePresence espere la salida antes de montar la
 * siguiente vista, que entra con sus bloques en cascada.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <PageAnimatedWrapper
        key={pathname}
        className="min-w-0"
        dataPageTransition={pathname}
      >
        {children}
      </PageAnimatedWrapper>
    </AnimatePresence>
  );
}
