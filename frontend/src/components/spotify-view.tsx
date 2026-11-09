"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  Music2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { SpotifyLogo } from "@/components/icons/spotify-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  beginSpotifyAuth,
  clearSpotifyConnection,
  completeSpotifyAuth,
  fetchSpotifyPlaylists,
  fetchSpotifyProfile,
  getSpotifyClientId,
  getSpotifyRedirectUri,
  getValidAccessToken,
  hasSpotifyTutorialSeen,
  markSpotifyTutorialSeen,
  spotifyApi,
  SpotifyError,
  type SpotifyPlaylist,
  type SpotifyProfile,
  type SpotifyTrack,
} from "@/lib/spotify";
import { createSpotifyPlayer, type SpotifyWebPlayer } from "@/lib/spotify-player";
import { cn } from "@/lib/utils";

type Phase = "loading" | "tutorial" | "connect" | "app";

interface PlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  track: SpotifyTrack | null;
}

interface RawPlayback {
  paused: boolean;
  position: number;
  duration: number;
  track_window?: { current_track?: SpotifyTrack | null };
}

const DEVELOPER_DASHBOARD = "https://developer.spotify.com/dashboard";

function message(cause: unknown): string {
  if (cause instanceof SpotifyError) return cause.message;
  if (cause instanceof Error) return cause.message;
  return "Ocurrió un error inesperado.";
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Los podcasts y anuncios del SDK no siempre traen `artists`. */
function trackArtistLine(track: SpotifyTrack): string {
  const artists = Array.isArray(track.artists)
    ? track.artists
        .map((artist) => artist?.name)
        .filter((name): name is string => Boolean(name))
    : [];
  return artists.length > 0
    ? artists.join(", ")
    : track.album?.name ?? "Reproduciendo";
}

function Notice({
  tone = "error",
  children,
  onClose,
}: {
  tone?: "error" | "info";
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11.5px] leading-4",
        tone === "error"
          ? "border-rose-300/50 bg-rose-50/70 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
          : "border-emerald-300/50 bg-emerald-50/70 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
      )}
    >
      {tone === "error" ? (
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <p className="min-w-0 flex-1">{children}</p>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-full px-1 text-[13px] leading-none opacity-60 transition-opacity hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function TutorialStep({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1DB954]/15 text-[10.5px] font-bold text-[#138a3f] dark:text-[#5ee08b]">
        {step}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-slate-800 dark:text-white/90">{title}</p>
        <div className="mt-1 text-[11.5px] leading-5 text-slate-500 dark:text-white/45">
          {children}
        </div>
      </div>
    </div>
  );
}

function PlaylistCard({
  playlist,
  onPlay,
  ready,
}: {
  playlist: SpotifyPlaylist;
  onPlay: () => void;
  ready: boolean;
}) {
  const cover = playlist.images?.[0]?.url;
  const trackCount = playlist.tracks?.total ?? 0;
  const owner = playlist.owner?.display_name ?? "Spotify";
  return (
    <button
      type="button"
      onClick={onPlay}
      className="glass-card group overflow-hidden rounded-[24px] p-0 text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954]/60"
      title={ready ? `Reproducir ${playlist.name}` : "El reproductor se está preparando"}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-black/[0.04] dark:bg-white/[0.05]">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-slate-400 dark:text-white/30">
            <Music2 className="h-8 w-8" />
          </span>
        )}
        <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954] text-[#06240f] opacity-0 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition-opacity duration-200 group-hover:opacity-100">
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-1 text-[12.5px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-white/90">
          {playlist.name}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10.5px] text-slate-500 dark:text-white/40">
          {trackCount} canciones · {owner}
        </p>
      </div>
    </button>
  );
}

function PlayerBar({
  playback,
  progress,
  activePlaylist,
  ready,
  onToggle,
  onNext,
  onPrevious,
}: {
  playback: PlaybackState | null;
  progress: number;
  activePlaylist: SpotifyPlaylist | null;
  ready: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const track = playback?.track ?? null;
  const cover = track?.album?.images?.[0]?.url ?? activePlaylist?.images?.[0]?.url ?? null;
  const title = track?.name ?? activePlaylist?.name ?? "Elige una playlist";
  const subtitle = track
    ? trackArtistLine(track)
    : activePlaylist
      ? "Lista para reproducir"
      : "Tu música de estudio";
  const duration = playback?.duration ?? 0;
  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const paused = playback ? playback.paused : true;

  return (
    <div className="sticky bottom-[calc(var(--mobile-nav-offset)+0.75rem)] z-30 md:bottom-4">
      <div className="app-glass-strong rounded-[26px] border border-white/40 p-3 shadow-[0_26px_70px_-30px_rgba(18,24,38,0.55)] dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/[0.06] dark:bg-white/[0.07]">
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-slate-400 dark:text-white/30">
                <SpotifyLogo className="h-6 w-6 text-[#1DB954]" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-slate-800 dark:text-white/90">
              {title}
            </p>
            <p className="truncate text-[10.5px] text-slate-500 dark:text-white/40">{subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              disabled={!ready}
              aria-label="Canción anterior"
              className="h-8 w-8 rounded-full"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={onToggle}
              disabled={!ready}
              aria-label={paused ? "Reproducir" : "Pausar"}
              className="h-9 w-9 rounded-full bg-[#1DB954] text-[#06240f] hover:bg-[#25d366]"
            >
              {!ready ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : paused ? (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              ) : (
                <Pause className="h-4 w-4 fill-current" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={!ready}
              aria-label="Canción siguiente"
              className="h-8 w-8 rounded-full"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            {activePlaylist ? (
              <a
                href={`https://open.spotify.com/playlist/${activePlaylist.id}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir en Spotify"
                title="Abrir en Spotify"
                className="ml-1 hidden h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-black/[0.05] hover:text-slate-800 sm:flex dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-slate-400 dark:text-white/30">
            {formatTime(progress)}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[#1DB954]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-[9px] tabular-nums text-slate-400 dark:text-white/30">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Herramienta de Spotify: tutorial de credenciales la primera vez, conexión
 * OAuth PKCE y reproductor integrado con la Web Playback SDK.
 */
export function SpotifyView() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [redirectUri, setRedirectUri] = useState("");
  const [copied, setCopied] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientIdDraft, setClientIdDraft] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [progress, setProgress] = useState(0);
  const [activePlaylist, setActivePlaylist] = useState<SpotifyPlaylist | null>(null);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [me, lists] = await Promise.all([fetchSpotifyProfile(), fetchSpotifyPlaylists()]);
      setProfile(me);
      setPlaylists(lists);
      setError(null);
    } catch (cause) {
      if (cause instanceof SpotifyError && cause.status === 401) {
        setPhase("connect");
      } else {
        setError(message(cause));
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setRedirectUri(getSpotifyRedirectUri());
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const authError = params.get("error");
      const authErrorDescription = params.get("error_description");

      const stored = getSpotifyClientId() ?? "";
      if (!alive) return;
      setClientId(stored);
      setClientIdDraft(stored);

      if (authError) {
        setError(authErrorDescription || "Spotify canceló la conexión.");
      }

      if (code) {
        try {
          await completeSpotifyAuth(code, state);
        } catch (cause) {
          if (alive) setError(message(cause));
        }
      }

      if (code || authError) {
        try {
          window.history.replaceState({}, "", window.location.pathname);
        } catch {
          // Algunos webviews no permiten reescribir la URL; no debe tumbar la app.
        }
      }
      if (!alive) return;

      const token = await getValidAccessToken();
      if (!alive) return;

      if (token) {
        setPhase("app");
        void loadData();
        return;
      }

      setPhase(hasSpotifyTutorialSeen() ? "connect" : "tutorial");
    }

    void boot();
    return () => {
      alive = false;
    };
  }, [loadData]);

  useEffect(() => {
    if (phase !== "app") return;

    let disposed = false;
    let player: SpotifyWebPlayer | null = null;

    setPlayerError(null);
    setPremiumRequired(false);
    setDeviceId(null);

    void (async () => {
      try {
        const created = await createSpotifyPlayer();
        if (disposed) {
          created.disconnect();
          return;
        }
        player = created;

        created.addListener("ready", (payload) => {
          if (disposed) return;
          const id = (payload as { device_id?: string }).device_id;
          if (!id) return;
          setDeviceId(id);
          setPlayerError(null);
          void spotifyApi("/me/player", {
            method: "PUT",
            body: JSON.stringify({ device_ids: [id], play: false }),
          }).catch(() => undefined);
        });

        created.addListener("not_ready", () => {
          if (!disposed) setDeviceId(null);
        });

        created.addListener("player_state_changed", (payload) => {
          if (disposed || !payload) return;
          const raw = payload as RawPlayback;
          setPlayback({
            paused: raw.paused,
            position: raw.position,
            duration: raw.duration,
            track: raw.track_window?.current_track ?? null,
          });
        });

        created.addListener("initialization_error", (payload) => {
          if (disposed) return;
          const detail = (payload as { message?: string }).message;
          setPlayerError(detail || "Este navegador no pudo iniciar el reproductor integrado.");
        });

        created.addListener("authentication_error", () => {
          if (!disposed) {
            setPlayerError("Spotify no pudo autenticar el reproductor. Vuelve a conectar tu cuenta.");
          }
        });

        created.addListener("account_error", () => {
          if (!disposed) setPremiumRequired(true);
        });

        const connected = await created.connect();
        if (!connected && !disposed) {
          setPlayerError("No se pudo iniciar el reproductor. Comprueba que Spotify siga abierto en otro dispositivo.");
        }
      } catch (cause) {
        if (!disposed) setPlayerError(message(cause));
      }
    })();

    return () => {
      disposed = true;
      player?.disconnect();
    };
  }, [phase]);

  useEffect(() => {
    if (!playback) {
      setProgress(0);
      return;
    }
    const base = playback.position;
    const started = Date.now();
    setProgress(base);
    if (playback.paused) return;
    const interval = window.setInterval(() => {
      setProgress(Math.min(playback.duration, base + (Date.now() - started)));
    }, 500);
    return () => window.clearInterval(interval);
  }, [playback]);

  async function copyRedirect() {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("No se pudo copiar. Selecciona la dirección y cópiala a mano.");
    }
  }

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      markSpotifyTutorialSeen();
      await beginSpotifyAuth(clientIdDraft);
    } catch (cause) {
      setError(message(cause));
      setConnecting(false);
    }
  }

  function closeTutorial() {
    markSpotifyTutorialSeen();
    setPhase(profile ? "app" : "connect");
  }

  function disconnect() {
    clearSpotifyConnection();
    setProfile(null);
    setPlaylists([]);
    setPlayback(null);
    setActivePlaylist(null);
    setPlayerError(null);
    setPremiumRequired(false);
    setPhase("connect");
  }

  async function playPlaylist(playlist: SpotifyPlaylist) {
    if (!deviceId) {
      setPlayerError("El reproductor todavía se está conectando. Prueba en unos segundos.");
      return;
    }
    setPlayerError(null);
    const play = () =>
      spotifyApi(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        body: JSON.stringify({ context_uri: playlist.uri }),
      });

    try {
      await play();
      setActivePlaylist(playlist);
    } catch (cause) {
      if (cause instanceof SpotifyError && cause.status === 404) {
        try {
          await spotifyApi("/me/player", {
            method: "PUT",
            body: JSON.stringify({ device_ids: [deviceId] }),
          });
          await play();
          setActivePlaylist(playlist);
          return;
        } catch (retryCause) {
          setPlayerError(message(retryCause));
          return;
        }
      }
      setPlayerError(message(cause));
    }
  }

  async function control(action: "play" | "pause" | "next" | "previous") {
    if (!deviceId) {
      setPlayerError("El reproductor todavía no está listo.");
      return;
    }
    const query = `?device_id=${encodeURIComponent(deviceId)}`;
    try {
      if (action === "play") {
        await spotifyApi(`/me/player/play${query}`, { method: "PUT" });
      } else if (action === "pause") {
        await spotifyApi(`/me/player/pause${query}`, { method: "PUT" });
      } else {
        await spotifyApi(`/me/player/${action}${query}`, { method: "POST" });
      }
    } catch (cause) {
      setPlayerError(message(cause));
    }
  }

  async function togglePlayback() {
    if (playback) {
      await control(playback.paused ? "play" : "pause");
      return;
    }
    if (activePlaylist) {
      await playPlaylist(activePlaylist);
      return;
    }
    await control("play");
  }

  async function refresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-slate-500 dark:text-white/45">
        <Loader2 className="h-5 w-5 animate-spin text-[#1DB954]" />
        <p className="text-[12px]">Comprobando tu conexión de Spotify…</p>
      </div>
    );
  }

  if (phase === "tutorial") {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1DB954]/20 bg-[#1DB954]/10 text-[#1DB954]">
              <SpotifyLogo className="h-7 w-7" />
            </span>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#138a3f] dark:text-[#5ee08b]">
                Nueva herramienta
              </p>
              <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-[#1d1d1f] dark:text-white">
                Conecta tu Spotify
              </h1>
            </div>
          </div>
          <Button variant="ghost" onClick={closeTutorial} className="h-9 self-start rounded-xl sm:self-auto">
            <ArrowLeft className="h-4 w-4" /> Ya tengo mi Client ID
          </Button>
        </div>

        {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}

        <section className="glass-card rounded-[30px] p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
                  Tres pasos y suena la música
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-white/45">
                  Academic Autopilot se conecta con tu propia app de Spotify. Solo se guarda
                  el Client ID en este dispositivo; la autorización se hace con PKCE y nunca
                  se pide el Client Secret.
                </p>
              </div>

              <TutorialStep step={1} title="Crea una app en el dashboard">
                Entra en{" "}
                <a
                  href={DEVELOPER_DASHBOARD}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#138a3f] underline decoration-[#1DB954]/40 underline-offset-2 dark:text-[#5ee08b]"
                >
                  developer.spotify.com/dashboard
                </a>{" "}
                con tu cuenta Premium y pulsa <strong>Create app</strong>. Ponle un nombre y
                una descripción, acepta los términos y guarda.
              </TutorialStep>

              <TutorialStep step={2} title="Añade esta Redirect URI">
                En la configuración de la app, añade exactamente la dirección de la derecha.
                Es adonde Spotify devuelve la autorización; si no coincide, la conexión falla.
              </TutorialStep>

              <TutorialStep step={3} title="Copia el Client ID y autoriza">
                En <strong>Settings</strong> copia el <strong>Client ID</strong> y pégalo aquí.
                No necesitas el Client Secret. Si la app está en modo Development, añade tu
                cuenta en <strong>User Management</strong> antes de conectar.
              </TutorialStep>
            </div>

            <div className="space-y-3 rounded-[26px] border border-black/[0.06] bg-white/45 p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <div>
                <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/35">
                  <KeyRound className="h-3 w-3" /> Redirect URI
                </p>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-black/[0.07] bg-white/65 px-2.5 py-2 dark:border-white/10 dark:bg-black/20">
                  <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-600 dark:text-white/55">
                    {redirectUri || "Cargando…"}
                  </code>
                  <button
                    type="button"
                    onClick={copyRedirect}
                    aria-label="Copiar Redirect URI"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/[0.05] hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-[#1DB954]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="spotify-client-id"
                  className="text-[10.5px] font-semibold text-slate-600 dark:text-white/55"
                >
                  Client ID
                </label>
                <Input
                  id="spotify-client-id"
                  value={clientIdDraft}
                  onChange={(event) => setClientIdDraft(event.target.value)}
                  placeholder="32 caracteres hexadecimales"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 h-10 rounded-xl font-mono text-[11.5px]"
                />
              </div>

              <Button
                type="button"
                onClick={() => void connect()}
                disabled={!clientIdDraft.trim() || connecting}
                className="h-10 w-full rounded-xl bg-[#1DB954] text-[#06240f] hover:bg-[#25d366]"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SpotifyLogo className="h-4 w-4" />
                )}
                {connecting ? "Abriendo Spotify…" : "Conectar con Spotify"}
              </Button>

              <p className="flex items-start gap-1.5 text-[10px] leading-4 text-slate-500 dark:text-white/35">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1DB954]" />
                Tus tokens se guardan solo en este navegador. Puedes desconectar la cuenta
                cuando quieras y no se comparte ningún secreto con el servidor.
              </p>
            </div>
          </div>
        </section>

        <div className="flex items-start gap-2 rounded-[22px] border border-[#1DB954]/20 bg-[#1DB954]/[0.07] px-3.5 py-3 text-[11px] leading-5 text-slate-600 dark:text-white/50">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1DB954]" />
          El reproductor integrado necesita Spotify Premium y un navegador con soporte de
          reproducción protegida (Chrome, Edge o Safari en escritorio).
        </div>
      </div>
    );
  }

  if (phase === "connect") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#1DB954]/20 bg-[#1DB954]/10 text-[#1DB954]">
            <SpotifyLogo className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.035em] text-[#1d1d1f] dark:text-white">
              Spotify
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-white/40">
              Conecta tu cuenta para escuchar tus playlists mientras estudias.
            </p>
          </div>
        </div>

        {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}

        <section className="glass-card space-y-3 rounded-[28px] p-5">
          <div>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/35">
              Redirect URI
            </p>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-black/[0.07] bg-white/65 px-2.5 py-2 dark:border-white/10 dark:bg-black/20">
              <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-600 dark:text-white/55">
                {redirectUri || "Cargando…"}
              </code>
              <button
                type="button"
                onClick={copyRedirect}
                aria-label="Copiar Redirect URI"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/[0.05] hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[#1DB954]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">
              Debe coincidir con la Redirect URI de tu app en el dashboard de Spotify.
            </p>
          </div>

          <div>
            <label
              htmlFor="spotify-client-id"
              className="text-[10.5px] font-semibold text-slate-600 dark:text-white/55"
            >
              Client ID
            </label>
            <Input
              id="spotify-client-id"
              value={clientIdDraft}
              onChange={(event) => setClientIdDraft(event.target.value)}
              placeholder="32 caracteres hexadecimales"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 h-10 rounded-xl font-mono text-[11.5px]"
            />
          </div>

          <Button
            type="button"
            onClick={() => void connect()}
            disabled={!clientIdDraft.trim() || connecting}
            className="h-10 w-full rounded-xl bg-[#1DB954] text-[#06240f] hover:bg-[#25d366]"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SpotifyLogo className="h-4 w-4" />
            )}
            {connecting ? "Abriendo Spotify…" : "Conectar con Spotify"}
          </Button>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPhase("tutorial")}
              className="text-[10.5px] font-semibold text-[#138a3f] underline decoration-[#1DB954]/40 underline-offset-2 dark:text-[#5ee08b]"
            >
              Ver el tutorial completo
            </button>
            {clientId ? (
              <span className="text-[10px] text-slate-400 dark:text-white/30">
                Client ID guardado en este dispositivo
              </span>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  const displayName = profile?.display_name || profile?.email || "Tu cuenta";
  const isPremium = profile?.product === "premium";

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 pb-6 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1DB954]/20 bg-[#1DB954]/10 text-[#1DB954]">
            <SpotifyLogo className="h-7 w-7" />
          </span>
          <div>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#138a3f] dark:text-[#5ee08b]">
              Tu banda sonora
            </p>
            <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-[#1d1d1f] dark:text-white">
              Spotify
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/45 bg-white/50 px-2 py-1 pr-3 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06]">
            {profile?.images?.[0]?.url ? (
              <img
                src={profile.images[0].url}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-slate-500 dark:bg-white/10 dark:text-white/50">
                <UserRound className="h-3.5 w-3.5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="max-w-[150px] truncate text-[11px] font-semibold text-slate-700 dark:text-white/80">
                {displayName}
              </p>
              <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-[#138a3f] dark:text-[#5ee08b]">
                {isPremium ? "Premium" : "Cuenta conectada"}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setPhase("tutorial")} className="h-8 rounded-xl px-2.5 text-[11px]">
            Guía
          </Button>
          <Button variant="ghost" onClick={disconnect} className="h-8 rounded-xl px-2.5 text-[11px]">
            <LogOut className="h-3.5 w-3.5" /> Desconectar
          </Button>
        </div>
      </header>

      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      {premiumRequired ? (
        <Notice tone="info">
          Tu cuenta no tiene reproducción Premium activa. Puedes ver tus playlists y abrirlas
          en Spotify, pero el reproductor integrado necesita Premium.
        </Notice>
      ) : null}
      {playerError ? (
        <Notice onClose={() => setPlayerError(null)}>{playerError}</Notice>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-white">
              Tus playlists
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/40">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  deviceId ? "bg-[#1DB954]" : "bg-amber-400",
                )}
              />
              {deviceId
                ? "Reproductor conectado y listo"
                : "Preparando el reproductor integrado…"}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="h-8 rounded-xl px-2.5 text-[11px]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {loadingData && playlists.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="glass-card animate-pulse overflow-hidden rounded-[24px]">
                <div className="aspect-square w-full bg-black/[0.05] dark:bg-white/[0.06]" />
                <div className="space-y-2 p-3">
                  <div className="h-2.5 w-3/4 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
                  <div className="h-2 w-1/2 rounded-full bg-black/[0.04] dark:bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        ) : playlists.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-[26px] px-5 py-10 text-center">
            <Music2 className="h-6 w-6 text-[#1DB954]" />
            <p className="text-[12.5px] font-semibold text-slate-700 dark:text-white/80">
              Esta cuenta no tiene playlists todavía
            </p>
            <p className="max-w-sm text-[11px] leading-5 text-slate-500 dark:text-white/40">
              Crea una playlist en Spotify y vuelve a pulsar Actualizar. También puedes abrir
              Spotify desde aquí y volver cuando tengas música lista.
            </p>
            <a
              href="https://open.spotify.com"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#138a3f] dark:text-[#5ee08b]"
            >
              Abrir Spotify <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                ready={Boolean(deviceId)}
                onPlay={() => void playPlaylist(playlist)}
              />
            ))}
          </div>
        )}
      </section>

      <PlayerBar
        playback={playback}
        progress={progress}
        activePlaylist={activePlaylist}
        ready={Boolean(deviceId)}
        onToggle={() => void togglePlayback()}
        onNext={() => void control("next")}
        onPrevious={() => void control("previous")}
      />
    </div>
  );
}
