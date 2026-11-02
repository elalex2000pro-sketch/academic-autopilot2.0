"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  GraduationCap,
  Settings,
  Sparkles,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
  /** Gradiente literal para que Tailwind lo incluya en el bundle. */
  accent: string;
  glow: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: "planner",
    eyebrow: "Organiza tu semana",
    title: "Planificador",
    description:
      "Todo lo que tienes que entregar, en una sola línea de tiempo. El plan se adapta a tus fechas y a tu disponibilidad.",
    bullets: [
      "Calendario, horario y tareas en la misma vista.",
      "Añade exámenes y entregas con su fecha y su peso.",
      "Marca una tarea como completada y el plan se reajusta.",
    ],
    icon: CalendarRange,
    accent: "from-[#FF9500] to-[#FF3B30]",
    glow: "bg-[#FF9500]",
  },
  {
    id: "studio",
    eyebrow: "Estudia con ayuda",
    title: "IA Studio",
    description:
      "Pregunta, resume y transcribe sin salir de la app. Tu material de estudio se convierte en respuestas claras.",
    bullets: [
      "Chat tutor para dudas y para organizar tus tareas.",
      "Transcribe una clase y genera un resumen al momento.",
      "Analiza apuntes y crea mapas mentales o infografías.",
    ],
    icon: Wand2,
    accent: "from-[#BF5AF2] to-[#7B2FE0]",
    glow: "bg-[#BF5AF2]",
  },
  {
    id: "academics",
    eyebrow: "Controla tus notas",
    title: "Académico",
    description:
      "Tus asignaturas, exámenes y media ponderada siempre al día. Sabes qué necesitas para llegar a tu objetivo.",
    bullets: [
      "Crea asignaturas y registra calificaciones.",
      "Los exámenes pendientes aparecen en el calendario.",
      "Consulta tu media y cuánto peso falta por evaluar.",
    ],
    icon: GraduationCap,
    accent: "from-[#34C759] to-[#1A9E3A]",
    glow: "bg-[#34C759]",
  },
  {
    id: "settings",
    eyebrow: "Hazlo tuyo",
    title: "Ajustes",
    description:
      "Conecta tus herramientas y elige cómo quieres trabajar. Autopilot se adapta a tu forma de estudiar.",
    bullets: [
      "Conecta Moodle o Google Classroom para importar tareas.",
      "Elige tu motor de IA y activa los recordatorios.",
      "Ajusta el tema, las animaciones y el rendimiento.",
    ],
    icon: Settings,
    accent: "from-[#5C9BFF] to-[#0066FF]",
    glow: "bg-[#0066FF]",
  },
];

interface OnboardingModalProps {
  /**
   * Se llama al completar o saltar. El padre es quien guarda la marca
   * persistente (`hasCompletedOnboarding_v1`) y desmonta el modal.
   */
  onClose: () => void;
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const next = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }, []);

  const previous = useCallback(() => {
    setStepIndex((current) => Math.max(current - 1, 0));
  }, []);

  const finish = useCallback(() => {
    onClose();
  }, [onClose]);

  // Bloquea el scroll de la página y devuelve el foco al cerrar.
  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => primaryRef.current?.focus(), 80);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, []);

  // Escape = saltar (y persistir). Tab queda atrapado; las flechas mueven
  // entre pasos sin robar el foco a los botones.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
        return;
      }

      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.offsetParent !== null);

        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finish, next, previous]);

  if (typeof document === "undefined") return null;

  const Icon = step.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-md dark:bg-black/55 sm:p-6"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        tabIndex={-1}
        data-onboarding
        className="animate-pop relative my-auto w-full max-w-[560px] overflow-hidden rounded-[30px] border border-slate-300/40 bg-gradient-to-br from-[#eef1f5]/95 via-[#e8ecf1]/[0.92] to-[#dfe5ec]/[0.88] text-slate-800 shadow-[0_0_0_0.5px_rgba(32,39,48,0.08),0_28px_90px_-30px_rgba(32,39,48,0.42),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-3xl focus:outline-none dark:border-white/[0.12] dark:from-[#20222b]/95 dark:via-[#14161e]/[0.92] dark:to-[#090b10]/90 dark:text-white/90 dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.08),0_28px_90px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl transition-colors duration-500",
            step.glow,
          )}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-white/40 blur-3xl dark:bg-white/[0.05]"
        />

        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0066FF]/20 bg-[#0066FF]/[0.07] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#0066FF] dark:border-[#7eb2ff]/20 dark:bg-[#0066FF]/15 dark:text-[#9cc4ff]">
              <Sparkles className="h-3 w-3" />
              Primeros pasos
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-medium tabular-nums text-slate-500 dark:text-white/40">
                {stepIndex + 1} / {STEPS.length}
              </span>
              <button
                type="button"
                onClick={finish}
                aria-label="Saltar tour"
                title="Saltar tour"
                className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div key={step.id} className="animate-fade-up mt-5" aria-live="polite">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br text-white shadow-[0_14px_30px_-14px_rgba(32,39,48,0.45),inset_0_1px_0_rgba(255,255,255,0.35)]",
                  step.accent,
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-white/35">
                  {step.eyebrow}
                </p>
                <h2
                  id="onboarding-title"
                  className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.035em] text-slate-900 dark:text-white/95"
                >
                  {step.title}
                </h2>
              </div>
            </div>

            <p
              id="onboarding-description"
              className="mt-3 text-[13px] leading-relaxed text-slate-600 dark:text-white/55"
            >
              {step.description}
            </p>

            <ul className="mt-4 space-y-2.5">
              {step.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-2.5 text-[12px] leading-5 text-slate-700 dark:text-white/65"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#0066FF]/20 dark:text-[#8ab9ff]">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex items-center gap-1.5" aria-label="Progreso del tour">
            {STEPS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStepIndex(index)}
                aria-label={`Ir al paso ${index + 1}: ${item.title}`}
                aria-current={index === stepIndex ? "step" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  index === stepIndex
                    ? "w-6 bg-[#0066FF]"
                    : "w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-white/15 dark:hover:bg-white/30",
                )}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/40 pt-4 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={finish}
                className="px-2 text-[11px] text-slate-500 hover:text-slate-800 dark:text-white/40 dark:hover:text-white/80"
              >
                Saltar tour
              </Button>
              <span className="hidden text-[10px] text-slate-400 dark:text-white/25 sm:inline">
                ← → para moverte
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={previous}
                disabled={stepIndex === 0}
                className="gap-1 px-2.5 text-[11px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>
              <Button
                ref={primaryRef}
                size="sm"
                onClick={isLast ? finish : next}
                className="gap-1.5 rounded-xl px-4 text-[11.5px]"
              >
                {isLast ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Empezar
                  </>
                ) : (
                  <>
                    Siguiente
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
