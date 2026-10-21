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

/** Semáforos de la ventana. Solo decorativos. */
function TrafficLights({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)} aria-hidden>
      <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.18)]" />
      <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.16)]" />
      <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.16)]" />
    </span>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-b from-[#4da3ff] to-[#0066d6] text-white shadow-[0_1px_2px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.35)]">
        <CalendarCheck className="h-[17px] w-[17px]" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight tracking-[-0.01em]">
          Academic Autopilot
        </span>
        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
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
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-[13px]">Cargando tu espacio…</span>
      </div>
    );
  }

  const name = user.full_name?.trim() || user.email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="vibrancy sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-separator lg:flex">
        <div className="flex h-11 shrink-0 items-center px-4">
          <TrafficLights />
        </div>

        <div className="px-3 pb-4">
          <Logo />
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/85">
                {group.label}
              </p>
              <div className="space-y-px">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-[29px] items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-100 ease-mac",
                        active
                          ? "bg-primary font-medium text-primary-foreground shadow-sm"
                          : "font-normal text-foreground/85 hover:bg-foreground/[0.055] hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-white" : "text-foreground/55",
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

        <div className="shrink-0 space-y-2 border-t border-separator px-2 py-2.5">
          <InstallAppButton
            variant="ghost"
            className="h-[29px] w-full justify-start px-2 text-[13px] font-normal text-foreground/85"
          />

          <div className="flex items-center gap-1">
            <Link
              href={SETTINGS_ITEM.href}
              className={cn(
                "flex h-[29px] flex-1 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-100",
                isActive(pathname, SETTINGS_ITEM.href)
                  ? "bg-primary font-medium text-primary-foreground shadow-sm"
                  : "text-foreground/85 hover:bg-foreground/[0.055] hover:text-foreground",
              )}
            >
              <Settings
                className={cn(
                  "h-4 w-4",
                  isActive(pathname, SETTINGS_ITEM.href) ? "text-white" : "text-foreground/55",
                )}
                strokeWidth={1.8}
              />
              Ajustes
            </Link>
            <ThemeCycleButton />
          </div>

          <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-foreground/[0.04]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium leading-tight">{name}</span>
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {user.email}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="h-7 w-7 text-muted-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior móvil, con la translucidez de una toolbar. */}
        <header className="vibrancy sticky top-0 z-40 border-b border-separator lg:hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <Logo />
            <div className="flex shrink-0 items-center gap-0.5">
              <InstallAppButton compact />
              <ThemeCycleButton />
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2.5 pb-2 [scrollbar-width:none]">
            {ALL_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-foreground/[0.055] hover:text-foreground",
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

        <main className="min-w-0 flex-1 overflow-x-hidden">
          {children}
          <AssistantFab />
          <HelpWidget />
        </main>
      </div>
    </div>
  );
}
