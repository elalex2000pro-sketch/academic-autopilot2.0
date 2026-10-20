import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { RealtimeProvider } from "@/components/realtime-provider";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Academic Autopilot",
  description: "Gestor academico autonomo: sincroniza y planifica tu estudio.",
};

// Se ejecuta antes de pintar para evitar el destello del tema claro.
const THEME_SCRIPT = `(function(){try{var k="academic-autopilot-theme";var s=localStorage.getItem(k);var d=s==="dark"||((!s||s==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",d?"#0b1120":"#f7f7fc");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f7f7fc" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              <AppShell>{children}</AppShell>
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
