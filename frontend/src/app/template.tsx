import type { ReactNode } from "react";

/**
 * App Router remonta este template en cada navegación. La animación de entrada
 * la coordina `PageTransition` con Framer Motion desde `AppShell`; la vista
 * anterior se desmonta de inmediato para no bloquear la ruta nueva.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
