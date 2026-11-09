"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

type ErrorFallbackProps = {
  error?: (Error & { digest?: string }) | null;
  onRetry: () => void;
  title?: string;
  description?: string;
};

/** Vista amigable compartida por el boundary y por `app/error.tsx`. */
export function ErrorFallback({
  error,
  onRetry,
  title = "Error en esta sección",
  description = "Algo ha fallado al mostrar esta parte de la app. El resto de tu espacio sigue disponible.",
}: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-auto flex min-h-[52vh] w-full max-w-xl flex-col items-center justify-center px-4 py-12 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-3xl border border-rose-300/40 bg-rose-50/70 text-rose-600 shadow-[0_22px_60px_-30px_rgba(225,29,72,0.55)] backdrop-blur-2xl dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/90">
        {title}
      </h2>
      <p className="mt-1.5 max-w-md text-[12px] leading-5 text-slate-600 dark:text-white/45">
        {description}
      </p>
      {error?.digest ? (
        <p className="mt-2 text-[9.5px] text-slate-400 dark:text-white/25">
          Referencia del error: {error.digest}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#1b1b1f] px-4 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#2a2a31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 dark:bg-white dark:text-[#1d1d1f] dark:hover:bg-white/90"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reintentar
        </button>
        <a
          href="/"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-300/45 bg-white/50 px-4 text-[11.5px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/75 dark:hover:bg-white/[0.1]"
        >
          <Home className="h-3.5 w-3.5" />
          Ir al inicio
        </a>
      </div>
    </div>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Al cambiar (por ejemplo, con la ruta), se limpia el error. */
  resetKey?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Evita el pantallazo blanco cuando una vista lanza un error de render.
 * No captura errores de eventos asíncronos: esos ya se muestran como avisos
 * dentro de cada vista.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ui] Error de render en una vista", error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}
