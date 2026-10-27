"use client";

import { lazy, Suspense, useState } from "react";
import {
  CalendarCheck,
  Check,
  ChevronDown,
  KeyRound,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WindowControls } from "@/components/window-controls";
import { saveRecoveryHint } from "@/lib/recovery-hint";
import { cn } from "@/lib/utils";

const PasswordRecovery = lazy(() =>
  import("@/components/password-recovery").then((module) => ({
    default: module.PasswordRecovery,
  })),
);

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
  const [view, setView] = useState<"auth" | "recovery">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Recuperación opcional durante el registro.
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [recoveryQuestion, setRecoveryQuestion] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "register") {
      const cleanQuestion = recoveryQuestion.trim();
      const cleanAnswer = recoveryAnswer.trim();
      if (Boolean(cleanQuestion) !== Boolean(cleanAnswer)) {
        setError("Completa la pregunta y la respuesta de seguridad, o deja ambas vacías.");
        return;
      }
      if (cleanQuestion && cleanQuestion.length < 4) {
        setError("La pregunta de seguridad debe tener al menos 4 caracteres.");
        return;
      }
      if (cleanAnswer && cleanAnswer.length < 2) {
        setError("La respuesta de seguridad debe tener al menos 2 caracteres.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        const cleanQuestion = recoveryQuestion.trim();
        const cleanAnswer = recoveryAnswer.trim();
        await register(
          email,
          password,
          fullName || undefined,
          cleanQuestion ? { question: cleanQuestion, answer: cleanAnswer } : undefined,
        );
        // La pregunta queda también en este dispositivo para poder mostrarla
        // como pista si el servidor no está disponible.
        if (cleanQuestion) saveRecoveryHint(email, cleanQuestion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-transparent px-3 py-6 sm:px-6 sm:py-10">
      <div className="mac-window w-full max-w-[880px] overflow-hidden border border-slate-300/40 bg-slate-100/80 backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/90">
        {/* Barra de título de la ventana */}
        <div className="app-drag relative flex h-11 items-center border-b border-slate-300/40 bg-slate-100/60 px-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <TrafficLights />
          <span className="pointer-events-none absolute inset-x-0 text-center text-[13px] font-medium text-muted-foreground">
            Academic Autopilot
          </span>
        </div>

        <div className="grid lg:grid-cols-[1.02fr_1fr]">
          {/* Presentación */}
          <div className="hidden flex-col justify-between border-r border-slate-300/40 bg-slate-200/40 p-9 dark:border-white/[0.06] dark:bg-white/[0.03] lg:flex">
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

            {view === "recovery" ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center gap-2 py-16 text-[12.5px] text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparando la recuperación…
                  </div>
                }
              >
                <PasswordRecovery
                  initialEmail={email}
                  onBack={(value) => {
                    if (value) setEmail(value);
                    setError(null);
                    setView("auth");
                  }}
                />
              </Suspense>
            ) : (
              <>
                {/* Control segmentado */}
                <div
                  role="tablist"
                  aria-label="Acceso o registro"
                  className="flex rounded-md bg-slate-200/60 p-0.5 dark:bg-white/[0.06]"
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

                  {mode === "login" && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setView("recovery");
                        }}
                        className="rounded-md px-1 py-0.5 text-[11.5px] font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        ¿Has olvidado tu contraseña?
                      </button>
                    </div>
                  )}

                  {mode === "register" && (
                    <div className="overflow-hidden rounded-xl border border-slate-300/45 bg-slate-100/45 dark:border-white/[0.06] dark:bg-white/[0.025]">
                      <button
                        type="button"
                        onClick={() => setShowRecoverySetup((current) => !current)}
                        aria-expanded={showRecoverySetup}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[11.5px] font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-white/50 dark:hover:text-white/85"
                      >
                        <KeyRound className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                        <span className="min-w-0 flex-1">
                          Añadir pregunta de seguridad
                          <span className="ml-1 font-normal text-muted-foreground/70">
                            (opcional)
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                            showRecoverySetup && "rotate-180",
                          )}
                        />
                      </button>

                      {showRecoverySetup && (
                        <div className="space-y-3 border-t border-slate-300/40 px-3 py-3 dark:border-white/[0.06]">
                          <p className="text-[10.5px] leading-4 text-muted-foreground">
                            Te permite recuperar la cuenta sin depender del correo. La respuesta se
                            guarda cifrada y nunca se muestra.
                          </p>
                          <div className="space-y-1.5">
                            <Label htmlFor="recoveryQuestion">Pregunta</Label>
                            <Input
                              id="recoveryQuestion"
                              value={recoveryQuestion}
                              onChange={(event) => setRecoveryQuestion(event.target.value)}
                              placeholder="¿Cómo se llamaba tu primera mascota?"
                              maxLength={200}
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="recoveryAnswer">Respuesta</Label>
                            <Input
                              id="recoveryAnswer"
                              value={recoveryAnswer}
                              onChange={(event) => setRecoveryAnswer(event.target.value)}
                              placeholder="Tu respuesta secreta"
                              maxLength={72}
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
