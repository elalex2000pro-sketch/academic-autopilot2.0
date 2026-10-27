"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AppWindow,
  BellRing,
  CalendarRange,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  ExternalLink,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  NotebookText,
  Palette,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { InstallAppButton } from "@/components/install-app-button";
import { usePreferences } from "@/components/preferences-provider";
import { PerformanceSettings } from "@/components/settings/performance-settings";
import {
  CompactIntegrationCard,
  SETTINGS_TABS,
  SettingRow,
  SettingsCard,
  SettingsGroup,
  SettingsTabs,
  type SettingsTabId,
} from "@/components/settings/settings-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdateCheckButton } from "@/components/update-check-button";
import { WallpaperPicker } from "@/components/wallpaper-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import { resetCustomTimetable } from "@/lib/custom-timetable";
import { saveRecoveryHint } from "@/lib/recovery-hint";
import { cn } from "@/lib/utils";
import type {
  AssistantStatus,
  Integration,
  ReminderSettings,
  ScheduleBlock,
  SyncLog,
} from "@/lib/types";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

const PROVIDER_LABEL: Record<string, string> = {
  moodle: "Moodle",
  google_classroom: "Google Classroom",
};

const SYNC_STATUS_LABEL: Record<SyncLog["status"], string> = {
  success: "Correcta",
  partial: "Parcial",
  error: "Error",
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

function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    "es-ES",
    withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
  ).format(date);
}

function syncBadgeVariant(status: SyncLog["status"]): "success" | "warning" | "destructive" {
  if (status === "success") return "success";
  if (status === "partial") return "warning";
  return "destructive";
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
  const { user, logout, refreshUser } = useAuth();
  const {
    autoStrikeOverdue,
    setAutoStrikeOverdue,
    useCustomTitlebar,
    setUseCustomTitlebar,
    resetPreferences,
  } = usePreferences();

  const [tab, setTab] = useState<SettingsTabId>("general");
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [resettingTimetable, setResettingTimetable] = useState(false);

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

  // Sincronización y cuenta
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Recuperación de contraseña (pregunta de seguridad)
  const [recoveryQuestion, setRecoveryQuestion] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

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

  const refreshSync = useCallback(async () => {
    try {
      const logs = await api.syncStatus();
      setSyncLogs(logs);
      setSyncError(null);
    } catch (e) {
      setSyncError(
        e instanceof Error ? e.message : "No se pudo leer el estado de sincronización.",
      );
    }
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

  // Mantiene el formulario sincronizado con la pregunta guardada en el perfil.
  useEffect(() => {
    setRecoveryQuestion(user?.recovery_question ?? "");
  }, [user?.recovery_question]);

  useEffect(() => {
    loadData().catch((e) => setNotice(e instanceof Error ? e.message : "Error"));
  }, [loadData]);

  useEffect(() => {
    if (tab !== "account") return;
    void refreshSync();
  }, [tab, refreshSync]);

  // Respeta un enlace directo a una pestaña: /settings?tab=performance.
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (!requested) return;
    if (SETTINGS_TABS.some((definition) => definition.id === requested)) {
      setTab(requested as SettingsTabId);
    }
  }, [searchParams]);

  // Maneja el retorno de OAuth2 de Google (?code=...).
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;
    setTab("integrations");
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
        // Limpia el ?code de la URL y deja al usuario en Integraciones.
        window.history.replaceState({}, "", "/settings?tab=integrations");
      });
  }, [searchParams, loadData]);

  const selectTab = useCallback((next: SettingsTabId) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.scrollTo({ top: 0 });
  }, []);

  const togglePanel = useCallback((id: string) => {
    setOpenPanel((current) => (current === id ? null : id));
  }, []);

  const moodle = integrations.find((integration) => integration.provider === "moodle");
  const google = integrations.find((integration) => integration.provider === "google_classroom");
  const accountName = user?.full_name?.trim() || user?.email?.split("@")[0] || "Tu cuenta";
  const initials = useMemo(() => accountName.slice(0, 2).toUpperCase(), [accountName]);

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
      setNotice(
        `IA Studio configurado con ${AI_PROVIDER_LABEL[updated.provider] ?? updated.provider}`,
      );
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

  async function resetTimetable() {
    if (resettingTimetable) return;

    const confirmed = window.confirm(
      "¿Restablecer el Horario Oficial de 1.º SMR? Se perderán los cambios guardados en este dispositivo.",
    );
    if (!confirmed) return;

    setResettingTimetable(true);
    setNotice(null);
    try {
      // Si la API no responde, el horario oficial se guarda igualmente con los
      // nombres de las asignaturas; el planificador rellenará los course_id
      // cuando vuelva a tener la lista de cursos.
      const courseList = await api.courses().catch(() => []);
      const restored = resetCustomTimetable(courseList);
      setNotice(
        `Horario oficial restaurado: ${restored.length} franjas de 1.º SMR. Abre el Planificador para verlo.`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo restablecer el horario.");
    } finally {
      setResettingTimetable(false);
    }
  }

  async function runSync() {
    setSyncBusy(true);
    setNotice(null);
    try {
      const results = await api.triggerSync("all");
      const created = results.reduce((total, result) => total + result.created, 0);
      const updated = results.reduce((total, result) => total + result.updated, 0);
      setNotice(`Sincronización completada: ${created} nuevos, ${updated} actualizados.`);
      await Promise.allSettled([loadData(), refreshSync()]);
    } catch (e) {
      setNotice(
        e instanceof ApiError
          ? e.message
          : "No se pudo sincronizar. Revisa que tus plataformas sigan conectadas.",
      );
    } finally {
      setSyncBusy(false);
    }
  }

  function restorePreferences() {
    const confirmed = window.confirm(
      "¿Restablecer animaciones, rendimiento y preferencias de la app?",
    );
    if (!confirmed) return;
    resetPreferences();
    setNotice("Preferencias restablecidas a los valores recomendados.");
  }

  function handleLogout() {
    const confirmed = window.confirm("¿Cerrar sesión en este dispositivo?");
    if (!confirmed) return;
    logout();
  }

  async function saveRecovery(event: React.FormEvent) {
    event.preventDefault();
    const question = recoveryQuestion.trim();
    const answer = recoveryAnswer.trim();

    if (question.length < 4) {
      setRecoveryNotice({
        tone: "error",
        text: "La pregunta debe tener al menos 4 caracteres.",
      });
      return;
    }
    if (answer.length < 2) {
      setRecoveryNotice({
        tone: "error",
        text: "Escribe una respuesta de al menos 2 caracteres.",
      });
      return;
    }

    setRecoveryBusy(true);
    setRecoveryNotice(null);
    try {
      await api.setRecovery({ question, answer });
      await refreshUser();
      if (user?.email) saveRecoveryHint(user.email, question);
      setRecoveryAnswer("");
      setRecoveryNotice({
        tone: "success",
        text: "Pregunta de seguridad guardada. Ya puedes usarla desde el login.",
      });
    } catch (error) {
      setRecoveryNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la pregunta.",
      });
    } finally {
      setRecoveryBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 pb-12 pt-7 sm:px-8 lg:pt-9">
      <header>
        <p className="label-caps">Configuración</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.035em] text-slate-800 dark:text-white/90">
          Ajustes
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-slate-500 dark:text-white/45">
          Apariencia, rendimiento, integraciones y cuenta en un solo lugar.
        </p>
      </header>

      <SettingsTabs active={tab} onChange={selectTab} />

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-2xl border border-slate-300/40 bg-slate-100/60 px-4 py-3 text-[12.5px] leading-5 text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur-2xl dark:border-white/[0.07] dark:bg-white/[0.05] dark:text-white/75"
        >
          <span className="min-w-0 flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            className="mt-0.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/[0.07] dark:hover:text-white/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        key={tab}
        id={`settings-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${tab}`}
        tabIndex={0}
        className="animate-fade-up space-y-5 focus:outline-none"
      >
        {tab === "general" && (
          <div className="space-y-5">
            <SettingsCard
              icon={Palette}
              title="Apariencia"
              description="Tema, fondo y transparencia del cristal."
            >
              <div className="space-y-4">
                <ThemeToggle className="max-w-md" />
                <p className="text-[11px] leading-4 text-slate-500 dark:text-white/35">
                  Con «Sistema» se sigue automáticamente la preferencia de tu dispositivo.
                </p>
                <div className="border-t border-slate-300/40 pt-4 dark:border-white/[0.06]">
                  <WallpaperPicker />
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              icon={AppWindow}
              title="Ventana y escritorio"
              description="Marco transparente, instalador y actualizaciones."
            >
              <div className="space-y-4">
                <SettingRow
                  title="Modo Marco Transparente (Estilo macOS / Sin barra de Windows)"
                  titleId="custom-titlebar-label"
                  description={
                    <>
                      Oculta la barra de título nativa y activa los controles de ventana de cristal.
                      En la app de escritorio, la ventana se reinicia para aplicar el cambio; en el
                      navegador los semáforos son decorativos.
                    </>
                  }
                >
                  <Switch
                    checked={useCustomTitlebar}
                    onCheckedChange={setUseCustomTitlebar}
                    aria-labelledby="custom-titlebar-label"
                  />
                </SettingRow>

                <div className="flex flex-col gap-3 border-t border-slate-300/40 pt-4 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <InstallAppButton label="Descargar instalador" />
                    <span className="max-w-sm text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                      Windows 10 u 11, 64 bits. La app conserva tu sesión y una copia local de tus
                      datos.
                    </span>
                  </div>
                  <UpdateCheckButton />
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              icon={CheckCircle2}
              title="Preferencias de estudio"
              description="Cómo se muestran tus tareas y entregas."
            >
              <SettingRow
                title="Atenuar actividades vencidas en el historial"
                titleId="auto-strike-label"
                description="Las entregas vencidas se mueven a «Historial / Vencidas». Este ajuste solo cambia su aspecto dentro de ese historial."
              >
                <Switch
                  checked={autoStrikeOverdue}
                  onCheckedChange={setAutoStrikeOverdue}
                  aria-labelledby="auto-strike-label"
                />
              </SettingRow>
            </SettingsCard>
          </div>
        )}

        {tab === "performance" && <PerformanceSettings />}

        {tab === "integrations" && (
          <div className="space-y-5">
            <SettingsGroup
              icon={GraduationCap}
              title="Plataformas académicas"
              description="Sincroniza cursos, tareas y calificaciones."
            >
              <div className="grid items-start gap-3 md:grid-cols-2">
                <CompactIntegrationCard
                  id="moodle"
                  name="Moodle"
                  description={
                    moodle?.status === "connected"
                      ? integrationDetails(moodle) || "Plataforma conectada"
                      : "Cursos, tareas y calificaciones"
                  }
                  icon={GraduationCap}
                  status={moodle?.status === "connected" ? "connected" : "disconnected"}
                  expanded={openPanel === "moodle"}
                  onToggle={() => togglePanel("moodle")}
                >
                  {moodle?.status === "connected" ? (
                    <div className="space-y-2.5">
                      {moodle.base_url && (
                        <p className="truncate text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                          {moodle.base_url}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[11px]"
                        onClick={() => void disconnect(moodle.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={connectMoodle} className="space-y-2.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="moodleUrl" className="text-[10.5px]">
                          URL de tu Moodle
                        </Label>
                        <Input
                          id="moodleUrl"
                          placeholder="https://moodle.universidad.edu"
                          value={moodleUrl}
                          onChange={(event) => setMoodleUrl(event.target.value)}
                          autoComplete="url"
                          inputMode="url"
                          required
                          className="h-8 text-[12px]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="moodleToken" className="text-[10.5px]">
                          Token de Web Services
                        </Label>
                        <Input
                          id="moodleToken"
                          type="password"
                          placeholder="Perfil > Seguridad > Claves de acceso"
                          value={moodleToken}
                          onChange={(event) => setMoodleToken(event.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          required
                          className="h-8 text-[12px]"
                        />
                      </div>
                      <p className="text-[10px] leading-4 text-slate-500 dark:text-white/35">
                        El token debe permitir leer cursos y tareas. Si Moodle devuelve un error de
                        permisos, revisa el servicio web asociado.
                      </p>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={moodleBusy}
                        className="h-7 px-2.5 text-[11px]"
                      >
                        {moodleBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {moodleBusy ? "Conectando..." : "Guardar Moodle"}
                      </Button>
                    </form>
                  )}
                  {moodleNotice && (
                    <p
                      role="status"
                      aria-live="polite"
                      className={cn(
                        "mt-2 rounded-lg border px-2.5 py-1.5 text-[10.5px] leading-4",
                        moodleNotice.tone === "success"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-destructive/30 bg-destructive/10 text-destructive",
                      )}
                    >
                      {moodleNotice.text}
                    </p>
                  )}
                </CompactIntegrationCard>

                <CompactIntegrationCard
                  id="google"
                  name="Google Classroom"
                  description={
                    google?.status === "connected"
                      ? "Cuenta de Google conectada"
                      : "Cursos y tareas de Classroom"
                  }
                  icon={LayoutDashboard}
                  status={google?.status === "connected" ? "connected" : "disconnected"}
                  expanded={openPanel === "google"}
                  onToggle={() => togglePanel("google")}
                >
                  {google?.status === "connected" ? (
                    <div className="space-y-2.5">
                      <p className="truncate text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                        {(google.meta?.username as string | undefined) ??
                          (google.meta?.email as string | undefined) ??
                          "Autorizado con OAuth"}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[11px]"
                        onClick={() => void disconnect(google.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                        Autoriza con tu cuenta para importar cursos y tareas.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void connectGoogle()}
                        disabled={busy}
                        className="h-7 px-2.5 text-[11px]"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        Autorizar con Google
                      </Button>
                    </div>
                  )}
                </CompactIntegrationCard>
              </div>
            </SettingsGroup>

            <SettingsGroup
              icon={ExternalLink}
              title="Herramientas externas"
              description="Accesos directos y exportaciones, sin cuentas adicionales."
            >
              <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                <CompactIntegrationCard
                  id="notebooklm"
                  name="NotebookLM"
                  description="Resúmenes, mapas y preguntas guiadas"
                  icon={NotebookText}
                  status="manual"
                  expanded={openPanel === "notebooklm"}
                  onToggle={() => togglePanel("notebooklm")}
                >
                  <p className="text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                    Google todavía no ofrece una API pública. Genera tus resúmenes o infografías en
                    IA Studio y súbelos a un cuaderno para estudiar con sus explicaciones y mapas.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px]"
                    >
                      <a href="https://notebooklm.google.com" target="_blank" rel="noreferrer">
                        Abrir NotebookLM
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2.5 text-[11px]">
                      <a href="/studio">Ir a IA Studio</a>
                    </Button>
                  </div>
                </CompactIntegrationCard>

                <CompactIntegrationCard
                  id="canva"
                  name="Canva"
                  description="Infografías y diseños editables"
                  icon={PenTool}
                  status="manual"
                  expanded={openPanel === "canva"}
                  onToggle={() => togglePanel("canva")}
                >
                  <ol className="list-decimal space-y-1 pl-4 text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                    <li>Genera el diseño en IA Studio (Resumen, Infografía o Mapa mental).</li>
                    <li>Descárgalo en PDF o Word.</li>
                    <li>En Canva elige «Crear diseño» → «Importar» y edita colores y fuentes.</li>
                  </ol>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px]"
                    >
                      <a href="https://www.canva.com/create/" target="_blank" rel="noreferrer">
                        Abrir Canva
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2.5 text-[11px]">
                      <a href="/studio">Ir a IA Studio</a>
                    </Button>
                  </div>
                </CompactIntegrationCard>

                <CompactIntegrationCard
                  id="office"
                  name="Word y Excel"
                  description="Sube .docx/.xlsx y exporta tus datos"
                  icon={FileSpreadsheet}
                  status="manual"
                  expanded={openPanel === "office"}
                  onToggle={() => togglePanel("office")}
                >
                  <p className="text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                    Sube tus apuntes desde Archivos o descarga tu información para abrirla en Word o
                    Excel. Cada cuaderno también se descarga en Word desde Cuadernos.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() =>
                        void api
                          .exportTasksExcel()
                          .catch((error: unknown) => setNotice(String(error)))
                      }
                    >
                      Tareas en Excel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() =>
                        void api
                          .exportNotebooksExcel()
                          .catch((error: unknown) => setNotice(String(error)))
                      }
                    >
                      Cuadernos en Excel
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2.5 text-[11px]">
                      <a href="/notebooks">Ir a Cuadernos</a>
                    </Button>
                  </div>
                </CompactIntegrationCard>
              </div>
            </SettingsGroup>

            <SettingsCard
              icon={Cpu}
              title="Motor de IA Studio"
              description="Elige con qué IA responde el chat, la visión y las herramientas."
              action={
                <Badge variant={aiProfile?.configured ? "success" : "outline"}>
                  {aiProfile?.configured ? "Configurado" : "Sin configurar"}
                </Badge>
              }
            >
              <p className="text-[11.5px] leading-4 text-slate-500 dark:text-white/40">
                Gemini, ChatGPT, Claude, OpenRouter o cualquier API compatible. Tu clave se guarda
                cifrada y solo se usa para las peticiones de IA Studio.
              </p>

              <form onSubmit={saveAiProfile} className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[10.5px]">Proveedor</Label>
                  <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                    {(["local", "gemini", "openai", "claude", "openrouter", "custom"] as const).map(
                      (value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setAiProvider(value);
                            if (value !== aiProfile?.provider) setAiModel("");
                          }}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                            aiProvider === value
                              ? "border-[#0066FF]/35 bg-[#0066FF]/10 text-[#0066FF] dark:border-[#8ab9ff]/25 dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]"
                              : "border-slate-300/45 bg-slate-100/50 text-slate-500 hover:bg-slate-200/45 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/45 dark:hover:bg-white/[0.05]",
                          )}
                        >
                          {AI_PROVIDER_LABEL[value]}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {aiProvider !== "local" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="aiKey" className="text-[10.5px]">
                      {AI_PROVIDER_INFO[aiProvider]?.keyLabel}
                    </Label>
                    <Input
                      id="aiKey"
                      type="password"
                      placeholder={
                        aiProfile?.has_api_key && aiProfile.provider === aiProvider
                          ? "••••••••  (guardada)"
                          : "Pega aquí tu clave"
                      }
                      value={aiKey}
                      onChange={(event) => setAiKey(event.target.value)}
                      className="h-8 text-[12px]"
                    />
                    <p className="text-[10px] leading-4 text-slate-500 dark:text-white/35">
                      {AI_PROVIDER_INFO[aiProvider]?.keyHelp}
                    </p>
                  </div>
                )}

                {aiProvider === "custom" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="aiBaseUrl" className="text-[10.5px]">
                      URL base (endpoint compatible con OpenAI)
                    </Label>
                    <Input
                      id="aiBaseUrl"
                      placeholder="https://mi-servidor.com/v1"
                      value={aiBaseUrl}
                      onChange={(event) => setAiBaseUrl(event.target.value)}
                      className="h-8 text-[12px]"
                    />
                  </div>
                )}

                {aiProvider !== "local" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="aiModel" className="text-[10.5px]">
                      Modelo (opcional)
                    </Label>
                    <Input
                      id="aiModel"
                      placeholder={
                        aiProfile?.provider === aiProvider
                          ? aiProfile.model
                          : "modelo por defecto"
                      }
                      value={aiModel}
                      onChange={(event) => setAiModel(event.target.value)}
                      className="h-8 text-[12px]"
                    />
                    <p className="text-[10px] leading-4 text-slate-500 dark:text-white/35">
                      Déjalo vacío para usar el modelo recomendado. Para fotos y PDFs escaneados usa
                      un modelo con visión (Gemini 2.5 Flash, GPT-4o, Claude…).
                    </p>
                  </div>
                )}

                {aiProvider === "local" && (
                  <p className="rounded-lg border border-slate-300/45 bg-slate-100/50 px-2.5 py-1.5 text-[10.5px] leading-4 text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/35">
                    Ollama se instala en tu propio ordenador (gratis y sin claves). En la versión web
                    alojada no está disponible: usa Gemini, ChatGPT, Claude u OpenRouter.
                  </p>
                )}

                {aiProfile && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300/45 bg-slate-100/50 px-2.5 py-1.5 text-[10.5px] leading-4 text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/35">
                    <span>
                      Modelo: <strong className="text-slate-700 dark:text-white/70">{aiProfile.model}</strong>
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      Visión:{" "}
                      <strong className="text-slate-700 dark:text-white/70">{aiProfile.vision_model}</strong>
                    </span>
                    <Badge variant={aiProfile.configured ? "success" : "warning"}>
                      {aiProfile.configured ? "Listo" : "Sin configurar"}
                    </Badge>
                  </div>
                )}

                <Button type="submit" size="sm" disabled={aiBusy} className="h-8 px-3 text-[11.5px]">
                  {aiBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Guardar motor IA
                </Button>
              </form>
            </SettingsCard>

            <SettingsCard
              icon={BellRing}
              title="Recordatorios por Telegram"
              description="Un aviso diario con las tareas que vencen y los exámenes."
              action={
                <Badge variant={reminders?.enabled ? "success" : "outline"}>
                  {reminders?.enabled ? "Activo" : "Inactivo"}
                </Badge>
              }
            >
              <details className="group rounded-xl border border-slate-300/45 bg-slate-200/40 p-3 text-[10.5px] leading-4 text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/35">
                <summary className="cursor-pointer list-none font-semibold text-slate-700 marker:hidden [&::-webkit-details-marker]:hidden dark:text-white/65">
                  Cómo conseguir los datos (2 minutos)
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  <li>
                    Abre Telegram y habla con <strong>@BotFather</strong>; envía{" "}
                    <code className="rounded bg-slate-200/70 px-1 dark:bg-white/10">/newbot</code> y
                    copia el token.
                  </li>
                  <li>Habla con tu bot nuevo y envíale cualquier mensaje.</li>
                  <li>
                    Abre <strong>@userinfobot</strong> y copia tu <em>chat ID</em>.
                  </li>
                </ol>
              </details>

              <form onSubmit={saveReminders} className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-white/70">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(event) => setReminderEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0066FF]"
                  />
                  Activar recordatorio diario
                </label>

                <div className="grid gap-2.5 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="reminderHour" className="text-[10.5px]">
                      Hora del aviso (UTC)
                    </Label>
                    <Input
                      id="reminderHour"
                      type="number"
                      min={0}
                      max={23}
                      value={reminderHour}
                      onChange={(event) => setReminderHour(Number(event.target.value))}
                      className="h-8 text-[12px]"
                    />
                    <p className="text-[10px] leading-4 text-slate-500 dark:text-white/35">
                      En España peninsular suma 1 o 2 horas (19 UTC ≈ 21:00 en verano).
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telegramChat" className="text-[10.5px]">
                      Chat ID de Telegram
                    </Label>
                    <Input
                      id="telegramChat"
                      value={telegramChat}
                      onChange={(event) => setTelegramChat(event.target.value)}
                      placeholder="123456789"
                      className="h-8 text-[12px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="telegramToken" className="text-[10.5px]">
                    Token del bot
                  </Label>
                  <Input
                    id="telegramToken"
                    type="password"
                    value={telegramToken}
                    onChange={(event) => setTelegramToken(event.target.value)}
                    placeholder={
                      reminders?.has_token ? "••••••••  (guardado)" : "123456:ABC-DEF..."
                    }
                    className="h-8 text-[12px]"
                  />
                  <p className="text-[10px] leading-4 text-slate-500 dark:text-white/35">
                    Se guarda cifrado en tu cuenta. Déjalo vacío para conservar el token actual.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={reminderBusy}
                    className="h-8 px-3 text-[11.5px]"
                  >
                    {reminderBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Guardar recordatorios
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void testReminder()}
                    disabled={reminderBusy}
                    className="h-8 px-3 text-[11.5px]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar prueba
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="h-8 px-3 text-[11.5px]">
                    <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir BotFather
                    </a>
                  </Button>
                </div>
              </form>
            </SettingsCard>

            <SettingsCard
              icon={CalendarRange}
              title="Disponibilidad semanal"
              description="Bloques de tiempo que el planificador puede usar."
            >
              <form onSubmit={addBlock} className="grid gap-2.5 md:grid-cols-5 sm:items-end">
                <div className="space-y-1.5">
                  <Label className="text-[10.5px]">Día</Label>
                  <select
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-[12px]"
                    value={day}
                    onChange={(event) => setDay(Number(event.target.value))}
                  >
                    {DAYS.map((dayName, index) => (
                      <option key={dayName} value={index} className="bg-background">
                        {dayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10.5px]">Desde</Label>
                  <Input
                    type="time"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                    className="h-8 text-[12px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10.5px]">Hasta</Label>
                  <Input
                    type="time"
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                    className="h-8 text-[12px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10.5px]">Etiqueta</Label>
                  <Input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    className="h-8 text-[12px]"
                  />
                </div>
                <Button type="submit" size="sm" disabled={busy} className="h-8 text-[11.5px]">
                  <Plus className="h-3.5 w-3.5" />
                  Añadir
                </Button>
              </form>

              <div className="mt-3 space-y-1.5">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-300/45 bg-slate-100/50 px-3 py-1.5 text-[11.5px] dark:border-white/[0.06] dark:bg-white/[0.025]"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-slate-700 dark:text-white/70">
                        {DAYS[block.day_of_week]}
                      </span>{" "}
                      <span className="text-slate-500 dark:text-white/35">
                        {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}
                      </span>
                      {block.label && (
                        <span className="text-slate-500 dark:text-white/35"> · {block.label}</span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 rounded-md"
                      onClick={() => void removeBlock(block.id)}
                      aria-label={`Quitar ${DAYS[block.day_of_week]} ${block.start_time}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {blocks.length === 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-white/35">
                    Sin disponibilidad definida. Ej: tardes de 16:30 a 20:30.
                  </p>
                )}
              </div>
            </SettingsCard>
          </div>
        )}

        {tab === "account" && (
          <div className="space-y-5">
            <SettingsCard
              icon={UserRound}
              title="Tu cuenta"
              description="Sesión, perfil y zona horaria."
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#6aa6ff] text-[15px] font-semibold text-white shadow-lg shadow-[#0066FF]/25">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-slate-800 dark:text-white/85">
                    {accountName}
                  </p>
                  <p className="truncate text-[11.5px] text-slate-500 dark:text-white/40">
                    {user?.email ?? "Sin sesión iniciada"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesión
                </Button>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-slate-300/45 bg-slate-100/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.025]">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-white/25">
                    Zona horaria
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-slate-700 dark:text-white/70">
                    {user?.timezone ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-300/45 bg-slate-100/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.025]">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-white/25">
                    Cuenta creada
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-slate-700 dark:text-white/70">
                    {formatDate(user?.created_at)}
                  </p>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              icon={KeyRound}
              title="Recuperación de contraseña"
              description="Pregunta de seguridad para volver a entrar si olvidas la contraseña."
            >
              <form onSubmit={(event) => void saveRecovery(event)} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={user?.has_recovery ? "success" : "warning"}>
                    {user?.has_recovery ? "Configurada" : "Sin configurar"}
                  </Badge>
                  <p className="text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                    Se usa en «¿Has olvidado tu contraseña?» de la pantalla de acceso.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="accountRecoveryQuestion">Pregunta</Label>
                    <Input
                      id="accountRecoveryQuestion"
                      value={recoveryQuestion}
                      onChange={(event) => setRecoveryQuestion(event.target.value)}
                      placeholder="¿Cómo se llamaba tu primera mascota?"
                      maxLength={200}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="accountRecoveryAnswer">Respuesta nueva</Label>
                    <Input
                      id="accountRecoveryAnswer"
                      value={recoveryAnswer}
                      onChange={(event) => setRecoveryAnswer(event.target.value)}
                      placeholder="Escribe la respuesta para guardarla"
                      maxLength={72}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <p className="text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
                  La respuesta se guarda cifrada y nunca se muestra. Si cambias la pregunta,
                  escribe también una respuesta nueva.
                </p>

                {recoveryNotice && (
                  <p
                    role={recoveryNotice.tone === "error" ? "alert" : "status"}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-[11px] leading-4",
                      recoveryNotice.tone === "success"
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-rose-300/50 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:text-rose-200",
                    )}
                  >
                    {recoveryNotice.text}
                  </p>
                )}

                <Button type="submit" size="sm" disabled={recoveryBusy}>
                  {recoveryBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  Guardar pregunta
                </Button>
              </form>
            </SettingsCard>

            <SettingsCard
              icon={Cloud}
              title="Sincronización"
              description="Últimos movimientos de Moodle y Google Classroom."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void runSync()}
                  disabled={syncBusy}
                  className="h-7 px-2.5 text-[11px]"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", syncBusy && "animate-spin")} />
                  Sincronizar ahora
                </Button>
              }
            >
              {syncError ? (
                <p className="rounded-lg border border-slate-300/45 bg-slate-100/50 px-3 py-2 text-[11px] leading-4 text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/35">
                  El historial no está disponible ahora mismo. Puedes intentar sincronizar igualmente.
                </p>
              ) : syncLogs.length > 0 ? (
                <div className="space-y-1.5">
                  {syncLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300/45 bg-slate-100/50 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.025]"
                    >
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-medium text-slate-700 dark:text-white/70">
                          {PROVIDER_LABEL[log.provider] ?? log.provider}
                        </p>
                        <p className="text-[10px] leading-4 text-slate-500 dark:text-white/35">
                          {formatDate(log.started_at, true)} · {log.created} nuevos · {log.updated}{" "}
                          actualizados
                        </p>
                      </div>
                      <Badge variant={syncBadgeVariant(log.status)}>
                        {SYNC_STATUS_LABEL[log.status] ?? log.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11.5px] leading-5 text-slate-500 dark:text-white/40">
                  Aún no hay sincronizaciones registradas. Conecta una plataforma y pulsa
                  «Sincronizar ahora».
                </p>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-[10px] leading-4 text-slate-500 dark:text-white/30">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                Tus credenciales se guardan cifradas en la cuenta.
              </p>
            </SettingsCard>

            <SettingsCard
              icon={Database}
              title="Datos y respaldo"
              description="Horario local, exportaciones y preferencias de este dispositivo."
            >
              <div className="space-y-3">
                <SettingRow
                  title="Horario oficial de 1.º SMR"
                  description="Restaura las 7 asignaturas y las 30 franjas oficiales de lunes a viernes. Se descartan los cambios guardados en este dispositivo."
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void resetTimetable()}
                    disabled={resettingTimetable}
                    className="h-auto whitespace-normal py-2 text-left"
                  >
                    {resettingTimetable ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Restablecer horario
                  </Button>
                </SettingRow>

                <SettingRow
                  title="Exportar tu información"
                  description="Descarga tus tareas o cuadernos en Excel para abrirlos en Word o Excel."
                >
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() =>
                        void api
                          .exportTasksExcel()
                          .catch((error: unknown) => setNotice(String(error)))
                      }
                    >
                      Tareas
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() =>
                        void api
                          .exportNotebooksExcel()
                          .catch((error: unknown) => setNotice(String(error)))
                      }
                    >
                      Cuadernos
                    </Button>
                  </div>
                </SettingRow>

                <SettingRow
                  title="Preferencias de la app"
                  description="Animaciones, perfil de rendimiento, atenuado del historial y marco de ventana."
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={restorePreferences}
                    className="h-7 px-2.5 text-[11px]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restablecer
                  </Button>
                </SettingRow>
              </div>
            </SettingsCard>
          </div>
        )}
      </div>

      {SETTINGS_TABS.filter((definition) => definition.id !== tab).map((definition) => (
        <div
          key={definition.id}
          id={`settings-panel-${definition.id}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${definition.id}`}
          hidden
        />
      ))}
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
