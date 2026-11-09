"use client";

import { useEffect, useRef, useState } from "react";
import {
  CloudRain,
  Coffee,
  Music2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Waves,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AmbientEngine, type AmbientPreset } from "@/lib/ambient-audio";
import { cn } from "@/lib/utils";

const PREFS_KEY = "autopilot:focus:ambient";
const DEFAULT_PRESET: AmbientPreset = "lofi";
const DEFAULT_VOLUME = 0.55;

const PRESETS: { id: AmbientPreset; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "lofi", label: "Lo-Fi", hint: "Pads y vinilo", icon: Music2 },
  { id: "rain", label: "Lluvia", hint: "Gotas suaves", icon: CloudRain },
  { id: "cafe", label: "Cafetería", hint: "Murmullo de fondo", icon: Coffee },
  { id: "white", label: "Ruido rosa", hint: "Concentración pura", icon: Waves },
];

interface AmbientPrefs {
  preset: AmbientPreset;
  volume: number;
}

function readPrefs(): AmbientPrefs {
  if (typeof window === "undefined") {
    return { preset: DEFAULT_PRESET, volume: DEFAULT_VOLUME };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { preset: DEFAULT_PRESET, volume: DEFAULT_VOLUME };
    const parsed = JSON.parse(raw) as Partial<AmbientPrefs>;
    const preset = PRESETS.some((item) => item.id === parsed.preset)
      ? (parsed.preset as AmbientPreset)
      : DEFAULT_PRESET;
    const volume =
      typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
        ? Math.max(0, Math.min(1, parsed.volume))
        : DEFAULT_VOLUME;
    return { preset, volume };
  } catch {
    return { preset: DEFAULT_PRESET, volume: DEFAULT_VOLUME };
  }
}

/**
 * Reproductor de ambiente para el Modo Enfoque. Genera el sonido localmente,
 * así que no depende de Spotify ni de la red.
 */
export function AmbientPlayer() {
  const engineRef = useRef<AmbientEngine | null>(null);
  const [preset, setPreset] = useState<AmbientPreset>(DEFAULT_PRESET);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prefs = readPrefs();
    setPreset(prefs.preset);
    setVolume(prefs.volume);
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  function persist(nextPreset: AmbientPreset, nextVolume: number) {
    try {
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ preset: nextPreset, volume: nextVolume }),
      );
    } catch {
      /* Preferencia no persistente. */
    }
  }

  function engine(): AmbientEngine {
    if (!engineRef.current) engineRef.current = new AmbientEngine();
    return engineRef.current;
  }

  async function toggle() {
    setError(null);
    if (playing) {
      engineRef.current?.stop();
      setPlaying(false);
      return;
    }
    try {
      await engine().start(preset, volume);
      setPlaying(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar el audio.");
    }
  }

  async function choose(next: AmbientPreset) {
    setPreset(next);
    persist(next, volume);
    setError(null);
    if (!playing) return;
    try {
      await engine().start(next, volume);
    } catch (cause) {
      setPlaying(false);
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el sonido.");
    }
  }

  function changeVolume(next: number) {
    setVolume(next);
    engineRef.current?.setVolume(next);
    persist(preset, next);
  }

  const active = PRESETS.find((item) => item.id === preset) ?? PRESETS[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-300">
            <active.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
              Ambiente de estudio
            </p>
            <p className="truncate text-[11.5px] font-medium text-slate-600 dark:text-white/55">
              {playing ? `Sonando · ${active.label}` : "Elige un sonido para concentrarte"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void toggle()}
          className={cn(
            "h-8 rounded-xl px-3 text-[11px]",
            playing && "bg-slate-800 text-white hover:bg-slate-700 dark:bg-white/15",
          )}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? "Pausar" : "Reproducir"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {PRESETS.map((item) => {
          const Icon = item.icon;
          const selected = item.id === preset;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void choose(item.id)}
              aria-pressed={selected}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                selected
                  ? "border-indigo-500/35 bg-indigo-500/10 text-indigo-700 dark:border-indigo-300/25 dark:bg-indigo-400/10 dark:text-indigo-200"
                  : "border-slate-300/40 bg-white/40 text-slate-500 hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/40 dark:hover:bg-white/[0.06]",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-[10.5px] font-semibold">{item.label}</span>
                <span className="block truncate text-[9px] opacity-65">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <VolumeX className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-white/30" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => changeVolume(Number(event.target.value))}
          aria-label="Volumen del ambiente"
          className="h-1 flex-1 cursor-pointer accent-indigo-600"
        />
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-white/30" />
        <span className="w-8 text-right text-[9.5px] tabular-nums text-slate-400 dark:text-white/30">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {error ? (
        <p className="text-[10.5px] text-rose-600 dark:text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}
