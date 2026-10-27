"use client";

import {
  Gauge,
  Palette,
  PlugZap,
  Settings2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SettingsTabId = "general" | "performance" | "integrations" | "account";

export interface SettingsTabDefinition {
  id: SettingsTabId;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_TABS: SettingsTabDefinition[] = [
  {
    id: "general",
    label: "General y Apariencia",
    description: "Tema, fondo y escritorio",
    icon: Palette,
  },
  {
    id: "performance",
    label: "Rendimiento y Animaciones",
    description: "Movimiento y cristal",
    icon: Gauge,
  },
  {
    id: "integrations",
    label: "Integraciones y Herramientas",
    description: "Plataformas, IA y avisos",
    icon: PlugZap,
  },
  {
    id: "account",
    label: "Sincronización y Cuenta",
    description: "Perfil, sync y respaldo",
    icon: UserRound,
  },
];

interface SettingsTabsProps {
  active: SettingsTabId;
  onChange: (tab: SettingsTabId) => void;
}

export function SettingsTabs({ active, onChange }: SettingsTabsProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % SETTINGS_TABS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SETTINGS_TABS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextTab = SETTINGS_TABS[nextIndex];
    onChange(nextTab.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`settings-tab-${nextTab.id}`)?.focus();
    });
  }

  return (
    <nav aria-label="Secciones de ajustes" className="glass-inset rounded-2xl p-1.5">
      <div role="tablist" aria-orientation="horizontal" className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4">
        {SETTINGS_TABS.map((tab, index) => {
          const Icon = tab.icon;
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "group flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                selected
                  ? "bg-slate-50/95 text-slate-900 shadow-[0_1px_2px_rgba(32,39,48,0.08),inset_0_1px_0_rgba(255,255,255,0.55)] dark:bg-white/[0.09] dark:text-white"
                  : "text-slate-500 hover:bg-slate-200/45 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/75",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                  selected
                    ? "border-[#0066FF]/20 bg-[#0066FF]/10 text-[#0066FF] dark:border-[#8ab9ff]/20 dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]"
                    : "border-transparent bg-slate-200/50 text-slate-500 group-hover:text-slate-700 dark:bg-white/[0.04] dark:text-white/40 dark:group-hover:text-white/70",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-semibold leading-4">
                  {tab.label}
                </span>
                <span className="hidden truncate text-[10px] leading-[0.875rem] text-slate-500/90 dark:text-white/35 sm:block">
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SettingsCard({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SettingsCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 p-5 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-300/45 bg-slate-100/70 text-[#0066FF] dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-[#8ab9ff]">
            <Icon className="h-4 w-4" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-[14px]">{title}</CardTitle>
            {description && (
              <p className="mt-0.5 text-[11.5px] leading-4 text-slate-500 dark:text-white/40">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
      </CardHeader>
      <CardContent className={cn("p-5 pt-1", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

interface SettingsGroupProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsGroup({ icon: Icon, title, description, children }: SettingsGroupProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-white/35" strokeWidth={1.9} />
        <div>
          <h2 className="text-[12px] font-semibold tracking-[-0.005em] text-slate-700 dark:text-white/75">
            {title}
          </h2>
          {description && (
            <p className="text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

interface SettingRowProps {
  title: string;
  titleId?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingRow({ title, titleId, description, children, className }: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-slate-300/45 bg-slate-100/55 p-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06] dark:bg-white/[0.03]",
        className,
      )}
    >
      <div className="min-w-0">
        <p
          id={titleId}
          className="text-[12.5px] font-semibold leading-4 text-slate-800 dark:text-white/85"
        >
          {title}
        </p>
        {description && (
          <div className="mt-1 max-w-xl text-[11px] leading-4 text-slate-500 dark:text-white/40">
            {description}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export type CompactIntegrationStatus = "connected" | "disconnected" | "manual";

const STATUS_META: Record<
  CompactIntegrationStatus,
  { label: string; dot: string; text: string }
> = {
  connected: {
    label: "Conectado",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  disconnected: {
    label: "Desconectado",
    dot: "bg-slate-400",
    text: "text-slate-500 dark:text-white/40",
  },
  manual: {
    label: "Acceso directo",
    dot: "bg-[#0066FF] dark:bg-[#8ab9ff]",
    text: "text-[#0066FF] dark:text-[#8ab9ff]",
  },
};

interface CompactIntegrationCardProps {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: CompactIntegrationStatus;
  statusLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function CompactIntegrationCard({
  id,
  name,
  description,
  icon: Icon,
  status,
  statusLabel,
  expanded,
  onToggle,
  children,
}: CompactIntegrationCardProps) {
  const meta = STATUS_META[status];
  const panelId = `integration-panel-${id}`;

  return (
    <div
      className={cn(
        "app-glass-soft rounded-2xl p-3.5 transition-[border-color,box-shadow] duration-150",
        expanded &&
          "border-[#0066FF]/25 shadow-[0_12px_30px_-24px_rgba(0,102,255,0.35)] dark:border-[#8ab9ff]/20",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300/40 bg-slate-100/70 text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white/60">
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold leading-4 text-slate-800 dark:text-white/85">
            {name}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-[0.875rem] text-slate-500 dark:text-white/35">
            {description}
          </p>
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium leading-3",
              meta.text,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {statusLabel ?? meta.label}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`Configurar ${name}`}
          title={`Configurar ${name}`}
          className="h-7 w-7 shrink-0 rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/[0.07] dark:hover:text-white/80"
        >
          <Settings2
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        </Button>
      </div>

      {expanded && (
        <div
          id={panelId}
          className="mt-3 animate-fade-in border-t border-slate-300/40 pt-3 dark:border-white/[0.07]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
