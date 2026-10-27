"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PRIMARY_NAV_ITEMS, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Barra de navegación inferior para móvil y tableta.
 *
 * Es un panel de cristal fijo con los cinco accesos principales. La altura
 * reservada vive en `--mobile-nav-height` y el espacio que debe dejar libre
 * el contenido en `--mobile-nav-offset`, que además suma la safe area del
 * dispositivo. Las secciones secundarias siguen en la cabecera móvil.
 */
export function MobileNavigationBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      data-mobile-nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-[22px] border-t border-slate-300/45 bg-slate-100/80 pb-[env(safe-area-inset-bottom,0px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_-20px_50px_-28px_rgba(32,39,48,0.4)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#0a0e16]/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_-20px_50px_-24px_rgba(0,0,0,0.85)] lg:hidden"
    >
      <div className="mx-auto flex h-[var(--mobile-nav-height)] max-w-lg items-center justify-around gap-0.5 px-1.5">
        {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-h-[56px] min-w-0 flex-1 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-2xl px-0 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/55 focus-visible:ring-offset-0",
                active
                  ? "text-[#0066FF] dark:text-[#8ab9ff]"
                  : "text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white/80",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-9 items-center justify-center rounded-[10px] transition-[background-color,box-shadow,color,transform] duration-150 group-active:scale-95",
                  active
                    ? "bg-[#0066FF] text-white shadow-[0_8px_18px_-10px_rgba(0,102,255,0.95),inset_0_1px_0_rgba(255,255,255,0.35)]"
                    : "bg-transparent group-hover:bg-slate-900/[0.055] dark:group-hover:bg-white/[0.07]",
                )}
              >
                <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.1 : 1.8} />
              </span>
              <span
                className={cn(
                  "w-full truncate text-center text-[9.5px] leading-none min-[360px]:text-[10px]",
                  active ? "font-semibold" : "font-medium",
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
