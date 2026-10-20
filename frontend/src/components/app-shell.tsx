"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  AudioLines,
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
    <Link href="/" className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25">
        <CalendarCheck className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold tracking-tight">Academic Autopilot</span>
        <span className="block truncate text-[11px] text-muted-foreground">Tu copiloto académico</span>
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
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm">Cargando tu espacio...</span>
      </div>
    );
  }

  const name = user.full_name?.trim() || user.email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/70 bg-white/70 p-4 backdrop-blur-xl md:flex">
        <div className="mb-7 px-2">
          <Logo />
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-transform group-hover:scale-110",
                          active ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500",
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

        <div className="mt-2 space-y-2 border-t border-slate-200/70 pt-3">
          <Link
            href={SETTINGS_ITEM.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              isActive(pathname, SETTINGS_ITEM.href)
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Settings className="h-4 w-4" />
            Ajustes
          </Link>

          <div className="flex items-center gap-3 rounded-2xl bg-slate-50/80 px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior móvil */}
        <header className="sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-between px-4 py-2.5">
            <Logo />
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
            {ALL_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          {children}
          <AssistantFab />
          <HelpWidget />
        </main>
      </div>
    </div>
  );
}
