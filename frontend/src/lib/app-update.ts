/**
 * Comprobación de actualizaciones de Academic Autopilot.
 *
 * - Escritorio (Electron): lee la última release de GitHub con instalador
 *   `Academic-Autopilot-Setup.exe` y compara con la versión del user agent
 *   `AcademicAutopilotDesktop/x.y.z`.
 * - Web / PWA: lee `/version.json`, que se actualiza con cada despliegue.
 *
 * La descarga se simula en el modal; la instalación real abre el instalador
 * (escritorio) o recarga la app (web). El objetivo es no bloquear la interfaz
 * mientras se comprueba ni depender de CORS en los assets de GitHub.
 */

import packageInfo from "../../package.json";

export const UPDATE_REPO = "elalex2000pro-sketch/academic-autopilot2.0";
export const GITHUB_RELEASES_URL = `https://github.com/${UPDATE_REPO}/releases`;
export const GITHUB_LATEST_RELEASE_URL = `${GITHUB_RELEASES_URL}/latest`;
export const DESKTOP_INSTALLER_NAME = "Academic-Autopilot-Setup.exe";
export const DESKTOP_DOWNLOAD_URL = `${GITHUB_RELEASES_URL}/latest/download/${DESKTOP_INSTALLER_NAME}`;

const GITHUB_RELEASES_API = `https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=15`;
const WEB_VERSION_URL = "/version.json";
const CHECK_TIMEOUT_MS = 8000;

const SNOOZE_KEY_PREFIX = "academic-autopilot:update-snooze";
const INSTALLED_KEY_PREFIX = "academic-autopilot:update-installed";

/** Evento que permite pedir una comprobación manual desde cualquier pantalla. */
export const UPDATE_CHECK_EVENT = "autopilot:check-for-updates";

/** Versión de la web. Se puede sobrescribir con NEXT_PUBLIC_APP_VERSION. */
export const WEB_APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || packageInfo.version;

export const DEFAULT_SNOOZE_HOURS = 24;

export type UpdateChannel = "desktop" | "web";

export interface AppUpdate {
  channel: UpdateChannel;
  version: string;
  currentVersion: string;
  notes: string[];
  publishedAt: string | null;
  downloadUrl: string;
  releaseUrl: string;
  sizeBytes: number | null;
  tag: string | null;
}

export interface UpdateCheckResult {
  channel: UpdateChannel;
  currentVersion: string;
  update: AppUpdate | null;
}

interface GithubAsset {
  name?: string;
  size?: number;
  browser_download_url?: string;
}

interface GithubRelease {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GithubAsset[];
}

interface WebVersionManifest {
  version?: string;
  notes?: string[] | string;
  publishedAt?: string;
  published_at?: string;
  downloadUrl?: string;
  releaseUrl?: string;
  sizeBytes?: number;
  enabled?: boolean;
}

interface DesktopReleaseCandidate {
  release: GithubRelease;
  version: string;
  asset: GithubAsset;
}

function storageKey(prefix: string, channel: UpdateChannel): string {
  return `${prefix}:${channel}`;
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Si el navegador bloquea localStorage, la app sigue funcionando.
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignorar.
  }
}

/** Quita prefijos (`v`, `desktop-`) y sufijos de pre-release. */
export function normalizeVersion(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = String(value)
    .trim()
    .replace(/^desktop[-/]/i, "")
    .replace(/^v/i, "");
  const match = cleaned.match(/^(\d+(?:\.\d+)*)/);
  return match ? match[1] : "";
}

/** Compara dos versiones semánticas. Devuelve 1, 0 o -1. */
export function compareVersions(left: string, right: string): number {
  const a = normalizeVersion(left)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const b = normalizeVersion(right)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length, 3);

  for (let index = 0; index < length; index += 1) {
    const x = a[index] ?? 0;
    const y = b[index] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

export function isDesktopApp(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /AcademicAutopilotDesktop\//i.test(ua);
}

export function getDesktopVersion(userAgent?: string): string | null {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const match = ua.match(/AcademicAutopilotDesktop\/(\d+(?:\.\d+)*)/i);
  return match ? normalizeVersion(match[1]) : null;
}

export function getChannel(): UpdateChannel {
  return isDesktopApp() ? "desktop" : "web";
}

export function getCurrentVersion(channel: UpdateChannel = getChannel()): string {
  if (channel === "desktop") {
    return getDesktopVersion() || "1.0.0";
  }
  return WEB_APP_VERSION;
}

/** Versión simulada instalada en este navegador, si la hay. */
export function getInstalledVersion(channel: UpdateChannel): string | null {
  return readStorage(storageKey(INSTALLED_KEY_PREFIX, channel));
}

/**
 * Versión de referencia: la real o la simulada, la que sea mayor. Así una
 * actualización real nunca queda tapada por un valor antiguo de localStorage.
 */
export function getEffectiveVersion(channel: UpdateChannel): string {
  const current = getCurrentVersion(channel);
  const installed = getInstalledVersion(channel);
  if (installed && compareVersions(installed, current) > 0) return installed;
  return current;
}

export function markVersionInstalled(channel: UpdateChannel, version: string): void {
  writeStorage(storageKey(INSTALLED_KEY_PREFIX, channel), normalizeVersion(version) || version);
}

export function clearInstalledVersion(channel: UpdateChannel): void {
  removeStorage(storageKey(INSTALLED_KEY_PREFIX, channel));
}

export function getSnoozeUntil(channel: UpdateChannel): number {
  const raw = readStorage(storageKey(SNOOZE_KEY_PREFIX, channel));
  const value = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function isUpdateSnoozed(channel: UpdateChannel): boolean {
  return getSnoozeUntil(channel) > Date.now();
}

export function snoozeUpdates(channel: UpdateChannel, hours = DEFAULT_SNOOZE_HOURS): void {
  const until = Date.now() + Math.max(1, hours) * 60 * 60 * 1000;
  writeStorage(storageKey(SNOOZE_KEY_PREFIX, channel), String(until));
}

export function clearUpdateSnooze(channel: UpdateChannel): void {
  removeStorage(storageKey(SNOOZE_KEY_PREFIX, channel));
}

/** ¿Merece la pena mostrar el modal para esta actualización? */
export function shouldShowUpdate(update: AppUpdate): boolean {
  if (compareVersions(update.version, getEffectiveVersion(update.channel)) <= 0) return false;
  return !isUpdateSnoozed(update.channel);
}

/** Lanza el evento que escucha el modal para comprobar manualmente. */
export function requestUpdateCheck(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UPDATE_CHECK_EVENT));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const rounded = exponent === 0 || value >= 10 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[exponent]}`;
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isMetaLine(text: string): boolean {
  return /^(sha-?256|tama[nñ]o|size)\b/i.test(text);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Convierte el cuerpo markdown de una release en puntos legibles. Descarta
 * líneas de checksum/tamaño y encabezados; si no hay viñetas, usa párrafos.
 */
export function parseReleaseNotes(body: string | null | undefined): string[] {
  if (!body) return [];

  const notes: string[] = [];
  let inCodeBlock = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock || !line) continue;

    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (!bullet) continue;

    const text = cleanMarkdown(bullet[1]);
    if (!text || isMetaLine(text)) continue;
    notes.push(text);
  }

  if (notes.length > 0) return dedupe(notes).slice(0, 8);

  const paragraphs = body
    .replace(/^#{1,6}\s+.*$/gm, "")
    .split(/\n{2,}/)
    .map((paragraph) => cleanMarkdown(paragraph))
    .filter((paragraph) => paragraph.length > 0 && !isMetaLine(paragraph));

  return dedupe(paragraphs).slice(0, 5);
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");

    const response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function pickDesktopRelease(releases: GithubRelease[]): DesktopReleaseCandidate | null {
  for (const release of releases) {
    if (!release || release.draft || release.prerelease) continue;

    const tag = release.tag_name ?? "";
    if (!/^desktop[-/]/i.test(tag)) continue;

    const assets = release.assets ?? [];
    const asset =
      assets.find((item) => item.name === DESKTOP_INSTALLER_NAME) ??
      assets.find((item) => /\.exe$/i.test(item.name ?? ""));

    if (!asset) continue;

    const version = normalizeVersion(tag);
    if (!version) continue;

    return { release, version, asset };
  }
  return null;
}

/**
 * Comprueba si hay una versión más nueva. No lanza el modal ni consulta el
 * snooze: eso lo decide el componente con `shouldShowUpdate`.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const channel = getChannel();
  const currentVersion = getCurrentVersion(channel);
  const baseline = getEffectiveVersion(channel);

  if (channel === "desktop") {
    const releases = await fetchJson<GithubRelease[]>(GITHUB_RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    const candidate = pickDesktopRelease(releases);

    if (!candidate || compareVersions(candidate.version, baseline) <= 0) {
      return { channel, currentVersion, update: null };
    }

    return {
      channel,
      currentVersion,
      update: {
        channel,
        version: candidate.version,
        currentVersion,
        notes: parseReleaseNotes(candidate.release.body),
        publishedAt: candidate.release.published_at ?? null,
        downloadUrl: candidate.asset.browser_download_url ?? DESKTOP_DOWNLOAD_URL,
        releaseUrl: candidate.release.html_url ?? GITHUB_LATEST_RELEASE_URL,
        sizeBytes: typeof candidate.asset.size === "number" ? candidate.asset.size : null,
        tag: candidate.release.tag_name ?? null,
      },
    };
  }

  const manifest = await fetchJson<WebVersionManifest>(
    `${WEB_VERSION_URL}?t=${Date.now()}`,
  );

  if (manifest.enabled === false) {
    return { channel, currentVersion, update: null };
  }

  const version = normalizeVersion(manifest.version);
  if (!version || compareVersions(version, baseline) <= 0) {
    return { channel, currentVersion, update: null };
  }

  const notes = Array.isArray(manifest.notes)
    ? manifest.notes.map((note) => cleanMarkdown(String(note))).filter(Boolean)
    : parseReleaseNotes(manifest.notes);

  return {
    channel,
    currentVersion,
    update: {
      channel,
      version,
      currentVersion,
      notes: notes.slice(0, 8),
      publishedAt: manifest.publishedAt ?? manifest.published_at ?? null,
      downloadUrl: manifest.downloadUrl ?? GITHUB_LATEST_RELEASE_URL,
      releaseUrl: manifest.releaseUrl ?? GITHUB_RELEASES_URL,
      sizeBytes:
        typeof manifest.sizeBytes === "number" && manifest.sizeBytes > 0
          ? manifest.sizeBytes
          : null,
      tag: null,
    },
  };
}
