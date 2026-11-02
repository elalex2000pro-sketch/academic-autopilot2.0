import type { ReactNode } from "react";

/**
 * App Router remonta este template en cada navegación, así que la animación
 * de entrada se reproduce sin envolver las páginas en un componente cliente
 * con estado. La curva y la duración las decide `globals.css` según el nivel
 * de animaciones (estándar, Ultra o reducido).
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter min-w-0">{children}</div>;
}
