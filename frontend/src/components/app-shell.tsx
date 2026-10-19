"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  Library,
  LogOut,
  Settings,
  Sparkles,
  Target,
  Users,
  Wand2,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { AssistantFab } from "@/components/assistant-fab";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Asignaturas", icon: Library },
  { href: "/schedule", label: "Horario", icon: CalendarDays },
  { href: "/calendar", label: "Calendario", icon: CalendarRange },
  { href: "/exams", label: "Examenes", icon: ClipboardList },
  { href: "/studio", label: "IA Studio", icon: Wand2 },
  { href: "/assistant", label: "Asistente IA", icon: Sparkles },
  { href: "/classes", label: "Clases compartidas", icon: Users },
  { href: "/files", label: "Archivos", icon: FolderOpen },
  { href: "/focus", label: "Modo Enfoque", icon: Target },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === "/login";

  // Guard de rutas: sin sesion -> /login.
  useEffect(() => {
    if (!loading && !user && !isPublic) router.replace("/login");
  }, [loading, user, isPublic, router]);

  if (isPublic) return <>{children}</>;

  if (loading || !user) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card/40 p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <CalendarCheck className="h-6 w-6 text-primary" />
          <span className="font-semibold">Academic Autopilot</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t pt-4">
          <p className="truncate px-2 text-xs text-muted-foreground">{user.email}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        {children}
        <AssistantFab />
      </main>
    </div>
  );
}
