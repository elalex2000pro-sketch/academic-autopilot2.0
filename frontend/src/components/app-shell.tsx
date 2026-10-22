"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  AudioLines,
  BookOpen,
  Brain,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  Library,
  Loader2,
  LogOut,
  NotebookPen,
  Settings,
  Sparkles,
  Target,
  Users,
  Wand2,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { AssistantFab } from "@/components/assistant-fab";
import { HelpWidget } from "@/components/help-widget";
import { InstallAppButton } from "@/components/install-app-button";
import { OfflineStatus } from "@/components/offline-status";
import { ThemeCycleButton } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { WindowControls } from "@/components/window-controls";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Tu día",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/calendar", label: "Calendario", icon: CalendarRange },
      { href: "/schedule", label: "Horario", icon: CalendarDays },
      { href: "/focus", label: "Modo Enfoque", icon: Target },
    ],
  },
  {
    label: "Estudia",
    items: [
      { href: "/library", label: "Biblioteca", icon: BookOpen },
      { href: "/subjects", label: "Asignaturas", icon: Library },
      { href: "/exams", label: "Exámenes", icon: ClipboardList },
      { href: "/notebooks", label: "Cuadernos", icon: NotebookPen },
      { href: "/review", label: "Repaso", icon: Brain },
      { href: "/transcribe", label: "Transcribir", icon: AudioLines },
    ],
  },
  {
    label: "Crea",
    items: [
      { href: "/studio", label: "IA Studio", icon: Wand2 },
      { href: "/assistant", label: "Asistente IA", icon: Sparkles },
    ],
  },
  {
    label: "Comparte",
    items: [
      { href: "/classes", label: "Clases", icon: Users },
      { href: "/files", label: "Archivos", icon: FolderOpen },
    ],
  },
];

const SETTINGS_ITEM = { href: "/settings", label: "Ajustes", icon: Settings };

const ALL_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo() {
  return (
    <Link href="/" className="app-no-drag flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-b from-[#4da3ff] to-[#0066d6] text-white shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)]">
        <CalendarCheck className="h-[17px] w-[17px]" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-white/90">
          Academic Autopilot
        </span>
        <span className="block truncate text-[10.5px] leading-tight text-white/35">
          Planificador de estudio
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === "/login";

  // Guard de rutas: sin sesion -> /login.
  useEffect(() => {
    if (!loading && !user && !isPublic) router.replace("/login");
  }, [loading, user, isPublic, router]);

  if (isPublic) {
    return (
      <>
        {children}
        <HelpWidget />
      </>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-transparent text-white/45">
        <Loader2 className="h-5 w-5 animate-spin text-[#4da3ff]" />
        <span className="text-[12.5px]">Cargando tu espacio…</span>
      </div>
    );
  }

  const name = user.full_name?.trim() || user.email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-transparent lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-white/[0.06] bg-black/30 shadow-[18px_0_60px_-48px_rgba(0,0,0,0.9)] backdrop-blur-3xl lg:flex">
        <div className="app-drag flex h-12 shrink-0 items-center px-4">
          <WindowControls />
        </div>

        <div className="px-4 pb-5">
          <Logo />
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2.5 pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/30">
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
                      className={cn(
                        "group flex h-8 items-center gap-2.5 rounded-xl px-3 text-[12.5px] transition-colors duration-150 ease-mac",
                        active
                          ? "bg-white/[0.09] font-medium text-white shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.07)]"
                          : "font-normal text-white/55 hover:bg-white/[0.055] hover:text-white/90",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-white" : "text-white/40 group-hover:text-white/70",
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

        <div className="shrink-0 space-y-2 border-t border-white/[0.06] px-2.5 py-3">
          <InstallAppButton
            variant="ghost"
            className="h-8 w-full justify-start rounded-xl px-3 text-[12.5px] font-normal text-white/55 hover:bg-white/[0.06] hover:text-white/90 [&_svg]:text-white/40"
          />

          <div className="flex items-center gap-0.5">
            <Link
              href={SETTINGS_ITEM.href}
              className={cn(
                "flex h-8 flex-1 items-center gap-2.5 rounded-xl px-3 text-[12.5px] transition-colors duration-150",
                isActive(pathname, SETTINGS_ITEM.href)
                  ? "bg-white/[0.09] font-medium text-white shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.07)]"
                  : "text-white/55 hover:bg-white/[0.055] hover:text-white/90",
              )}
            >
              <Settings
                className={cn(
                  "h-4 w-4",
                  isActive(pathname, SETTINGS_ITEM.href) ? "text-white" : "text-white/40",
                )}
                strokeWidth={1.8}
              />
              Ajustes
            </Link>
            <ThemeCycleButton className="text-white/45 hover:bg-white/[0.06] hover:text-white/90" />
          </div>

          <div className="flex items-center gap-2 rounded-xl px-1.5 py-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/90 ring-1 ring-white/10">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium leading-tight text-white/85">
                {name}
              </span>
              <span className="block truncate text-[10.5px] leading-tight text-white/35">
                {user.email}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="h-7 w-7 text-white/40 hover:bg-white/[0.06] hover:text-white/90"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-transparent">
        {/* Barra superior móvil, con la translucidez de una toolbar. */}
        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/40 backdrop-blur-3xl lg:hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <Logo />
            <div className="flex shrink-0 items-center gap-0.5">
              <InstallAppButton compact />
              <ThemeCycleButton className="text-white/50 hover:bg-white/10 hover:text-white" />
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Cerrar sesión"
                className="text-white/50 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <nav className="hide-scrollbar flex gap-1 overflow-x-auto px-2.5 pb-2">
            {ALL_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-white/[0.12] text-white shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.07)]"
                      : "text-white/45 hover:bg-white/[0.06] hover:text-white/85",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <OfflineStatus />

        <main className="min-w-0 flex-1 overflow-x-hidden bg-transparent">
          {children}
          <AssistantFab />
          <HelpWidget />
        </main>
      </div>
    </div>
  );
}
