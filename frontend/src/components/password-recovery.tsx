"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getRecoveryHint, saveRecoveryHint } from "@/lib/recovery-hint";

type Step = "email" | "answer" | "hint";

interface PasswordRecoveryProps {
  initialEmail?: string;
  onBack: (email?: string) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "No se pudo completar la recuperación. Inténtalo de nuevo.";
}

/**
 * Recuperación sin depender de un servicio de correo: el backend devuelve la
 * pregunta de seguridad y, si la respuesta es correcta, permite fijar una
 * contraseña nueva. Si el servidor no responde, se muestra la pista guardada
 * en este dispositivo.
 */
export function PasswordRecovery({ initialEmail = "", onBack }: PasswordRecoveryProps) {
  const { recover } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [question, setQuestion] = useState("");
  const [localHint, setLocalHint] = useState("");
  const [answer, setAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Escribe el email de tu cuenta.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.recoveryQuestion(cleanEmail);
      if (result.available && result.question) {
        setQuestion(result.question);
        saveRecoveryHint(cleanEmail, result.question);
        setStep("answer");
        return;
      }

      const hint = getRecoveryHint(cleanEmail);
      if (hint) {
        setLocalHint(hint.question);
        setStep("hint");
        setNotice(
          "Esta cuenta no tiene una pregunta configurada en el servidor. Te mostramos la pista guardada en este dispositivo.",
        );
        return;
      }

      setError(
        "No hay una pregunta de seguridad configurada para esta cuenta. Entra con tu contraseña y configúrala en Ajustes → Cuenta.",
      );
    } catch (cause) {
      const hint = getRecoveryHint(cleanEmail);
      if (hint) {
        setLocalHint(hint.question);
        setStep("hint");
        setNotice(
          "No pudimos conectar con el servidor. Esta es la pista guardada en este dispositivo.",
        );
      } else {
        setError(errorMessage(cause));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // `recover` guarda el token nuevo y entra en la app. El backend invalida
      // los tokens anteriores al cambiar la contraseña.
      await recover(email.trim(), answer, password);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  if (step === "hint") {
    return (
      <div className="mt-6">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <KeyRound className="h-4 w-4" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
              Pista guardada en este dispositivo
            </p>
            <p className="mt-1.5 text-[13px] font-medium leading-5 text-foreground">
              {localHint}
            </p>
            <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">
              {notice ??
                "Esta pista solo puede ayudarte a recordar la contraseña. Para restablecerla hace falta una pregunta de seguridad configurada."}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => onBack(email.trim())}
          className="mt-5 w-full"
          size="lg"
        >
          Volver a iniciar sesión
          <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setNotice(null);
            setError(null);
          }}
          className="mx-auto mt-3 block text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Probar con otro correo
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => onBack(email.trim())}
        className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al acceso
      </button>

      <h2 className="mt-5 text-[20px] font-semibold tracking-[-0.02em]">Recupera tu cuenta</h2>
      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
        {step === "email"
          ? "Escribe el email con el que creaste la cuenta. Te mostraremos tu pregunta de seguridad."
          : "Responde tu pregunta de seguridad y elige una contraseña nueva."}
      </p>

      {step === "email" ? (
        <form onSubmit={handleLookup} className="mt-5 space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="recovery-email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                ref={emailRef}
                id="recovery-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@universidad.edu"
                autoComplete="email"
                className="pl-9"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-2 text-[12.5px] leading-5 text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando…
              </>
            ) : (
              <>
                Buscar mi cuenta
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="mt-5 space-y-3.5">
          <div className="rounded-2xl border border-slate-300/50 bg-slate-100/55 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Pregunta de seguridad
            </p>
            <p className="mt-1.5 text-[13px] font-medium leading-5 text-foreground">{question}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recovery-answer">Tu respuesta</Label>
            <Input
              id="recovery-answer"
              required
              minLength={2}
              maxLength={72}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="La respuesta que guardaste"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recovery-password">Contraseña nueva</Label>
            <Input
              id="recovery-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recovery-confirm">Repite la contraseña</Label>
            <Input
              id="recovery-confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repite la contraseña nueva"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-2 text-[12.5px] leading-5 text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Restableciendo…
              </>
            ) : (
              <>
                Restablecer contraseña
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-[10.5px] leading-4 text-muted-foreground/80">
            Al restablecerla se cerrarán las sesiones abiertas en otros dispositivos.
          </p>
        </form>
      )}
    </div>
  );
}
