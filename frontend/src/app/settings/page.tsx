"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BellRing,
  BookOpen,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Link2,
  MonitorDown,
  Palette,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import { InstallAppButton } from "@/components/install-app-button";
import { usePreferences } from "@/components/preferences-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { WallpaperPicker } from "@/components/wallpaper-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import type { AssistantStatus, Integration, ReminderSettings, ScheduleBlock } from "@/lib/types";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

const PROVIDER_LABEL: Record<string, string> = {
  moodle: "Moodle",
  google_classroom: "Google Classroom",
};

const AI_PROVIDER_LABEL: Record<string, string> = {
  local: "Local (Ollama)",
  gemini: "Gemini",
  openai: "ChatGPT",
  claude: "Claude",
  openrouter: "OpenRouter",
  custom: "Otra IA",
};

function integrationDetails(integration: Integration): string {
  const meta = integration.meta ?? {};
  return [
    typeof meta.sitename === "string" ? meta.sitename : null,
    typeof meta.courses_visible === "number" ? `${meta.courses_visible} cursos` : null,
    typeof meta.assignments_visible === "number" ? `${meta.assignments_visible} tareas` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Ayuda contextual de cada proveedor de IA (etiqueta y pista de la clave).
const AI_PROVIDER_INFO: Record<string, { keyLabel: string; keyHelp: string }> = {
  local: {
    keyLabel: "",
    keyHelp: "",
  },
  gemini: {
    keyLabel: "Clave de API de Google AI Studio",
    keyHelp: "Consíguela gratis en aistudio.google.com → API keys. Se guarda cifrada.",
  },
  openai: {
    keyLabel: "Clave de API de OpenAI (ChatGPT)",
    keyHelp: "Créala en platform.openai.com → API keys. Se guarda cifrada.",
  },
  claude: {
    keyLabel: "Clave de API de Anthropic (Claude)",
    keyHelp: "Créala en console.anthropic.com → API keys. Se guarda cifrada.",
  },
  openrouter: {
    keyLabel: "Clave de API de OpenRouter",
    keyHelp:
      "Una sola clave con acceso a casi todas las IAs (GPT, Claude, Gemini, Llama...): openrouter.ai/keys.",
  },
  custom: {
    keyLabel: "Clave de API (si tu servicio la pide)",
    keyHelp: "Para cualquier API compatible con la de OpenAI (LM Studio, vLLM, tu servidor...).",
  },
};

function SettingsInner() {
  const searchParams = useSearchParams();
  const { autoStrikeOverdue, setAutoStrikeOverdue } = usePreferences();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Formulario Moodle
  const [moodleUrl, setMoodleUrl] = useState("");
  const [moodleToken, setMoodleToken] = useState("");
  const [moodleBusy, setMoodleBusy] = useState(false);
  const [moodleNotice, setMoodleNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // Formulario de disponibilidad
  const [day, setDay] = useState(0);
  const [start, setStart] = useState("16:30");
  const [end, setEnd] = useState("20:30");
  const [label, setLabel] = useState("Tarde de estudio");

  // Proveedor de IA
  const [aiProfile, setAiProfile] = useState<AssistantStatus | null>(null);
  const [aiProvider, setAiProvider] = useState<string>("local");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  // Recordatorios
  const [reminders, setReminders] = useState<ReminderSettings | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(19);
  const [telegramChat, setTelegramChat] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [reminderBusy, setReminderBusy] = useState(false);

  const loadData = useCallback(async () => {
    const [ints, sbs, prof, rem] = await Promise.all([
      api.integrations(),
      api.scheduleBlocks(),
      api.getAiProfile(),
      api.getReminders(),
    ]);
    setIntegrations(ints);
    setBlocks(sbs);
    setAiProfile(prof);
    setReminders(rem);
  }, []);

  // Sincroniza el formulario de recordatorios.
  useEffect(() => {
    if (!reminders) return;
    setReminderEnabled(reminders.enabled);
    setReminderHour(reminders.reminder_hour);
    setTelegramChat(reminders.telegram_chat_id ?? "");
  }, [reminders]);

  // Sincroniza el formulario de IA cuando carga (o cambia) el perfil.
  useEffect(() => {
    if (!aiProfile) return;
    setAiProvider(aiProfile.provider);
    setAiModel(aiProfile.model ?? "");
    setAiBaseUrl(aiProfile.provider === "custom" ? (aiProfile.base_url ?? "") : "");
  }, [aiProfile]);

  useEffect(() => {
    loadData().catch((e) => setNotice(e instanceof Error ? e.message : "Error"));
  }, [loadData]);

  // Maneja el retorno de OAuth2 de Google (?code=...).
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;
    setBusy(true);
    api
      .connectGoogle({ code, state: searchParams.get("state") ?? undefined })
      .then(() => {
        setNotice("Google Classroom conectado");
        return loadData();
      })
      .catch((e) => setNotice(e instanceof Error ? e.message : "Error al conectar Google"))
      .finally(() => {
        setBusy(false);
        // Limpia el ?code de la URL.
        window.history.replaceState({}, "", "/settings");
      });
  }, [searchParams, loadData]);

  async function connectMoodle(event: React.FormEvent) {
    event.preventDefault();
    setMoodleBusy(true);
    setMoodleNotice(null);
    setNotice(null);
    try {
      const integration = await api.connectMoodle({
        base_url: moodleUrl.trim(),
        token: moodleToken.trim(),
      });
      const details = integrationDetails(integration);
      setMoodleNotice({
        tone: "success",
        text: details ? `Moodle conectado: ${details}` : "Moodle conectado",
      });
      setMoodleUrl("");
      setMoodleToken("");
      try {
        await loadData();
      } catch (e) {
        setMoodleNotice({
          tone: "error",
          text: `Moodle conectado, pero no se pudo actualizar la lista: ${
            e instanceof Error ? e.message : "error desconocido"
          }`,
        });
      }
    } catch (e) {
      setMoodleNotice({
        tone: "error",
        text: e instanceof Error ? e.message : "Error al conectar Moodle",
      });
    } finally {
      setMoodleBusy(false);
    }
  }

  async function connectGoogle() {
    setBusy(true);
    setNotice(null);
    try {
      const { authorization_url } = await api.googleAuthorizeUrl();
      window.location.href = authorization_url;
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Error al iniciar OAuth de Google");
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    await api.disconnect(id);
    await loadData();
  }

  async function addBlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createBlock({
        day_of_week: day,
        start_time: start,
        end_time: end,
        label: label || null,
        is_active: true,
      });
      await loadData();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Error al crear bloque");
    } finally {
      setBusy(false);
    }
  }

  async function removeBlock(id: string) {
    await api.deleteBlock(id);
    await loadData();
  }

  async function saveAiProfile(event: React.FormEvent) {
    event.preventDefault();
    setAiBusy(true);
    setNotice(null);
    try {
      const updated = await api.updateAiProfile({
        provider: aiProvider,
        api_key: aiKey.trim() ? aiKey.trim() : null,
        model: aiModel.trim(),
        base_url: aiProvider === "custom" ? aiBaseUrl.trim() : "",
      });
      setAiProfile(updated);
      setAiKey("");
      setNotice(`IA Studio configurado con ${AI_PROVIDER_LABEL[updated.provider] ?? updated.provider}`);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Error al guardar la IA");
    } finally {
      setAiBusy(false);
    }
  }

  async function saveReminders(event: React.FormEvent) {
    event.preventDefault();
    setReminderBusy(true);
    setNotice(null);
    try {
      const updated = await api.updateReminders({
        enabled: reminderEnabled,
        reminder_hour: reminderHour,
        telegram_chat_id: telegramChat.trim(),
        ...(telegramToken.trim() ? { telegram_bot_token: telegramToken.trim() } : {}),
      });
      setReminders(updated);
      setTelegramToken("");
      setNotice("Recordatorios guardados. Te avisaré por Telegram a la hora indicada (UTC).");
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Error al guardar los recordatorios");
    } finally {
      setReminderBusy(false);
    }
  }

  async function testReminder() {
    setReminderBusy(true);
    setNotice(null);
    try {
      const result = await api.testReminder();
      setNotice(result.message);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Error al enviar la prueba");
    } finally {
      setReminderBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 pb-12 pt-7 sm:px-8 lg:pt-9">
      <header>
        <p className="label-caps">Configuración</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.035em] text-slate-800 dark:text-white/90">
          Ajustes
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-slate-500 dark:text-white/45">
          Conecta tus plataformas, elige cómo se ve la app y define tus preferencias de estudio.
        </p>
      </header>

      {notice && (
        <div className="rounded-2xl border border-white/60 bg-white/35 px-4 py-3 text-[13px] text-slate-700 shadow-sm backdrop-blur-2xl dark:border-white/[0.07] dark:bg-white/[0.05] dark:text-white/75">
          {notice}
        </div>
      )}

      {/* ---- Apariencia ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> Apariencia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Elige cómo quieres ver la aplicación. El cambio se guarda en este navegador.
          </p>
          <ThemeToggle className="max-w-md" />
          <p className="text-xs text-muted-foreground">
            Con «Sistema» se sigue automáticamente la preferencia de tu dispositivo.
          </p>
          <div className="border-t border-separator pt-3">
            <WallpaperPicker />
          </div>
        </CardContent>
      </Card>

      {/* ---- Preferencias de estudio ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4" /> Preferencias de estudio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/30 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="min-w-0">
              <p id="auto-strike-label" className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
                Atenuar actividades vencidas en el historial
              </p>
              <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                Las entregas vencidas ya no se acumulan en la lista activa: se mueven a
                «Historial / Vencidas». Este ajuste solo cambia su aspecto dentro de ese historial.
              </p>
            </div>
            <Switch
              checked={autoStrikeOverdue}
              onCheckedChange={setAutoStrikeOverdue}
              aria-labelledby="auto-strike-label"
            />
          </div>
        </CardContent>
      </Card>

      {/* ---- App de escritorio ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorDown className="h-4 w-4" /> App de escritorio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Descarga el instalador para Windows y ábrelo como cualquier programa. Tendrás su propia
            ventana y acceso directo, sin pasar por el navegador. La app conserva tu sesión y una copia
            local de tus datos.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <InstallAppButton label="Descargar instalador" />
            <span className="text-xs text-muted-foreground">
              Windows 10 u 11, 64 bits. Tus datos siguen en tu cuenta y se sincronizan entre
              dispositivos.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ---- Integraciones ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" /> Plataformas conectadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations.map((integration) => {
            const details = integrationDetails(integration);
            return (
              <div
                key={integration.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {PROVIDER_LABEL[integration.provider] ?? integration.provider}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {integration.base_url ?? (integration.meta?.username as string) ?? ""}
                  </p>
                  {details && (
                    <p className="truncate text-[11px] text-muted-foreground">{details}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={integration.status === "connected" ? "success" : "destructive"}>
                    {integration.status}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => disconnect(integration.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {integrations.length === 0 && (
            <p className="text-sm text-muted-foreground">Aun no hay plataformas conectadas.</p>
          )}

          {/* Moodle */}
          <form onSubmit={connectMoodle} className="space-y-3 rounded-md border border-border/60 p-3">
            <p className="text-sm font-medium">Conectar Moodle</p>
            <div className="space-y-2">
              <Label htmlFor="moodleUrl">URL de tu Moodle</Label>
              <Input
                id="moodleUrl"
                placeholder="https://moodle.universidad.edu"
                value={moodleUrl}
                onChange={(e) => setMoodleUrl(e.target.value)}
                autoComplete="url"
                inputMode="url"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moodleToken">Token de Web Services</Label>
              <Input
                id="moodleToken"
                type="password"
                placeholder="Perfil > Seguridad > Claves de acceso"
                value={moodleToken}
                onChange={(e) => setMoodleToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                El token debe permitir leer cursos y tareas. Si Moodle devuelve un error de
                permisos, revisa el servicio web asociado al token.
              </p>
            </div>
            <Button type="submit" size="sm" disabled={moodleBusy}>
              {moodleBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {moodleBusy ? "Conectando..." : "Guardar Moodle"}
            </Button>
            {moodleNotice && (
              <p
                role="status"
                aria-live="polite"
                className={`rounded-md border px-3 py-2 text-xs ${
                  moodleNotice.tone === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {moodleNotice.text}
              </p>
            )}
          </form>

          {/* Google */}
          <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Conectar Google Classroom</p>
              <p className="text-xs text-muted-foreground">Autoriza con tu cuenta de Google.</p>
            </div>
            <Button size="sm" onClick={connectGoogle} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Autorizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---- IA Studio (multi-proveedor) ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" /> Motor de IA Studio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Elige con qué IA responde IA Studio: <strong>Gemini</strong> o{" "}
            <strong>ChatGPT</strong> (gratis con límite diario en sus planes básicos),{" "}
            <strong>Claude</strong>, <strong>OpenRouter</strong> (una clave para casi todas) o
            cualquier otra API compatible. Tu clave se guarda cifrada.
          </p>

          <form onSubmit={saveAiProfile} className="space-y-3">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(["local", "gemini", "openai", "claude", "openrouter", "custom"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setAiProvider(value);
                        if (value !== aiProfile?.provider) setAiModel("");
                      }}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                        aiProvider === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {AI_PROVIDER_LABEL[value]}
                    </button>
                  ),
                )}
              </div>
            </div>

            {aiProvider !== "local" && (
              <div className="space-y-2">
                <Label htmlFor="aiKey">{AI_PROVIDER_INFO[aiProvider]?.keyLabel}</Label>
                <Input
                  id="aiKey"
                  type="password"
                  placeholder={
                    aiProfile?.has_api_key && aiProfile.provider === aiProvider
                      ? "••••••••  (guardada)"
                      : "Pega aquí tu clave"
                  }
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {AI_PROVIDER_INFO[aiProvider]?.keyHelp}
                </p>
              </div>
            )}

            {aiProvider === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="aiBaseUrl">URL base (endpoint compatible con OpenAI)</Label>
                <Input
                  id="aiBaseUrl"
                  placeholder="https://mi-servidor.com/v1"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                />
              </div>
            )}

            {aiProvider !== "local" && (
              <div className="space-y-2">
                <Label htmlFor="aiModel">Modelo (opcional)</Label>
                <Input
                  id="aiModel"
                  placeholder={
                    aiProfile?.provider === aiProvider ? aiProfile.model : "modelo por defecto"
                  }
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Déjalo vacío para usar el modelo recomendado del proveedor.
                </p>
              </div>
            )}

            {aiProvider === "local" && (
              <p className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                Ollama se instala en tu propio ordenador (gratis y sin claves). En la versión web
                alojada no está disponible: usa Gemini, ChatGPT, Claude u OpenRouter.
              </p>
            )}

            {aiProfile && (
              <div className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                Modelo activo: <span className="font-medium">{aiProfile.model}</span> · Visión:{" "}
                <span className="font-medium">{aiProfile.vision_model}</span> ·{" "}
                {aiProfile.configured ? (
                  <span className="text-primary">listo para usar</span>
                ) : (
                  <span className="text-amber-500">sin configurar</span>
                )}
              </div>
            )}

            <Button type="submit" size="sm" disabled={aiBusy}>
              {aiBusy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar motor IA
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ---- NotebookLM (Google) ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> NotebookLM (Google)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Google todavía no ofrece una API pública de NotebookLM, así que se conecta de forma
            manual y sencilla: genera tus resúmenes e infografías en <strong>IA Studio</strong> (o
            exporta tus chats desde <strong>IA Studio</strong>) y súbelos a un cuaderno de
            NotebookLM para estudiar con sus explicaciones, mapas y preguntas guiadas.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="https://notebooklm.google.com" target="_blank" rel="noreferrer">
              <Button type="button" size="sm" variant="outline">
                Abrir NotebookLM
              </Button>
            </a>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              <Button type="button" size="sm" variant="ghost">
                Conseguir clave de Gemini gratis
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ---- Canva (edicion manual de PDF) ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> Canva
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Canva no permite conectar una cuenta sin crear antes una aplicación OAuth propia, así
            que la integración es directa y sin claves: genera tu <strong>infografía</strong> o{" "}
            <strong>mapa mental</strong> en IA Studio, pulsa <strong>PDF</strong> para descargarlo y
            súbelo a Canva como diseño editable. También puedes exportar el contenido a{" "}
            <strong>Word</strong> y pegarlo en una plantilla.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Genera el diseño en IA Studio (Resumen, Infografía o Mapa mental).</li>
            <li>Descárgalo en PDF o Word.</li>
            <li>En Canva elige «Crear diseño» → «Importar» y edita colores, fuentes e imágenes.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <a href="https://www.canva.com/create/" target="_blank" rel="noreferrer">
              <Button type="button" size="sm" variant="outline">
                <ExternalLink className="h-4 w-4" /> Abrir Canva
              </Button>
            </a>
            <a href="/studio">
              <Button type="button" size="sm" variant="ghost">
                Ir a IA Studio
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ---- Word y Excel ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" /> Word y Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Puedes <strong>subir</strong> tus apuntes en Word (.docx) o Excel (.xlsx) desde{" "}
            <strong>Archivos</strong> y usarlos para resúmenes, infografías y mapas mentales. También
            puedes <strong>descargar</strong> tu información para abrirla en Word o Excel.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                api.exportTasksExcel().catch((error: unknown) => setNotice(String(error)))
              }
            >
              <FileSpreadsheet className="h-4 w-4" /> Tareas en Excel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                api.exportNotebooksExcel().catch((error: unknown) => setNotice(String(error)))
              }
            >
              <FileSpreadsheet className="h-4 w-4" /> Cuadernos en Excel
            </Button>
            <a href="/notebooks">
              <Button type="button" size="sm" variant="ghost">
                Ir a Cuadernos (Word)
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada cuaderno se descarga en Word con un clic desde la sección Cuadernos.
          </p>
        </CardContent>
      </Card>

      {/* ---- Recordatorios por Telegram ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4" /> Recordatorios por Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Recibe cada día un mensaje con las tareas que vencen y los exámenes de tus clases. Usa
            tu propio bot de Telegram: es gratis y no necesitas servidor de correo.
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Cómo conseguir los datos (2 minutos):</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>
                Abre Telegram y habla con <strong>@BotFather</strong>; envía{" "}
                <code className="rounded bg-white px-1">/newbot</code> y copia el token.
              </li>
              <li>
                Habla con tu bot nuevo y envíale cualquier mensaje (así puede responder).
              </li>
              <li>
                Abre <strong>@userinfobot</strong> y copia tu <em>chat ID</em>.
              </li>
            </ol>
          </div>
          <form onSubmit={saveReminders} className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(event) => setReminderEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Activar recordatorio diario
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reminderHour">Hora del aviso (UTC)</Label>
                <Input
                  id="reminderHour"
                  type="number"
                  min={0}
                  max={23}
                  value={reminderHour}
                  onChange={(event) => setReminderHour(Number(event.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  En España peninsular suma 1 o 2 horas (19 UTC ≈ 21:00 en verano).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telegramChat">Chat ID de Telegram</Label>
                <Input
                  id="telegramChat"
                  value={telegramChat}
                  onChange={(event) => setTelegramChat(event.target.value)}
                  placeholder="123456789"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegramToken">Token del bot</Label>
              <Input
                id="telegramToken"
                type="password"
                value={telegramToken}
                onChange={(event) => setTelegramToken(event.target.value)}
                placeholder={
                  reminders?.has_token ? "••••••••  (guardado)" : "123456:ABC-DEF..."
                }
              />
              <p className="text-xs text-muted-foreground">
                Se guarda cifrado en tu cuenta. Déjalo vacío para conservar el token actual.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={reminderBusy}>
                {reminderBusy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar recordatorios
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={testReminder}
                disabled={reminderBusy}
              >
                <Send className="h-4 w-4" /> Enviar prueba
              </Button>
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                <Button type="button" size="sm" variant="ghost">
                  <ExternalLink className="h-4 w-4" /> Abrir BotFather
                </Button>
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ---- Disponibilidad ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disponibilidad semanal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addBlock} className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <div className="space-y-2">
              <Label>Dia</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i} className="bg-background">
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Etiqueta</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>
              <Plus className="h-4 w-4" /> Anadir
            </Button>
          </form>

          <div className="space-y-2">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{DAYS[block.day_of_week]}</span>{" "}
                  <span className="text-muted-foreground">
                    {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}
                  </span>
                  {block.label && <span className="text-muted-foreground"> · {block.label}</span>}
                </span>
                <Button variant="ghost" size="icon" onClick={() => removeBlock(block.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {blocks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin disponibilidad definida. Ej: tardes de 16:30 a 20:30.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Cargando ajustes...</div>}>
      <SettingsInner />
    </Suspense>
  );
}
