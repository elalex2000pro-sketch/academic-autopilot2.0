// Cliente HTTP tipado para la API de Academic Autopilot.
import type {
  AiOutput,
  AssistantMessage,
  AssistantStatus,
  ChatResponse,
  ClassDetail,
  ClassEvent,
  ClassMessage,
  Course,
  DailyAgenda,
  DocumentFile,
  Grade,
  GradeSummary,
  Integration,
  OptimizedPlan,
  PendingAction,
  Provider,
  ScheduleBlock,
  SharedClass,
  SyncLog,
  SyncResult,
  Task,
  TimetableEntry,
  UploadSession,
  User,
} from "@/lib/types";

const TOKEN_KEY = "autopilot_token";

// Resuelve la base de la API en tiempo de ejecucion:
// - Si hay una URL publica configurada (no local) se usa tal cual (p. ej. el
//   frontend en Vercel apuntando al backend en Render).
// - Sirviendo en el puerto 3000 (dev) se apunta al backend en :8000 del mismo host.
// - En cualquier otro caso (proxy Caddy, Vercel, tunel) se usa el MISMO origen
//   (rutas relativas), de modo que no depende de puertos raros.
function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return configured;
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (!port) {
      // Puerto estandar (80/443): dominio con proxy o hosting externo. La API
      // se sirve en el mismo origen o se configuro NEXT_PUBLIC_API_URL.
      return "";
    }
    if (port === "3000") {
      return `${protocol}//${hostname}:8000`;
    }
    return "";
  }
  return configured || "http://localhost:8000";
}

// Base de la API (para peticiones que no pasan por `request`, como la subida
// por trozos con XMLHttpRequest).
export function apiBase(): string {
  return resolveApiBase();
}

// URL del WebSocket de sincronizacion en tiempo real.
export function realtimeUrl(): string {
  if (typeof window === "undefined") return "";
  const token = tokenStore.get();
  const base = resolveApiBase();
  const origin = (base || window.location.origin).replace(/^http/, "ws");
  return `${origin}/api/v1/ws?token=${encodeURIComponent(token ?? "")}`;
}

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${resolveApiBase()}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "No se pudo contactar con el servidor");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      `Error ${response.status}`;
    throw new ApiError(response.status, typeof detail === "string" ? detail : "Error de la API");
  }
  return data as T;
}

export const api = {
  // --- Auth ---
  register: (body: { email: string; password: string; full_name?: string; timezone?: string }) =>
    request<{ access_token: string }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => request<User>("/api/v1/auth/me"),

  // --- Integraciones ---
  integrations: () => request<Integration[]>("/api/v1/integrations"),
  connectMoodle: (body: { base_url: string; token: string }) =>
    request<Integration>("/api/v1/integrations/moodle", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  googleAuthorizeUrl: () =>
    request<{ authorization_url: string }>("/api/v1/integrations/google/authorize-url"),
  connectGoogle: (body: { code: string; state?: string }) =>
    request<Integration>("/api/v1/integrations/google", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  disconnect: (id: string) =>
    request<void>(`/api/v1/integrations/${id}`, { method: "DELETE" }),

  // --- Sync ---
  triggerSync: (provider: Provider = "all") =>
    request<SyncResult[]>("/api/v1/sync", {
      method: "POST",
      body: JSON.stringify({ provider }),
    }),
  syncStatus: () => request<SyncLog[]>("/api/v1/sync/status"),
  syncLogs: (limit = 20) => request<SyncLog[]>(`/api/v1/sync/logs?limit=${limit}`),

  // --- Cursos y tareas ---
  courses: () => request<Course[]>("/api/v1/courses"),
  createCourse: (body: { name: string; code?: string; color?: string }) =>
    request<Course>("/api/v1/courses", { method: "POST", body: JSON.stringify(body) }),
  updateCourse: (id: string, body: { name?: string; code?: string; color?: string }) =>
    request<Course>(`/api/v1/courses/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCourse: (id: string) =>
    request<void>(`/api/v1/courses/${id}`, { method: "DELETE" }),

  // --- Notas ---
  grades: (courseId?: string) =>
    request<Grade[]>(`/api/v1/grades${courseId ? `?course_id=${courseId}` : ""}`),
  gradeSummary: () => request<GradeSummary>("/api/v1/grades/summary"),
  createGrade: (body: {
    title: string;
    course_id?: string | null;
    score?: number | null;
    max_score?: number;
    weight?: number | null;
    graded_at?: string | null;
    notes?: string | null;
  }) => request<Grade>("/api/v1/grades", { method: "POST", body: JSON.stringify(body) }),
  updateGrade: (
    id: string,
    body: {
      title?: string;
      course_id?: string | null;
      score?: number | null;
      max_score?: number;
      weight?: number | null;
      graded_at?: string | null;
      notes?: string | null;
    },
  ) => request<Grade>(`/api/v1/grades/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteGrade: (id: string) =>
    request<void>(`/api/v1/grades/${id}`, { method: "DELETE" }),

  // --- Horario ---
  timetable: () => request<TimetableEntry[]>("/api/v1/timetable"),
  createTimetableEntry: (body: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    title?: string | null;
    course_id?: string | null;
    location?: string | null;
  }) =>
    request<TimetableEntry>("/api/v1/timetable", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteTimetableEntry: (id: string) =>
    request<void>(`/api/v1/timetable/${id}`, { method: "DELETE" }),
  tasks: (params?: { status?: string; course_id?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<Task[]>(`/api/v1/tasks${query ? `?${query}` : ""}`);
  },
  optimizedPlan: () => request<OptimizedPlan>("/api/v1/tasks/optimized"),
  replan: () => request<OptimizedPlan>("/api/v1/tasks/replan", { method: "POST" }),
  completeTask: (id: string) =>
    request<Task>(`/api/v1/tasks/${id}/complete`, { method: "POST" }),
  createTask: (body: {
    title: string;
    description?: string;
    due_at?: string;
    estimated_minutes?: number;
    course_id?: string;
  }) => request<Task>("/api/v1/tasks", { method: "POST", body: JSON.stringify(body) }),

  // --- Agenda y disponibilidad ---
  today: () => request<DailyAgenda>("/api/v1/schedule/today"),
  day: (date: string) => request<DailyAgenda>(`/api/v1/schedule/day?date=${date}`),
  scheduleBlocks: () => request<ScheduleBlock[]>("/api/v1/schedule/blocks"),
  createBlock: (body: Omit<ScheduleBlock, "id">) =>
    request<ScheduleBlock>("/api/v1/schedule/blocks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteBlock: (id: string) =>
    request<void>(`/api/v1/schedule/blocks/${id}`, { method: "DELETE" }),

  // --- Asistente de IA ---
  assistantStatus: () => request<AssistantStatus>("/api/v1/assistant/status"),
  getAiProfile: () => request<AssistantStatus>("/api/v1/assistant/profile"),
  updateAiProfile: (body: { provider: "local" | "gemini"; api_key?: string | null }) =>
    request<AssistantStatus>("/api/v1/assistant/profile", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  assistantMessages: (limit = 50) =>
    request<AssistantMessage[]>(`/api/v1/assistant/messages?limit=${limit}`),
  chat: (message: string, documentId?: string | null) =>
    request<ChatResponse>("/api/v1/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message, document_id: documentId ?? null }),
    }),
  confirmAction: (tool: string, args: Record<string, unknown>, approve: boolean) =>
    request<ChatResponse>("/api/v1/assistant/confirm", {
      method: "POST",
      body: JSON.stringify({ tool, args, approve }),
    }),
  clearAssistant: () =>
    request<void>("/api/v1/assistant/messages", { method: "DELETE" }),

  // --- Archivos (documentos por asignatura) ---
  files: (courseId?: string, classId?: string) => {
    const params = new URLSearchParams();
    if (courseId) params.set("course_id", courseId);
    if (classId) params.set("class_id", classId);
    const query = params.toString();
    return request<DocumentFile[]>(`/api/v1/files${query ? `?${query}` : ""}`);
  },
  uploadFile: (file: File, courseId?: string | null) => {
    const form = new FormData();
    form.append("file", file);
    if (courseId) form.append("course_id", courseId);
    return request<DocumentFile>("/api/v1/files", { method: "POST", body: form });
  },
  deleteFile: (id: string) =>
    request<void>(`/api/v1/files/${id}`, { method: "DELETE" }),
  // Devuelve una URL temporal (blob) para mostrar una imagen con autenticacion.
  fileObjectUrl: async (id: string): Promise<string> => {
    const token = tokenStore.get();
    const response = await fetch(`${resolveApiBase()}/api/v1/files/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new ApiError(response.status, "No se pudo cargar la imagen");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
  downloadFile: async (id: string, filename: string) => {
    const token = tokenStore.get();
    const response = await fetch(`${resolveApiBase()}/api/v1/files/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new ApiError(response.status, "No se pudo descargar el archivo");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  // --- Subidas por trozos (archivos grandes, reanudables) ---
  createUpload: (body: {
    filename: string;
    size_bytes: number;
    content_type?: string;
    course_id?: string | null;
    class_id?: string | null;
  }) =>
    request<UploadSession>("/api/v1/files/uploads", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  uploadStatus: (id: string) => request<UploadSession>(`/api/v1/files/uploads/${id}`),
  completeUpload: (id: string) =>
    request<DocumentFile>(`/api/v1/files/uploads/${id}/complete`, { method: "POST" }),
  abortUpload: (id: string) =>
    request<void>(`/api/v1/files/uploads/${id}`, { method: "DELETE" }),

  // --- Clases compartidas (codigo, chat, calendario y archivos) ---
  classes: () => request<SharedClass[]>("/api/v1/classes"),
  createClass: (body: { name: string; description?: string }) =>
    request<SharedClass>("/api/v1/classes", { method: "POST", body: JSON.stringify(body) }),
  joinClass: (code: string) =>
    request<SharedClass>("/api/v1/classes/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  classDetail: (id: string) => request<ClassDetail>(`/api/v1/classes/${id}`),
  updateClass: (id: string, body: { name?: string; description?: string | null }) =>
    request<SharedClass>(`/api/v1/classes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  regenerateClassCode: (id: string) =>
    request<SharedClass>(`/api/v1/classes/${id}/regenerate-code`, { method: "POST" }),
  deleteClass: (id: string) =>
    request<void>(`/api/v1/classes/${id}`, { method: "DELETE" }),
  leaveClass: (id: string) =>
    request<void>(`/api/v1/classes/${id}/leave`, { method: "POST" }),
  classMessages: (id: string, limit = 100) =>
    request<ClassMessage[]>(`/api/v1/classes/${id}/messages?limit=${limit}`),
  sendClassMessage: (id: string, body: { content: string; kind?: "message" | "announcement" }) =>
    request<ClassMessage>(`/api/v1/classes/${id}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateClassMessage: (id: string, messageId: string, body: { pinned: boolean }) =>
    request<ClassMessage>(`/api/v1/classes/${id}/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteClassMessage: (id: string, messageId: string) =>
    request<void>(`/api/v1/classes/${id}/messages/${messageId}`, { method: "DELETE" }),
  classEvents: (id: string) => request<ClassEvent[]>(`/api/v1/classes/${id}/events`),
  createClassEvent: (
    id: string,
    body: {
      title: string;
      start_at: string;
      end_at?: string | null;
      description?: string | null;
      location?: string | null;
      all_day?: boolean;
    },
  ) =>
    request<ClassEvent>(`/api/v1/classes/${id}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteClassEvent: (id: string, eventId: string) =>
    request<void>(`/api/v1/classes/${id}/events/${eventId}`, { method: "DELETE" }),
  classFiles: (id: string) => request<DocumentFile[]>(`/api/v1/files?class_id=${id}`),

  // --- IA Studio (resumenes e infografias en PDF) ---
  studioOutputs: () => request<AiOutput[]>("/api/v1/studio/outputs"),
  generateStudio: (documentId: string, kind: "summary" | "infographic") =>
    request<AiOutput>("/api/v1/studio/generate", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, kind }),
    }),
  deleteStudioOutput: (id: string) =>
    request<void>(`/api/v1/studio/outputs/${id}`, { method: "DELETE" }),
};
