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

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary">
        <CalendarCheck className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[15px] font-semibold leading-tight tracking-tight">
          Academic Autopilot
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
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
      <div className="flex h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm">Cargando tu espacio...</span>
      </div>
    );
  }

  const name = user.full_name?.trim() || user.email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 flex-col border-r border-border bg-card/60 p-3 lg:flex">
        <div className="mb-6 px-2 pt-2">
          <Logo />
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="label-caps px-3 pb-1.5 text-[10px]">{group.label}</p>
              <div className="space-y-px">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-muted font-semibold text-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary"
                          : "font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground/80",
                        )}
                      />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-2 space-y-2 border-t border-border pt-3">
          <InstallAppButton className="mb-1 w-full justify-start" />
          <div className="flex items-center gap-1">
            <Link
              href={SETTINGS_ITEM.href}
              className={cn(
                "flex flex-1 items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                isActive(pathname, SETTINGS_ITEM.href)
                  ? "bg-muted font-semibold text-foreground"
                  : "font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Settings className="h-4 w-4" />
              Ajustes
            </Link>
            <ThemeCycleButton />
          </div>

          <div className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-[11px] font-semibold text-secondary-foreground">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
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
        {/* Barra superior móvil */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur lg:hidden">
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
                    "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
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
