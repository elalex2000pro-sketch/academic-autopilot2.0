import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { RealtimeProvider } from "@/components/realtime-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Academic Autopilot",
  description: "Gestor academico autonomo: sincroniza y planifica tu estudio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <RealtimeProvider>
            <AppShell>{children}</AppShell>
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
