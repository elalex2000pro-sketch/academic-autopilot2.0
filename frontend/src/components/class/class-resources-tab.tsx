import type { ReactNode } from "react";
export function ClassResourcesTab({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="Cuadernos y archivos"
      className="grid min-w-0 gap-4 lg:grid-cols-2"
    >
      {children}
    </section>
  );
}
