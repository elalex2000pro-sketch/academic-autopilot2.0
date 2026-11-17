"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGroup, useReducedMotion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { WindowControls } from "@/components/window-controls";
import { ThemeCycleButton } from "@/components/theme-toggle";
import { useSidebarPreferences } from "@/lib/layout-preferences";
import { NAV_GROUPS, SETTINGS_ITEM, isActive } from "@/lib/navigation";
import { SidebarLink } from "./sidebar-link";
import { cn } from "@/lib/utils";

export function Sidebar({ reduceMotion, logout, name, email }: { reduceMotion: boolean; logout: () => void; name: string; email: string }) {
  const pathname = usePathname();
  const { sidebar, updateSidebar } = useSidebarPreferences();
  const systemReduced = useReducedMotion();
  const reduced = reduceMotion || Boolean(systemReduced);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => setHovered(null), [pathname, sidebar.collapsed]);
  const toggleLabel = sidebar.collapsed ? "Mostrar nombres de la barra" : "Ocultar nombres de la barra";
  return (
    <aside
      aria-label="Barra lateral"
      data-collapsed={sidebar.collapsed}
      data-side={sidebar.side}
      style={{ transitionProperty: "width", transitionDuration: reduced ? "0s" : "var(--duration-ultra)" }}
      className={cn("app-glass sticky top-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col rounded-3xl text-foreground md:flex", sidebar.side === "right" ? "mr-3" : "ml-3", sidebar.collapsed ? "w-[72px]" : "w-[224px]")}
    >
      <div className="app-drag flex h-8 shrink-0 items-center justify-center"><WindowControls compact /></div>
      <div className={cn("flex shrink-0 items-center gap-2 px-3 pb-2", sidebar.collapsed && "flex-col")}>
        <Link href="/" aria-label="Atlantium · Inicio" className="flex min-w-0 flex-1 items-center gap-2 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <Logo className="h-9 w-9" />
          {!sidebar.collapsed && <span className="text-sm font-semibold tracking-tight">Atlantium</span>}
        </Link>
        <button type="button" onClick={() => updateSidebar({ collapsed: !sidebar.collapsed })} aria-label={toggleLabel} title={toggleLabel} aria-expanded={!sidebar.collapsed} aria-controls="desktop-navigation" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          {sidebar.collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <LayoutGroup id="desktop-sidebar">
        <nav id="desktop-navigation" aria-label="Navegación principal" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" onMouseLeave={() => setHovered(null)}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mt-2 space-y-1">
              {!sidebar.collapsed ? <p className="px-3 pb-1 text-[11px] font-medium text-muted-foreground">{group.label}</p> : <div aria-hidden="true" className="mx-3 my-2 border-t border-border" />}
              {group.items.map(item => <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={sidebar.collapsed} side={sidebar.side} reduced={reduced} hovered={hovered === item.href} onHighlight={setHovered} />)}
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-border px-2 py-2">
          <div className={cn("flex items-center gap-3 px-1", sidebar.collapsed && "justify-center")}>
            <ThemeCycleButton className="h-11 w-11 shrink-0 text-foreground hover:bg-accent" />
            {!sidebar.collapsed && <span className="text-xs text-muted-foreground">Tema de la app</span>}
          </div>
          <SidebarLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} collapsed={sidebar.collapsed} side={sidebar.side} reduced={reduced} hovered={hovered === SETTINGS_ITEM.href} onHighlight={setHovered} />
          <Link href="/settings" aria-label={`Perfil de ${name}`} title={name} className={cn("flex min-w-0 items-center gap-2 rounded-2xl p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", sidebar.collapsed && "justify-center")}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{name.slice(0, 2).toUpperCase()}</span>
            {!sidebar.collapsed && <span className="min-w-0"><span className="block truncate text-xs font-medium">{name}</span><span className="block truncate text-[10px] text-muted-foreground">{email}</span></span>}
          </Link>
          <button type="button" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión" className={cn("flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", sidebar.collapsed && "justify-center px-0")}>
            <LogOut aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            {!sidebar.collapsed && "Cerrar sesión"}
          </button>
        </div>
      </LayoutGroup>
    </aside>
  );
}
