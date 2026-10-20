"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useTheme, type Theme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Tema de la aplicación"
      className={cn(
        "grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/60 p-1",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-card text-primary shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeCycleButton({ className }: { className?: string }) {
  const { theme, resolvedTheme, cycleTheme } = useTheme();
  const Icon = theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;
  const label =
    theme === "system" ? "Tema del sistema" : theme === "dark" ? "Tema oscuro" : "Tema claro";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className={className}
      aria-label={`${label}. Cambiar tema`}
      title={`${label} · pulsa para cambiar`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
