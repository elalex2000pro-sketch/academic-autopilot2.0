"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HIGHLIGHTS = [
  "Horario, tareas y exámenes en un solo plan diario",
  "Apuntes, libros y cuadernos con búsqueda",
  "Resúmenes e infografías a partir de tus documentos",
  "Clases compartidas con chat, archivos y calendario",
];

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
    <div className="flex min-h-dvh bg-background">
      {/* Panel editorial */}
      <div className="relative hidden w-[44%] flex-col justify-between border-r border-border bg-foreground p-10 text-background lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-background/25">
            <CalendarCheck className="h-4 w-4" />
          </span>
          <span className="font-display text-lg tracking-tight">Academic Autopilot</span>
        </div>

        <div>
          <p className="label-caps !text-background/50">Planificador académico</p>
          <h1 className="mt-4 max-w-md font-display text-4xl leading-[1.1] tracking-tight">
            El curso entero, ordenado en una sola página.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-background/70">
            Sincroniza tus asignaturas, reparte el estudio en huecos reales y llega a cada entrega
            con margen.
          </p>

          <ol className="mt-8 space-y-0 border-t border-background/15">
            {HIGHLIGHTS.map((text, index) => (
              <li
                key={text}
                className="flex items-baseline gap-4 border-b border-background/15 py-3 text-sm text-background/85"
              >
                <span className="tabular text-[11px] text-background/45">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                {text}
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-background/45">
          Tus apuntes, tus clases y tu plan, siempre a mano.
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-primary">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <p className="mt-3 font-display text-lg tracking-tight">Academic Autopilot</p>
          </div>

          <p className="label-caps">{mode === "login" ? "Acceso" : "Nueva cuenta"}</p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">
            {mode === "login" ? "Entra en tu espacio" : "Crea tu cuenta"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Tu plan de estudio te está esperando."
              : "Solo necesitas un email y una contraseña."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
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
              <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            {mode === "login" ? "¿Aún no tienes cuenta?" : "¿Ya tienes una cuenta?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {mode === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
