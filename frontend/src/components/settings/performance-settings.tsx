"use client";

import {
  BatteryCharging,
  Blend,
  Check,
  Gauge,
  RotateCcw,
  Sparkles,
  Waves,
  ZapOff,
  type LucideIcon,
} from "lucide-react";

import {
  usePreferences,
  type AnimationLevel,
  type PerformanceProfile,
} from "@/components/preferences-provider";
import { SettingsCard } from "@/components/settings/settings-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PreferenceOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: LucideIcon;
  tag?: string;
}

const ANIMATION_OPTIONS: PreferenceOption<AnimationLevel>[] = [
  {
    value: "reduced",
    label: "Desactivadas / Reducidas",
    description: "Sin transiciones ni movimiento. Ideal para ahorrar batería o recursos.",
    icon: ZapOff,
    tag: "Máxima batería",
  },
  {
    value: "standard",
    label: "Estándar",
    description: "Transiciones suaves y breves. El equilibrio recomendado para el día a día.",
    icon: Waves,
    tag: "Recomendado",
  },
  {
    value: "fluid",
    label: "Máximo / Fluido",
    description: "Animaciones completas, elevación 3D y desenfoque dinámico al interactuar.",
    icon: Sparkles,
    tag: "Más expresivo",
  },
];

const PERFORMANCE_OPTIONS: PreferenceOption<PerformanceProfile>[] = [
  {
    value: "efficiency",
    label: "Modo Ahorro / Fluidez",
    description:
      "Desactiva los desenfoques pesados y simplifica las sombras. Pensado para hardware modesto.",
    icon: BatteryCharging,
    tag: "Ligero",
  },
  {
    value: "quality",
    label: "Modo Calidad / Liquid Glass",
    description:
      "Mantiene el cristal, la translucidez y todos los efectos visuales de la interfaz.",
    icon: Blend,
    tag: "Cristal completo",
  },
];

const ANIMATION_LABEL: Record<AnimationLevel, string> = {
  reduced: "Animaciones reducidas",
  standard: "Animaciones estándar",
  fluid: "Animaciones fluidas",
};

const PERFORMANCE_LABEL: Record<PerformanceProfile, string> = {
  efficiency: "Ahorro / Fluidez",
  quality: "Calidad / Liquid Glass",
};

function PreferenceOptionCard<T extends string>({
  option,
  selected,
  onSelect,
}: {
  option: PreferenceOption<T>;
  selected: boolean;
  onSelect: (value: T) => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(option.value)}
      className={cn(
        "group flex h-full flex-col items-start gap-2 rounded-xl border p-3 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
        selected
          ? "border-[#0066FF]/35 bg-[#0066FF]/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:border-[#8ab9ff]/25 dark:bg-[#8ab9ff]/[0.08]"
          : "border-slate-300/45 bg-slate-100/50 hover:border-slate-400/40 hover:bg-slate-200/45 dark:border-white/[0.06] dark:bg-white/[0.025] dark:hover:bg-white/[0.05]",
      )}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            selected
              ? "bg-[#0066FF] text-white shadow-[0_6px_14px_-8px_rgba(0,102,255,0.9)]"
              : "bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-white/45",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        {selected ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0066FF] text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : (
          <span className="h-5 w-5 rounded-full border border-slate-300/70 dark:border-white/15" />
        )}
      </span>
      <span className="text-[12px] font-semibold leading-4 text-slate-800 dark:text-white/85">
        {option.label}
      </span>
      <span className="text-[10.5px] leading-4 text-slate-500 dark:text-white/40">
        {option.description}
      </span>
      {option.tag && (
        <span
          className={cn(
            "mt-auto pt-1 text-[9.5px] font-medium uppercase tracking-[0.05em]",
            selected
              ? "text-[#0066FF] dark:text-[#8ab9ff]"
              : "text-slate-400 dark:text-white/25",
          )}
        >
          {option.tag}
        </span>
      )}
    </button>
  );
}

export function PerformanceSettings() {
  const {
    animationLevel,
    performanceProfile,
    setAnimationLevel,
    setPerformanceProfile,
  } = usePreferences();

  function restoreRecommended() {
    setAnimationLevel("standard");
    setPerformanceProfile("quality");
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        icon={Gauge}
        title="Nivel de animaciones"
        description="Controla cuánto movimiento tiene la interfaz completa."
      >
        <div
          role="radiogroup"
          aria-label="Nivel de animaciones"
          className="grid gap-2 md:grid-cols-3"
        >
          {ANIMATION_OPTIONS.map((option) => (
            <PreferenceOptionCard
              key={option.value}
              option={option}
              selected={animationLevel === option.value}
              onSelect={setAnimationLevel}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={BatteryCharging}
        title="Perfil de rendimiento"
        description="Equilibra el efecto de cristal con la potencia de tu dispositivo."
      >
        <div
          role="radiogroup"
          aria-label="Perfil de rendimiento"
          className="grid gap-2 md:grid-cols-2"
        >
          {PERFORMANCE_OPTIONS.map((option) => (
            <PreferenceOptionCard
              key={option.value}
              option={option}
              selected={performanceProfile === option.value}
              onSelect={setPerformanceProfile}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Sparkles}
        title="Vista previa en vivo"
        description="Así se sienten las superficies con la combinación actual."
        action={
          <Button type="button" variant="ghost" size="sm" onClick={restoreRecommended}>
            <RotateCcw className="h-3.5 w-3.5" />
            Valores recomendados
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{ANIMATION_LABEL[animationLevel]}</Badge>
          <Badge variant="outline">{PERFORMANCE_LABEL[performanceProfile]}</Badge>
        </div>

        <div
          key={`${animationLevel}-${performanceProfile}`}
          className="mt-3 grid grid-cols-3 gap-2"
          aria-hidden
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="animate-fade-up app-glass-soft rounded-xl p-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="block h-1.5 w-8 rounded-full bg-[#0066FF]/70" />
              <span className="mt-2 block h-1.5 w-full rounded-full bg-slate-300/70 dark:bg-white/15" />
              <span className="mt-1 block h-1.5 w-2/3 rounded-full bg-slate-300/60 dark:bg-white/10" />
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
          Los cambios se aplican al instante y se guardan en este navegador. Si tu sistema pide
          movimiento reducido, se respeta por encima de esta preferencia.
        </p>
      </SettingsCard>
    </div>
  );
}
