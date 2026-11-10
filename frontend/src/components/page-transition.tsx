"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { PageAnimatedWrapper } from "@/components/page-animated-wrapper";
import { ViewLoading } from "@/components/view-loading";

export { pageItem, pageStagger } from "@/components/page-animated-wrapper";

/**
 * Transición compartida por todas las vistas del App Router.
 *
 * La ruta nueva se monta inmediatamente: `key={pathname}` desmonta la anterior
 * y dispara la animación de entrada. No se usa `AnimatePresence mode="wait"`
 * aquí porque en el App Router la página anterior puede quedarse esperando su
 * salida mientras el siguiente segmento suspende o carga su chunk; el resultado
 * es el área de contenido en blanco o la navegación bloqueada.
 *
 * Las animaciones de salida siguen disponibles dentro de cada vista para los
 * elementos que sí viven en su propio `AnimatePresence` (modales, avisos, etc.).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  // En App Router no existen `<Routes>` ni `useLocation`: `usePathname` es la
  // location y la key del wrapper fuerza el remontaje de la vista nueva.
  const location = usePathname() ?? "/";

  return (
    <Suspense fallback={<ViewLoading label="Cargando…" />}>
      <PageAnimatedWrapper
        key={location}
        className="min-w-0"
        dataPageTransition={location}
      >
        {children}
      </PageAnimatedWrapper>
    </Suspense>
  );
}
