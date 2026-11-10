"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LogOut, Settings, Sparkles } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ContextPanel } from "@/components/context-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { GamificationThemeSync } from "@/components/gamification-theme-sync";
import { GamificationToast } from "@/components/gamification-toast";
import { Logo } from "@/components/logo";
import { MobileNavigationBar } from "@/components/mobile-navigation-bar";
import { NotificationBell, NotificationCenter } from "@/components/notification-center";
import { OfflineStatus } from "@/components/offline-status";
import { PageTransition } from "@/components/page-transition";
import { usePreferences } from "@/components/preferences-provider";
import { SystemNotifications } from "@/components/system-notifications";
import { ThemeCycleButton } from "@/components/theme-toggle";
import { WindowControls } from "@/components/window-controls";
import { Button } from "@/components/ui/button";
import { AI_DRAWER_EVENT } from "@/lib/ai-drawer";
import { lockBodyScroll } from "@/lib/scroll-lock";
import {
  NAV_GROUPS,
  SECONDARY_NAV_ITEMS,
  SETTINGS_ITEM,
  isActive,
  type NavItem,
} from "@/lib/navigation";
import { useLayoutPreferences } from "@/lib/layout-preferences";
import { hasCompletedOnboarding, markOnboardingCompleted } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

// El instalador no participa en el primer pintado: se carga como chunk aparte
// y aparece cuando está listo.
const InstallAppButton = lazy(() =>
  import("@/components/install-app-button").then((module) => ({
    default: module.InstallAppButton,
  })),
);
// El tour de bienvenida solo se descarga si la marca local dice que aún no se
// ha completado. Los usuarios que ya lo vieron no pagan su JavaScript.
const OnboardingModal = lazy(() =>
  import("@/components/onboarding-modal").then((module) => ({
    default: module.OnboardingModal,
  })),
);
// El drawer de IA se descarga solo cuando se abre por primera vez.
const IAStudio = lazy(() =>
  import("@/components/ia-studio").then((module) => ({ default: module.IAStudio })),
);

const RAIL_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 30,
} as const;

const HEADER_CONTROL =
  "flex items-center justify-center rounded-full border border-white/20 bg-white/50 p-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.07]";

// En Academic-Office los controles flotan sobre el lienzo, sin la píldora
// blanca que rompía la continuidad del fondo.
const HEADER_CONTROL_FLAT = "flex items-center justify-center p-2";

const HEADER_BUTTON =
  "h-9 w-9 rounded-full text-[#3f3852] hover:bg-white/60 hover:text-[#1d1d1f] dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white";

function RailNavLink({
  href,
  label,
  icon: Icon,
  active,
  reduceMotion,
}: {
  href: string;
  label: string;
  icon: NavItem["icon"];
  active: boolean;
  reduceMotion: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
      className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/55"
    >
      {active ? (
        <motion.div
          layoutId="activeNavBubble"
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[#e9e4f6] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.75)]"
          transition={reduceMotion ? { duration: 0 } : RAIL_SPRING}
        />
      ) : null}
      <motion.span
        aria-hidden="true"
        className="relative z-10 flex h-full w-full items-center justify-center"
        whileHover={active || reduceMotion ? undefined : { scale: 1.1 }}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "h-[19px] w-[19px] transition-colors",
            active ? "text-[#1d1d1f]" : "text-white/55 group-hover:text-white",
          )}
          strokeWidth={active ? 2.05 : 1.8}
        />
      </motion.span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { animationLevel } = usePreferences();
  const { layout } = useLayoutPreferences();
  const sidebarLayout = layout.sidebar;
  const reduceMotion = animationLevel === "reduced";
  const isPublic = pathname === "/login";
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Guard de rutas: sin sesión -> /login.
  useEffect(() => {
    if (!loading && !user && !isPublic) router.replace("/login");
  }, [loading, user, isPublic, router]);

  // El tour solo aparece la primera vez que se abre la app en este
  // dispositivo. Se comprueba tras montar para no romper la hidratación y se
  // espera a tener sesión para no tapar la pantalla de carga.
  useEffect(() => {
    if (loading || !user || isPublic) return;
    if (!hasCompletedOnboarding()) setShowOnboarding(true);
  }, [loading, user, isPublic]);

  // El drawer de IA se abre desde cualquier pantalla mediante un evento.
  useEffect(() => {
    const open = () => setAiOpen(true);
    window.addEventListener(AI_DRAWER_EVENT, open);
    return () => window.removeEventListener(AI_DRAWER_EVENT, open);
  }, []);

  useEffect(() => {
    if (!aiOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAiOpen(false);
    };
    const releaseScrollLock = lockBodyScroll();
    window.addEventListener("keydown", onKey);
    return () => {
      releaseScrollLock();
      window.removeEventListener("keydown", onKey);
    };
  }, [aiOpen]);

  const finishOnboarding = useCallback(() => {
    markOnboardingCompleted();
    setShowOnboarding(false);
  }, []);

  if (isPublic) {
    return (
      <ErrorBoundary resetKey={pathname}>
        <PageTransition>{children}</PageTransition>
      </ErrorBoundary>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-transparent text-slate-500 dark:text-white/45">
        <Loader2 className="h-5 w-5 animate-spin text-[#1d1d1f] dark:text-white" />
        <span className="text-[12.5px]">Cargando tu espacio…</span>
      </div>
    );
  }

  const name = user.full_name?.trim() || user.email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  // Studio y el lector de libros ocupan toda la altura disponible y ya
  // gestionan su propia cabecera; el inset del shell les haría desbordar.
  const isBookReader = pathname.startsWith("/library/");
  const isOffice = pathname === "/office";
  const isPlanner = pathname === "/planner";
  const isImmersive = pathname === "/studio" || isBookReader;

  return (
    <NotificationCenter>
      <SystemNotifications />
      <div
        className={cn(
          "app-shell flex min-h-dvh flex-col bg-transparent md:flex-row",
          sidebarLayout.side === "right" && "md:flex-row-reverse",
        )}
      >
        <aside
          className={cn(
            "v18-rail sticky top-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col items-center overflow-hidden rounded-[32px] border border-white/10 bg-[#1b1b1f] pb-4 pt-2 shadow-[0_30px_70px_-30px_rgba(20,20,28,0.72),inset_0_1px_0_rgba(255,255,255,0.09)] transition-[width] duration-200 md:flex",
            sidebarLayout.side === "right" ? "mr-4" : "ml-4",
            sidebarLayout.collapsed ? "w-[62px]" : "w-[78px]",
          )}
        >
          {/* Los semáforos viven dentro del rail oscuro, no en una franja suelta. */}
          <div className="app-drag flex h-9 w-full shrink-0 items-center justify-center">
            <WindowControls compact />
          </div>
          <Link
            href="/"
            aria-label="Academic Autopilot · Inicio"
            title="Academic Autopilot"
            className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/55"
          >
            <Logo className={sidebarLayout.collapsed ? "h-8 w-8" : "h-10 w-10"} />
          </Link>

          <nav
            aria-label="Navegación principal"
            className="hide-scrollbar mt-6 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2"
          >
            {NAV_GROUPS.map((group, groupIndex) => (
              <Fragment key={group.label}>
                {groupIndex > 0 ? (
                  <span
                    aria-hidden="true"
                    className="my-2 h-px w-6 shrink-0 bg-white/10"
                  />
                ) : null}
                {group.items.map(({ href, label, icon }) => (
                  <RailNavLink
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                    active={isActive(pathname, href)}
                    reduceMotion={Boolean(reduceMotion)}
                  />
                ))}
              </Fragment>
            ))}
          </nav>

          <div className="mt-2 flex shrink-0 flex-col items-center gap-1 border-t border-white/10 px-2 pt-3">
            <RailNavLink
              href={SETTINGS_ITEM.href}
              label={SETTINGS_ITEM.label}
              icon={Settings}
              active={isActive(pathname, SETTINGS_ITEM.href)}
              reduceMotion={Boolean(reduceMotion)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="h-11 w-11 rounded-full text-white/55 hover:bg-white/10 hover:text-white dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-transparent">
          {/* Cabecera móvil: el rail de escritorio empieza en `md`. */}
          {!isBookReader ? (
            <header
              className={cn(
                "sticky top-0 z-40 border-b pt-[env(safe-area-inset-top,0px)] md:hidden",
                isOffice
                  ? "border-transparent bg-transparent"
                  : "border-black/[0.04] bg-[#f4f4f7]/82 backdrop-blur-2xl dark:border-white/[0.06] dark:bg-[#0c0c0f]/82",
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <Link
                  href="/"
                  className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1f]/25 dark:focus-visible:ring-white/35"
                  aria-label="Academic Autopilot · Inicio"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1b1b1f] text-white">
                    <Logo className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold leading-tight tracking-[-0.02em] text-[#1d1d1f] dark:text-white/90">
                      Academic Autopilot
                    </span>
                    <span className="block truncate text-[9.5px] leading-tight text-black/45 dark:text-white/35">
                      Planificador de estudio
                    </span>
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Suspense fallback={<span className="block h-9 w-9" />}>
                    <InstallAppButton compact />
                  </Suspense>
                  <NotificationBell className="h-10 w-10 rounded-full text-slate-500 hover:bg-black/[0.05] hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white" />
                  <ThemeCycleButton className="h-10 w-10 rounded-full text-slate-500 hover:bg-black/[0.05] hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={logout}
                    aria-label="Cerrar sesión"
                    className="h-10 w-10 rounded-full text-slate-500 hover:bg-black/[0.05] hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <nav className="hide-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2">
                {SECONDARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-full px-3 text-[11px] font-medium transition-colors",
                        active
                          ? "bg-[#1b1b1f] text-white shadow-[0_6px_16px_-9px_rgba(0,0,0,0.7)]"
                          : "bg-white/55 text-black/55 hover:bg-white/80 hover:text-black/80 dark:bg-white/[0.06] dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white/85",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </header>
          ) : null}

          {/* Barra superior de escritorio: controles globales fuera del rail. */}
          {!isImmersive ? (
            <header className="mx-auto hidden w-full max-w-7xl shrink-0 items-center justify-end gap-4 px-6 pb-2 pt-8 md:flex">
              <motion.div
                whileHover={reduceMotion ? undefined : { scale: 1.05, y: -2 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={isOffice ? HEADER_CONTROL_FLAT : HEADER_CONTROL}
              >
                <NotificationBell className={HEADER_BUTTON} />
              </motion.div>
              <motion.div
                whileHover={reduceMotion ? undefined : { scale: 1.05, y: -2 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={isOffice ? HEADER_CONTROL_FLAT : HEADER_CONTROL}
              >
                <ThemeCycleButton className={HEADER_BUTTON} />
              </motion.div>
              <motion.div
                whileHover={reduceMotion ? undefined : { scale: 1.05, y: -2 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={isOffice ? HEADER_CONTROL_FLAT : HEADER_CONTROL}
              >
                <Link
                  href="/settings"
                  aria-label={`Perfil de ${name}`}
                  title={name}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1b1b1f] text-[10.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] outline-none transition-colors hover:bg-[#2a2a31] focus-visible:ring-2 focus-visible:ring-[#1d1d1f]/25 dark:bg-[#e9e4f6] dark:text-[#1d1d1f] dark:hover:bg-white dark:focus-visible:ring-white/40"
                >
                  {initials}
                </Link>
              </motion.div>
            </header>
          ) : null}

          <OfflineStatus />

          <main
            className={cn(
              "min-w-0 flex-1 bg-transparent",
              // `clip` no convierte el eje Y en un scroller: con `hidden` el
              // navegador calcula `overflow-y: auto` y la rueda se queda atrapada
              // dentro de `main` en vez de mover la página.
              "overflow-x-clip",
              !isImmersive &&
                "pb-[calc(var(--mobile-nav-offset)+1.25rem)] pt-4 md:pb-0 md:pt-5",
            )}
          >
            <div
              className={cn(
                "mx-auto w-full",
                !isImmersive && (isPlanner ? "max-w-[1800px]" : "max-w-7xl"),
              )}
            >
              <ErrorBoundary resetKey={pathname}>
                <PageTransition>{children}</PageTransition>
              </ErrorBoundary>
            </div>
          </main>
        </div>

        {!isImmersive && !isPlanner ? <ContextPanel /> : null}

        {!isBookReader ? <MobileNavigationBar /> : null}
      </div>

      <GamificationToast />
      <GamificationThemeSync />

      {/* Acceso global al panel de IA, encima de la barra móvil. */}
      <button
        type="button"
        onClick={() => setAiOpen(true)}
        aria-label="Abrir IA Studio"
        title="Preguntar a la IA"
        className="fixed bottom-[calc(var(--mobile-nav-offset,5.5rem)+0.75rem)] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-[#1b1b1f]/85 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)] backdrop-blur-2xl transition-transform hover:scale-105 md:bottom-6 md:right-6 dark:border-white/10"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {aiOpen ? (
          <motion.div
            key="ai-drawer"
            className="fixed inset-0 z-[95] flex justify-end bg-slate-950/35 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAiOpen(false)}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="IA Studio"
              className="flex h-dvh w-full min-w-0 max-w-[480px] flex-col overflow-hidden border-l border-white/15 bg-[#f4f4f7]/92 shadow-[-30px_0_80px_-40px_rgba(15,23,42,0.65)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/94"
              initial={{ x: 64, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 64, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onClick={(event) => event.stopPropagation()}
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center gap-2 text-[12px] text-slate-500 dark:text-white/45">
                    <Loader2 className="h-4 w-4 animate-spin" /> Abriendo IA…
                  </div>
                }
              >
                <IAStudio embedded onClose={() => setAiOpen(false)} />
              </Suspense>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showOnboarding ? (
        <Suspense fallback={null}>
          <OnboardingModal onClose={finishOnboarding} />
        </Suspense>
      ) : null}
    </NotificationCenter>
  );
}
