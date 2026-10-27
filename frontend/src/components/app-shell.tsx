"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { lazy, Suspense, useEffect } from "react";
import { CalendarCheck, Loader2, LogOut, Settings } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { MobileNavigationBar } from "@/components/mobile-navigation-bar";
import { OfflineStatus } from "@/components/offline-status";
import { ThemeCycleButton } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { WindowControls } from "@/components/window-controls";
import { NAV_GROUPS, SECONDARY_NAV_ITEMS, SETTINGS_ITEM, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

// El tutorial y el instalador no participan en el primer pintado: se cargan
// como chunks aparte y aparecen cuando están listos.
const HelpWidget = lazy(() =>
  import("@/components/help-widget").then((module) => ({
    default: module.HelpWidget,
  })),
);
const InstallAppButton = lazy(() =>
  import("@/components/install-app-button").then((module) => ({
    default: module.InstallAppButton,
  })),
);

function Logo() {
  return (
    <Link href="/" className="app-no-drag flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#3b8cff] to-[#0066ff] text-white shadow-[0_5px_14px_-6px_rgba(0,102,255,0.9),inset_0_1px_0_rgba(255,255,255,0.4)]">
        <CalendarCheck className="h-[17px] w-[17px]" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-slate-800 dark:text-white/90">
          Academic Autopilot
        </span>
        <span className="block truncate text-[10.5px] leading-tight text-slate-500 dark:text-white/35">
          Planificador de estudio
        </span>
      </span>
    </Link>
  );
}

const navItemBase =
  "group flex h-9 items-center gap-2.5 rounded-xl px-3 text-[12.5px] transition-[background-color,color,box-shadow] duration-150 ease-mac";
const navItemActive =
  "bg-[#0066FF] font-medium text-white shadow-[0_10px_24px_-12px_rgba(0,102,255,0.95)]";
const navItemIdle =
  "font-normal text-slate-600 hover:bg-slate-200/60 hover:text-slate-800 dark:text-white/55 dark:hover:bg-white/[0.055] dark:hover:text-white/90";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === "/login";

  // Guard de rutas: sin sesión -> /login.
  useEffect(() => {
    if (!loading && !user && !isPublic) router.replace("/login");
  }, [loading, user, isPublic, router]);

  if (isPublic) {
    return (
      <>
        {children}
        <Suspense fallback={null}>
          <HelpWidget />
        </Suspense>
      </>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-transparent text-slate-500 dark:text-white/45">
        <Loader2 className="h-5 w-5 animate-spin text-[#0066FF]" />
        <span className="text-[12.5px]">Cargando tu espacio…</span>
      </div>
    );
  }

  const name = user.full_name?.trim() || user.email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  // Studio y el lector de libros ocupan toda la altura disponible y ya
  // gestionan su propia cabecera; el inset del shell les haría desbordar.
  const isImmersive = pathname === "/studio" || pathname.startsWith("/library/");

  return (
    <div className="app-shell flex min-h-dvh flex-col bg-transparent lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-slate-300/40 bg-slate-100/70 shadow-[18px_0_60px_-48px_rgba(32,39,48,0.22)] backdrop-blur-3xl dark:border-white/5 dark:bg-black/20 dark:shadow-[18px_0_60px_-48px_rgba(0,0,0,0.9)] lg:flex">
        <div className="app-drag flex h-12 shrink-0 items-center px-4">
          <WindowControls />
        </div>

        <div className="px-4 pb-5">
          <Logo />
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2.5 pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white/30">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(navItemBase, active ? navItemActive : navItemIdle)}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active
                            ? "text-white"
                            : "text-slate-400 group-hover:text-slate-700 dark:text-white/40 dark:group-hover:text-white/70",
                        )}
                        strokeWidth={1.8}
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-slate-300/40 px-2.5 py-3 dark:border-white/[0.06]">
          <Suspense
            fallback={
              <span className="block h-9 w-full rounded-xl bg-slate-200/40 dark:bg-white/[0.03]" />
            }
          >
            <InstallAppButton
              variant="ghost"
              className="h-9 w-full justify-start rounded-xl px-3 text-[12.5px] font-normal text-slate-600 hover:bg-slate-200/60 hover:text-slate-800 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white/90 [&_svg]:text-slate-400 dark:[&_svg]:text-white/40"
            />
          </Suspense>

          <div className="flex items-center gap-0.5">
            <Link
              href={SETTINGS_ITEM.href}
              className={cn(
                "flex h-9 flex-1 items-center gap-2.5 rounded-xl px-3 text-[12.5px] transition-[background-color,color,box-shadow] duration-150",
                isActive(pathname, SETTINGS_ITEM.href) ? navItemActive : navItemIdle,
              )}
            >
              <Settings
                className={cn(
                  "h-4 w-4",
                  isActive(pathname, SETTINGS_ITEM.href)
                    ? "text-white"
                    : "text-slate-400 dark:text-white/40",
                )}
                strokeWidth={1.8}
              />
              Ajustes
            </Link>
            <ThemeCycleButton className="text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/90" />
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-300/40 bg-slate-100/60 px-2 py-2 dark:border-white/[0.04] dark:bg-white/[0.025]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0066FF]/10 text-[10px] font-semibold text-[#0066FF] ring-1 ring-[#0066FF]/15 dark:bg-white/10 dark:text-white/90 dark:ring-white/10">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium leading-tight text-slate-800 dark:text-white/85">
                {name}
              </span>
              <span className="block truncate text-[10.5px] leading-tight text-slate-500 dark:text-white/35">
                {user.email}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="h-7 w-7 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-white/40 dark:hover:bg-white/[0.06] dark:hover:text-white/90"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-transparent">
        {/* Barra superior móvil, con la translucidez de una toolbar. */}
        <header className="sticky top-0 z-40 border-b border-slate-300/40 bg-slate-100/70 pt-[env(safe-area-inset-top,0px)] backdrop-blur-3xl dark:border-white/[0.06] dark:bg-black/40 lg:hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <Logo />
            <div className="flex shrink-0 items-center gap-0.5">
              <Suspense fallback={<span className="block h-8 w-8" />}>
                <InstallAppButton compact />
              </Suspense>
              <ThemeCycleButton className="text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white" />
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Cerrar sesión"
                className="text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <nav className="hide-scrollbar flex gap-1 overflow-x-auto px-2.5 pb-2">
            {SECONDARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors",
                    active
                      ? "bg-[#0066FF] text-white shadow-[0_8px_18px_-10px_rgba(0,102,255,0.9)]"
                      : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-800 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/85",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <OfflineStatus />

        {/* 40 px en móvil y 48 px en escritorio: alinea el contenido con la barra de título. */}
        <main
          className={cn(
            "min-w-0 flex-1 overflow-x-hidden bg-transparent",
            !isImmersive &&
              "pt-10 pb-[calc(var(--mobile-nav-offset)+1.25rem)] lg:pb-0 lg:pt-12",
          )}
        >
          {children}
          <Suspense fallback={null}>
            <HelpWidget />
          </Suspense>
        </main>
      </div>

      <MobileNavigationBar />
    </div>
  );
}
