import type { Metadata, Viewport } from "next";

import { AppChrome } from "@/components/app-chrome";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { BootSplash } from "@/components/boot-splash";
import { PreferencesProvider } from "@/components/preferences-provider";
import { PwaRegister } from "@/components/pwa-register";
import { RealtimeProvider } from "@/components/realtime-provider";
import { SmoothScroll } from "@/components/smooth-scroll";
import { ThemeProvider } from "@/components/theme-provider";
import { WallpaperBackdrop } from "@/components/wallpaper-backdrop";

import "./globals.css";
import "./v18-theme.css";

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
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
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
const THEME_SCRIPT = `(function(){try{var k="academic-autopilot-theme-v18";var s=localStorage.getItem(k);var d=s==="dark"?true:s==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:false;var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",d?"#0a0a0a":"#f3f3f6");}}catch(e){}})();`;

// Aplica animaciones, perfil de rendimiento y estilo de cristal antes del
// primer pintado para evitar destellos al cargar.
const INTERFACE_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("academic-autopilot-preferences")||"{}");var r=document.documentElement;var a=p&&p.animationLevel;var f=p&&p.performanceProfile;var g=p&&p.glassStyle;r.dataset.animations=a==="reduced"?"reduced":a==="ultra"||a==="fluid"?"ultra":"standard";r.dataset.performance=f==="efficiency"?"efficiency":"quality";r.dataset.glass=g==="pure"?"pure":"standard";}catch(e){}})();`;

// Captura el aviso de instalación en cuanto llega. Si se espera a que React
// hidrate, algunos navegadores pueden emitirlo antes y perder la oportunidad
// de mostrar el instalador nativo.
const INSTALL_SCRIPT = `(function(){try{window.__autopilotInstallPrompt=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__autopilotInstallPrompt=e;try{window.dispatchEvent(new Event("autopilot-install-ready"));}catch(_){}});}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f3f3f6" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INTERFACE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-transparent">
        <BootSplash />
        <WallpaperBackdrop />
        <PwaRegister />
        <ThemeProvider>
          <PreferencesProvider>
            <SmoothScroll />
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
