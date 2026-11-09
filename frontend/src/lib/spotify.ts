/**
 * Conexión con Spotify mediante OAuth 2.0 + PKCE.
 *
 * No se usa client secret: el flujo PKCE está pensado para aplicaciones
 * públicas y permite que cada usuario conecte su propia cuenta sin exponer
 * credenciales privadas. Los tokens se guardan en localStorage del navegador
 * y se renuevan con el refresh token cuando caducan.
 */

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";

const CLIENT_ID_KEY = "autopilot:spotify:client-id";
const VERIFIER_KEY = "autopilot:spotify:verifier";
const STATE_KEY = "autopilot:spotify:state";
const TOKENS_KEY = "autopilot:spotify:tokens";
const TUTORIAL_KEY = "autopilot:spotify:tutorial-seen";

export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
];

export class SpotifyError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "SpotifyError";
    this.status = status;
  }
}

export interface SpotifyImage {
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface SpotifyArtist {
  name: string;
}

export interface SpotifyTrack {
  id: string | null;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: {
    name: string;
    images: SpotifyImage[];
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  uri: string;
  images: SpotifyImage[];
  owner: { display_name: string };
  tracks: { total: number };
}

export interface SpotifyProfile {
  id: string;
  display_name: string | null;
  email?: string;
  product?: string;
  images: SpotifyImage[];
}

interface SpotifyTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Sin almacenamiento la conexión no persiste, pero la app no se rompe. */
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Ignorar. */
  }
}

export function getSpotifyClientId(): string | null {
  const value = read(CLIENT_ID_KEY)?.trim();
  return value || null;
}

function readTokens(): SpotifyTokens | null {
  const raw = read(TOKENS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SpotifyTokens>;
    if (!parsed.access_token || typeof parsed.expires_at !== "number") return null;
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token ?? null,
      expires_at: parsed.expires_at,
      scope: parsed.scope ?? "",
    };
  } catch {
    return null;
  }
}

function saveTokens(response: TokenResponse, previousRefresh?: string | null): SpotifyTokens {
  const tokens: SpotifyTokens = {
    access_token: response.access_token,
    refresh_token: response.refresh_token ?? previousRefresh ?? null,
    expires_at: Date.now() + Math.max(30, response.expires_in) * 1000,
    scope: response.scope ?? "",
  };
  write(TOKENS_KEY, JSON.stringify(tokens));
  return tokens;
}

export function hasSpotifyTutorialSeen(): boolean {
  return read(TUTORIAL_KEY) === "true";
}

export function markSpotifyTutorialSeen(): void {
  write(TUTORIAL_KEY, "true");
}

export function hasSpotifySession(): boolean {
  return Boolean(readTokens());
}

export function clearSpotifyConnection(): void {
  remove(TOKENS_KEY);
  remove(VERIFIER_KEY);
  remove(STATE_KEY);
}

export function forgetSpotify(): void {
  clearSpotifyConnection();
  remove(CLIENT_ID_KEY);
  remove(TUTORIAL_KEY);
}

export function getSpotifyRedirectUri(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/spotify`;
}

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(length = 64): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => charset[value % charset.length]).join("");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(digest);
}

/** Guarda el Client ID y redirige a la pantalla de autorización de Spotify. */
export async function beginSpotifyAuth(clientId: string): Promise<void> {
  const id = clientId.trim();
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    throw new SpotifyError("El Client ID debe tener 32 caracteres hexadecimales.");
  }
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new SpotifyError("Este navegador no permite el inicio de sesión seguro. Abre la app con HTTPS.");
  }

  const verifier = randomToken(64);
  const state = randomToken(24);
  const challenge = await pkceChallenge(verifier);

  write(CLIENT_ID_KEY, id);
  write(VERIFIER_KEY, verifier);
  write(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: id,
    redirect_uri: getSpotifyRedirectUri(),
    scope: SPOTIFY_SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });

  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`);
}

/** Canjea el código de la URL por tokens y marca el tutorial como visto. */
export async function completeSpotifyAuth(code: string, state: string | null): Promise<void> {
  const expectedState = read(STATE_KEY);
  const verifier = read(VERIFIER_KEY);
  const clientId = getSpotifyClientId();

  if (!expectedState || state !== expectedState) {
    throw new SpotifyError("La verificación de seguridad no coincide. Vuelve a conectar tu cuenta.");
  }
  if (!verifier || !clientId) {
    throw new SpotifyError("Faltan datos de la conexión. Vuelve a empezar el proceso.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getSpotifyRedirectUri(),
    client_id: clientId,
    code_verifier: verifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new SpotifyError(
      `Spotify rechazó la conexión (${response.status}). Revisa la Redirect URI. ${details.slice(0, 160)}`,
      response.status,
    );
  }

  const data = (await response.json()) as TokenResponse;
  saveTokens(data);
  remove(VERIFIER_KEY);
  remove(STATE_KEY);
  markSpotifyTutorialSeen();
}

let refreshPromise: Promise<string | null> | null = null;

/** Devuelve un access token válido, renovándolo si está a punto de caducar. */
export async function getValidAccessToken(force = false): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  if (!force && tokens.expires_at > Date.now() + 45_000) return tokens.access_token;
  if (!tokens.refresh_token) return null;

  const clientId = getSpotifyClientId();
  if (!clientId) return null;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token as string,
        client_id: clientId,
      });
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) {
        clearSpotifyConnection();
        return null;
      }
      const data = (await response.json()) as TokenResponse;
      saveTokens(data, tokens.refresh_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Llamada autenticada a la Web API, con un reintento tras renovar el token. */
export async function spotifyApi<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyError("Conecta tu cuenta de Spotify para continuar.", 401);

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (response.status === 401 && retry) {
    const refreshed = await getValidAccessToken(true);
    if (refreshed) return spotifyApi<T>(path, init, false);
    clearSpotifyConnection();
    throw new SpotifyError("La sesión de Spotify caducó. Vuelve a conectar tu cuenta.", 401);
  }

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new SpotifyError(
      data?.error?.message ?? `Spotify respondió con el código ${response.status}.`,
      response.status,
    );
  }

  return data as T;
}

export async function fetchSpotifyProfile(): Promise<SpotifyProfile> {
  return spotifyApi<SpotifyProfile>("/me");
}

export async function fetchSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
  const page = await spotifyApi<{ items?: (SpotifyPlaylist | null)[] }>(
    "/me/playlists?limit=50",
  );
  const items = Array.isArray(page?.items) ? page.items : [];
  return items.filter((item): item is SpotifyPlaylist => Boolean(item && item.id));
}
