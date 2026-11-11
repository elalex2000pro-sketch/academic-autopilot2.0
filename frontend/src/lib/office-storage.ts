import { apiBase, tokenStore } from "@/lib/api";
export interface OfficeData { title: string; kind: "document" | "sheet"; content: string; schema_version: 1; settings: Record<string, unknown>; folder: string | null }
export interface OfficeDocument extends OfficeData { id: string; revision: number; created_at: string; updated_at: string }
export interface OfficeVersion extends OfficeData { id: string; revision: number; created_at: string }
export class OfficeError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function officeRequest<T>(path = "", method = "GET", body?: unknown, keepalive = false): Promise<T> {
  const response = await fetch(`${apiBase()}/api/v1/office/documents${path}`, { method, headers: { Authorization: `Bearer ${tokenStore.get()}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), keepalive });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new OfficeError(response.status, error.detail || "No se pudo guardar el documento"); }
  return response.status === 204 ? undefined as T : response.json();
}
export function officeUserKey() {
  try { return JSON.parse(atob((tokenStore.get() || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub as string; } catch { return "sin-sesion"; }
}
export function officeDraftKey(id: string) { return `academic-office-draft:${officeUserKey()}:${id}`; }
export function draftImportKey(kind: string, content: string) {
  // La clave se genera una sola vez y se conserva antes de la petición.
  const key = `academic-office-import:${officeUserKey()}:${kind}`;
  const previous = localStorage.getItem(key);
  if (previous) { const data = JSON.parse(previous); if (data.content === content) return data.id as string; }
  const id = crypto.randomUUID(); localStorage.setItem(key, JSON.stringify({ content, id })); return id;
}
