import type { Metadata, Viewport } from "next";

import { AppChrome } from "@/components/app-chrome";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { PreferencesProvider } from "@/components/preferences-provider";
import { PwaRegister } from "@/components/pwa-register";
import { RealtimeProvider } from "@/components/realtime-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { WallpaperBackdrop } from "@/components/wallpaper-backdrop";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Academic Autopilot",
    template: "%s · Academic Autopilot",
  },
  description:
    "Gestor academico autonomo: planifica tu estudio, organiza apuntes y consulta tu biblioteca, tambien sin conexion.",
  applicationName: "Academic Autopilot",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Academic Autopilot",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icons/favicon-64.png",
  },
};

// `viewportFit: cover` activa las safe areas de iOS para que la barra inferior
// no quede bajo el indicador de inicio.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Se ejecuta antes de pintar para evitar el destello del tema claro.
const THEME_SCRIPT = `(function(){try{var k="academic-autopilot-theme";var s=localStorage.getItem(k);var d=s==="dark"||((!s||s==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",d?"#10131a":"#e4e8ec");}}catch(e){}})();`;

// Aplica animaciones y perfil de rendimiento antes del primer pintado para que
// el modo ahorro no muestre un destello de cristal pesado al cargar.
const INTERFACE_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("academic-autopilot-preferences")||"{}");var r=document.documentElement;var a=p&&p.animationLevel;var f=p&&p.performanceProfile;r.dataset.animations=a==="reduced"||a==="fluid"?a:"standard";r.dataset.performance=f==="efficiency"?"efficiency":"quality";}catch(e){}})();`;

// Captura el aviso de instalación en cuanto llega. Si se espera a que React
// hidrate, algunos navegadores pueden emitirlo antes y perder la oportunidad
// de mostrar el instalador nativo.
const INSTALL_SCRIPT = `(function(){try{window.__autopilotInstallPrompt=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__autopilotInstallPrompt=e;try{window.dispatchEvent(new Event("autopilot-install-ready"));}catch(_){}});}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#e4e8ec" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INTERFACE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-transparent">
        <WallpaperBackdrop />
        <PwaRegister />
        <ThemeProvider>
          <PreferencesProvider>
            <AuthProvider>
              <RealtimeProvider>
                <AppShell>{children}</AppShell>
                <AppChrome />
              </RealtimeProvider>
            </AuthProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
