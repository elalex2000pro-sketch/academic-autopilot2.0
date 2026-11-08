import type { ReactNode } from "react";

/**
 * App Router remonta este template en cada navegación. La animación de entrada
 * y salida la coordina `PageTransition` con Framer Motion desde `AppShell`.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
