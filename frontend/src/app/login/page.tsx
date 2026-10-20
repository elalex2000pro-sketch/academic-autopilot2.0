"use client";

import { useState } from "react";
import {
  CalendarCheck,
  NotebookPen,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HIGHLIGHTS = [
  { icon: Wand2, text: "Resúmenes, infografías y mapas mentales con IA" },
  { icon: NotebookPen, text: "Cuadernos con autoguardado y exportación a Word" },
  { icon: Users, text: "Clases compartidas con chat, archivos y exámenes" },
  { icon: Sparkles, text: "Asistente con Gemini, ChatGPT, Claude u OpenRouter" },
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
    <div className="flex min-h-dvh">
      {/* Panel de bienvenida */}
      <div className="relative hidden w-[46%] overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
            <CalendarCheck className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-base font-bold">Academic Autopilot</span>
            <span className="block text-xs text-white/75">Tu copiloto académico</span>
          </span>
        </div>

        <div className="relative space-y-6">
          <div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Organiza, crea y <br />
              aprueba con IA.
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/85">
              Todo tu estudio en un solo lugar, con un diseño claro y herramientas que hacen el
              trabajo pesado por ti.
            </p>
          </div>
          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          Tus apuntes, tus clases y tu plan, siempre a mano.
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="animate-fade-up w-full max-w-md border-slate-200/80 shadow-xl shadow-indigo-500/10">
          <CardHeader className="items-center space-y-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 lg:hidden">
              <CalendarCheck className="h-6 w-6" />
            </span>
            <CardTitle className="text-2xl">
              {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Entra para ver tu plan de estudio."
                : "Empieza gratis en menos de un minuto."}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@universidad.edu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-indigo-600"
            >
              {mode === "login"
                ? "¿No tienes cuenta? Regístrate"
                : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
