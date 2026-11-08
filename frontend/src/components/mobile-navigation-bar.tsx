"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";

import { usePreferences } from "@/components/preferences-provider";
import { PRIMARY_NAV_ITEMS, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

// Física del indicador: stiffness 300 / damping 30 deja el muelle en régimen
// casi crítico, así que la burbuja se traslada sin rebote perceptible.
const INDICATOR_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 30,
} as const;

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
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion =
    prefersReducedMotion || animationLevel === "reduced";

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed left-4 right-4 z-40 mx-auto max-w-md lg:hidden"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <LayoutGroup id="mobile-navigation">
        <div
          data-mobile-nav
          className="gpu-layer flex items-center gap-0.5 rounded-[28px] border border-white/50 bg-slate-100/85 p-1.5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0a0e16]/85 dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="group relative flex h-14 min-w-11 flex-1 touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-[20px] px-0.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#0066FF]/55"
              >
                <span className="relative flex h-11 w-11 items-center justify-center">
                  {active ? (
                    <motion.span
                      layoutId="activeNavIndicator"
                      aria-hidden="true"
                      className="gpu-layer absolute inset-0 rounded-full bg-[#0066FF] shadow-[0_10px_22px_-12px_rgba(0,102,255,0.95),inset_0_1px_0_rgba(255,255,255,0.28)] dark:bg-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      transition={
                        reduceMotion ? { duration: 0 } : INDICATOR_SPRING
                      }
                    />
                  ) : null}
                  <Icon
                    className={cn(
                      "relative z-10 h-[21px] w-[21px] transition-colors duration-150",
                      active
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-800 dark:text-white/45 dark:group-hover:text-white/80",
                    )}
                    strokeWidth={active ? 2.1 : 1.8}
                  />
                </span>
                <span
                  className={cn(
                    "relative z-10 w-full truncate text-center text-[9.5px] leading-none min-[360px]:text-[10px]",
                    active
                      ? "font-semibold text-[#0066FF] dark:text-white"
                      : "font-medium text-slate-500 dark:text-white/45",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
