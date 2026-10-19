"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Cpu, Loader2, Link2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { AssistantStatus, Integration, ScheduleBlock } from "@/lib/types";

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

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Formulario Moodle
  const [moodleUrl, setMoodleUrl] = useState("");
  const [moodleToken, setMoodleToken] = useState("");

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

  const loadData = useCallback(async () => {
    const [ints, sbs, prof] = await Promise.all([
      api.integrations(),
      api.scheduleBlocks(),
      api.getAiProfile(),
    ]);
    setIntegrations(ints);
    setBlocks(sbs);
    setAiProfile(prof);
  }, []);

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
    setBusy(true);
    setNotice(null);
    try {
      await api.connectMoodle({ base_url: moodleUrl, token: moodleToken });
      setNotice("Moodle conectado");
      setMoodleUrl("");
      setMoodleToken("");
      await loadData();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Error al conectar Moodle");
    } finally {
      setBusy(false);
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
      setNotice(`Asistente configurado con ${AI_PROVIDER_LABEL[updated.provider] ?? updated.provider}`);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Error al guardar la IA");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Conecta tus plataformas y define tu disponibilidad semanal.
        </p>
      </header>

      {notice && (
        <div className="rounded-md border border-border bg-secondary/40 px-4 py-2 text-sm">
          {notice}
        </div>
      )}

      {/* ---- Integraciones ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" /> Plataformas conectadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
            >
              <div>
                <p className="text-sm">{PROVIDER_LABEL[integration.provider] ?? integration.provider}</p>
                <p className="text-xs text-muted-foreground">
                  {integration.base_url ?? (integration.meta?.username as string) ?? ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={integration.status === "connected" ? "success" : "destructive"}>
                  {integration.status}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => disconnect(integration.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moodleToken">Token de Web Services</Label>
              <Input
                id="moodleToken"
                placeholder="Perfil > Seguridad > Claves de acceso"
                value={moodleToken}
                onChange={(e) => setMoodleToken(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              Guardar Moodle
            </Button>
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

      {/* ---- Asistente IA (multi-proveedor) ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" /> Motor del asistente IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Elige con qué IA responde tu asistente: <strong>Gemini</strong> o{" "}
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
            exporta tus chats desde el <strong>Asistente</strong>) y súbelos a un cuaderno de
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
