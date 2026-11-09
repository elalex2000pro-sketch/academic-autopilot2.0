"use client";

import { useEffect } from "react";

/**
 * Último límite de error: cubre fallos del layout raíz. Usa estilos en línea
 * porque el CSS global puede no haber llegado a cargar cuando ocurre el fallo.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] error global", error);
  }, [error]);

  const buttonStyle = {
    border: "1px solid rgba(15, 23, 42, 0.18)",
    borderRadius: 12,
    padding: "9px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: "white",
    color: "#1d1d1f",
  } as const;

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f3f3f6",
          color: "#1d1d1f",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 560, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px", letterSpacing: "-0.03em" }}>
            Academic Autopilot no pudo arrancar
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#555" }}>
            Se produjo un error inesperado al cargar la aplicación. Puedes reintentar o
            volver al inicio.
          </p>
          <pre
            style={{
              textAlign: "left",
              whiteSpace: "pre-wrap",
              background: "rgba(0, 0, 0, 0.05)",
              padding: 12,
              borderRadius: 12,
              fontSize: 11,
              lineHeight: 1.5,
              margin: "16px 0",
              overflowX: "auto",
            }}
          >
            {error.message || "Error desconocido"}
            {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          </pre>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button type="button" onClick={() => reset()} style={buttonStyle}>
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              style={buttonStyle}
            >
              Ir al inicio
            </button>
          </div>
          <p style={{ fontSize: 10, color: "#777", marginTop: 16 }}>
            Si persiste, abre la consola con F12 y copia el error rojo.
          </p>
        </main>
      </body>
    </html>
  );
}
