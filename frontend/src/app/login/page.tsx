"use client";

import { useState } from "react";
import { CalendarCheck, Check } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WindowControls } from "@/components/window-controls";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  "Horario, tareas y exámenes en un solo plan diario",
  "Apuntes, libros y cuadernos con búsqueda",
  "Resúmenes e infografías a partir de tus documentos",
  "Clases compartidas con chat, archivos y calendario",
];

function TrafficLights() {
  return <WindowControls />;
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, fullName || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#e9e9ee] px-3 py-6 sm:px-6 sm:py-10 dark:bg-[#101011]">
      <div className="mac-window w-full max-w-[880px] overflow-hidden bg-card">
        {/* Barra de título de la ventana */}
        <div className="app-drag relative flex h-11 items-center border-b border-separator bg-card px-4">
          <TrafficLights />
          <span className="pointer-events-none absolute inset-x-0 text-center text-[13px] font-medium text-muted-foreground">
            Academic Autopilot
          </span>
        </div>

        <div className="grid lg:grid-cols-[1.02fr_1fr]">
          {/* Presentación */}
          <div className="hidden flex-col justify-between border-r border-separator bg-muted/50 p-9 lg:flex">
            <div>
              <span className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#4da3ff] to-[#0066d6] text-white shadow-[0_2px_6px_rgba(0,80,200,0.28),inset_0_1px_0_rgba(255,255,255,0.4)]">
                <CalendarCheck className="h-7 w-7" strokeWidth={2} />
              </span>

              <h1 className="mt-6 text-[26px] font-semibold leading-[1.15] tracking-[-0.025em]">
                El curso entero,
                <br />
                ordenado en una página.
              </h1>
              <p className="mt-3 max-w-xs text-[13px] leading-5 text-muted-foreground">
                Sincroniza tus asignaturas, reparte el estudio en huecos reales y llega a cada
                entrega con margen.
              </p>

              <ul className="mt-8 space-y-3">
                {HIGHLIGHTS.map((text) => (
                  <li key={text} className="flex items-start gap-2.5 text-[13px] leading-5">
                    <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <span className="text-foreground/85">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-10 text-[11px] text-muted-foreground">
              Tus apuntes, tus clases y tu plan, siempre a mano.
            </p>
          </div>

          {/* Formulario */}
          <div className="p-6 sm:p-9">
            <div className="mb-7 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-gradient-to-b from-[#4da3ff] to-[#0066d6] text-white shadow-sm">
                <CalendarCheck className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="text-[13px] font-semibold">Academic Autopilot</span>
            </div>

            {/* Control segmentado */}
            <div
              role="tablist"
              aria-label="Acceso o registro"
              className="flex rounded-md bg-muted p-0.5"
            >
              {(
                [
                  ["login", "Entrar"],
                  ["register", "Crear cuenta"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value);
                    setError(null);
                  }}
                  className={cn(
                    "h-[26px] flex-1 rounded-[5px] text-[12.5px] font-medium transition-all duration-150 ease-mac",
                    mode === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <h2 className="mt-6 text-[20px] font-semibold tracking-[-0.02em]">
              {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {mode === "login"
                ? "Entra para ver el plan de hoy."
                : "Solo necesitas un email y una contraseña."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Nombre</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@universidad.edu"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>

              {error && (
                <p className="rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-2 text-[12.5px] text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? "Procesando…" : mode === "login" ? "Entrar" : "Crear cuenta"}
              </Button>
            </form>

            <p className="mt-5 text-center text-[11px] leading-4 text-muted-foreground">
              Al continuar aceptas el uso responsable de tus datos.
              <br />
              Tu cuenta es privada: nadie más ve tus apuntes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
