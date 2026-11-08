"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { usePreferences } from "@/components/preferences-provider";
import { PRIMARY_NAV_ITEMS, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

// El indicador con Framer Motion se descarga después del primer paint. Hasta
// entonces la barra muestra un círculo estático con las mismas medidas.
const MobileNavIndicator = dynamic(
  () =>
    import("@/components/mobile-nav-indicator").then((module) => ({
      default: module.MobileNavIndicator,
    })),
  { ssr: false },
);

const STATIC_INDICATOR =
  "gpu-layer absolute inset-0 rounded-full bg-[#e9e4f6] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.7)]";

/**
 * Barra de navegación inferior móvil.
 *
 * Es una píldora flotante (16 px de margen, 68 px de alto) separada del borde
 * inferior por la safe area del dispositivo. El fondo activo es un círculo
 * único de 44 px con `layoutId`, de modo que Framer Motion lo desliza entre
 * los iconos en lugar de encender y apagar fondos independientes.
 */
export function MobileNavigationBar() {
  const pathname = usePathname() ?? "/";
  const { animationLevel } = usePreferences();
  const [animationsReady, setAnimationsReady] = useState(false);

  useEffect(() => {
    setAnimationsReady(true);
  }, []);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed left-4 right-4 z-40 mx-auto max-w-md md:hidden"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        data-mobile-nav
        className="gpu-layer flex items-center gap-0.5 rounded-[30px] border border-white/10 bg-[#1b1b1f]/95 p-1.5 shadow-[0_22px_55px_-24px_rgba(12,12,16,0.8),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-2xl"
      >
        {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="group relative flex h-14 min-w-11 flex-1 touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-[22px] px-0.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-white/55"
            >
              <span className="relative flex h-11 w-11 items-center justify-center">
                {active ? (
                  animationsReady ? (
                    <MobileNavIndicator forceReduced={animationLevel === "reduced"} />
                  ) : (
                    <span aria-hidden="true" className={STATIC_INDICATOR} />
                  )
                ) : null}
                <Icon
                  className={cn(
                    "relative z-10 h-[21px] w-[21px] transition-colors duration-150",
                    active
                      ? "text-[#1d1d1f]"
                      : "text-white/50 group-hover:text-white/90",
                  )}
                  strokeWidth={active ? 2.1 : 1.8}
                />
              </span>
              <span
                className={cn(
                  "relative z-10 w-full truncate text-center text-[9.5px] leading-none min-[360px]:text-[10px]",
                  active
                    ? "font-semibold text-white"
                    : "font-medium text-white/45",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
