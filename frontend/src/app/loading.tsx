import { ViewLoading } from "@/components/view-loading";

/**
 * Fallback de navegación del App Router. Next lo muestra mientras carga el
 * segmento de ruta; las vistas con `React.lazy()` conservan además su propio
 * Suspense con la misma silueta.
 */
export default function Loading() {
  return <ViewLoading label="Cargando…" />;
}
