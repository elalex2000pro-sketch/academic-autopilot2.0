/**
 * Pista de recuperación guardada en este dispositivo.
 *
 * Solo se guarda la pregunta de seguridad (nunca la respuesta) para poder
 * mostrarla si el backend no está disponible o si la cuenta todavía no tiene
 * una pregunta configurada en el servidor.
 */

const STORAGE_KEY = "academic-autopilot:recovery-hints";
const MAX_HINTS = 20;

export interface RecoveryHint {
  question: string;
  savedAt: string;
}

type HintMap = Record<string, RecoveryHint>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readMap(): HintMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: HintMap = {};
    for (const [email, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const candidate = value as { question?: unknown; savedAt?: unknown };
      if (typeof candidate.question !== "string" || !candidate.question.trim()) continue;
      result[email] = {
        question: candidate.question.trim(),
        savedAt:
          typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
      };
    }
    return result;
  } catch {
    return {};
  }
}

function writeMap(map: HintMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Si el navegador bloquea el almacenamiento, la recuperación sigue
    // funcionando contra el backend.
  }
}

export function saveRecoveryHint(email: string, question: string): void {
  const cleanEmail = normalizeEmail(email);
  const cleanQuestion = question.trim();
  if (!cleanEmail || !cleanQuestion) return;

  const map = readMap();
  map[cleanEmail] = { question: cleanQuestion, savedAt: new Date().toISOString() };

  // Conserva solo las pistas más recientes para no crecer sin límite.
  const entries = Object.entries(map).sort(
    ([, a], [, b]) => Date.parse(b.savedAt) - Date.parse(a.savedAt),
  );
  writeMap(Object.fromEntries(entries.slice(0, MAX_HINTS)));
}

export function getRecoveryHint(email: string): RecoveryHint | null {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;
  return readMap()[cleanEmail] ?? null;
}

export function clearRecoveryHint(email: string): void {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return;
  const map = readMap();
  if (!(cleanEmail in map)) return;
  delete map[cleanEmail];
  writeMap(map);
}
