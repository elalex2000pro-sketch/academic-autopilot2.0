// Cliente HTTP tipado para la API de Academic Autopilot.
import type {
  AiOutput,
  AssistantMessage,
  AssistantStatus,
  Book,
  BookAnswer,
  BookDetail,
  BookMessage,
  BookSection,
  BookSummary,
  ChatResponse,
  ClassAssignment,
  ClassDetail,
  ClassEvent,
  ClassMessage,
  Course,
  DailyAgenda,
  DocumentFile,
  Flashcard,
  FlashcardStats,
  FlashcardsGenerated,
  FocusSession,
  FocusStats,
  Grade,
  GradeSummary,
  Integration,
  Notebook,
  NotebookSource,
  OptimizedPlan,
  PendingAction,
  Provider,
  Quiz,
  QuizResult,
  ReminderSettings,
  ScheduleBlock,
  SharedClass,
  SyncLog,
  SyncResult,
  Task,
  TimetableEntry,
  TimetableImportResult,
  UploadSession,
  User,
} from "@/lib/types";
import {
  LOCAL_CACHE_EVENT,
  cacheApiResponse,
  readCachedApiResponse,
} from "@/lib/local-cache";

const TOKEN_KEY = "autopilot_token";

// Resuelve la base de la API en tiempo de ejecucion:
// - Desplegada (Vercel, Render, Caddy...): MISMO origen (rutas relativas). El
//   servidor reenvia /api/* al backend real (rewrites de Next en Vercel y
//   Render; Caddy en docker), asi el navegador nunca habla directamente con
//   otro dominio y no puede fallar por CORS ni por conexiones cruzadas.
// - Sirviendo en el puerto 3000 (dev) se apunta al backend en :8000 del mismo host.
function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3000") {
      return `${protocol}//${hostname}:8000`;
    }
    return "";
  }
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
  return configured || "http://localhost:8000";
}

// Base de la API (para peticiones que no pasan por `request`, como la subida
// por trozos con XMLHttpRequest).
export function apiBase(): string {
  return resolveApiBase();
}

// URL del WebSocket de sincronizacion en tiempo real. Se conecta DIRECTO al
// backend (NEXT_PUBLIC_API_URL) cuando esta configurado, porque los proxies
// HTTP no garantizan el reenvio de conexiones WebSocket de larga duracion;
// sin URL configurada se usa el mismo origen (dev/Caddy).
export function realtimeUrl(): string {
  if (typeof window === "undefined") return "";
  const token = tokenStore.get();
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
  const base =
    configured &&
    !configured.includes("localhost") &&
    !configured.includes("127.0.0.1")
      ? configured
      : resolveApiBase();
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

// Descarga autenticada de cualquier archivo generado por el backend.
async function downloadAuthenticated(path: string, filename: string, errorMessage: string) {
  const token = tokenStore.get();
  const response = await fetch(`${resolveApiBase()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new ApiError(response.status, errorMessage);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = tokenStore.get();
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${resolveApiBase()}${path}`, { ...options, headers });
  } catch {
    const cached = await readCachedApiResponse<T>(path);
    if (cached) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(LOCAL_CACHE_EVENT, { detail: { path, savedAt: cached.savedAt } }),
        );
      }
      return cached.data;
    }
    throw new ApiError(
      0,
      "No se pudo contactar con el servidor. Conéctate una vez para guardar una copia local.",
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Respuesta no JSON (p. ej. un error 500 en texto plano): se maneja abajo.
      data = null;
    }
  }

  if (!response.ok) {
    // El servidor puede estar despertando (Render) o caido: si ya hay copia
    // local, es mejor mostrar los datos guardados que una pantalla de error.
    if ([502, 503, 504].includes(response.status)) {
      const cached = await readCachedApiResponse<T>(path);
      if (cached) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(LOCAL_CACHE_EVENT, {
              detail: { path, savedAt: cached.savedAt },
            }),
          );
        }
        return cached.data;
      }
    }
    throw new ApiError(response.status, extractErrorMessage(response.status, data));
  }

  if (method === "GET" && data !== null) {
    // Se espera la escritura para que "Guardar copia local" no marque la copia
    // como completa antes de que IndexedDB haya guardado los datos.
    await cacheApiResponse(path, data);
  }
  return data as T;
}

// Mensaje legible para errores de la API sin romperse con cuerpos no JSON ni
// con los arrays de validacion de FastAPI.
function extractErrorMessage(status: number, data: unknown): string {
  const body = (data ?? {}) as { detail?: unknown; message?: unknown };
  const detail = body.detail ?? body.message;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string" && first.msg.trim()) return first.msg;
  }
  if (status >= 500) {
    return "Error interno del servidor. Intentalo de nuevo en unos segundos.";
  }
  return `Error ${status}`;
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
  createCourse: (body: { name: string; code?: string; color?: string; teacher?: string | null }) =>
    request<Course>("/api/v1/courses", { method: "POST", body: JSON.stringify(body) }),
  updateCourse: (
    id: string,
    body: { name?: string; code?: string; color?: string; teacher?: string | null },
  ) =>
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
    is_exam?: boolean;
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
      is_exam?: boolean;
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
  deleteTask: (id: string) =>
    request<void>(`/api/v1/tasks/${id}`, { method: "DELETE" }),
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
  updateAiProfile: (body: {
    provider: string;
    api_key?: string | null;
    model?: string | null;
    base_url?: string | null;
  }) =>
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
  assistantExport: () => request<AssistantMessage[]>("/api/v1/assistant/messages/export"),
  assistantImport: (messages: { role: string; content: string; created_at?: string | null }[]) =>
    request<{ imported: number }>("/api/v1/assistant/messages/import", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),

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
  // Descarga autenticada en memoria. Se usa para renderizar PDFs en canvas.
  fileBlob: async (id: string): Promise<Blob> => {
    const token = tokenStore.get();
    const response = await fetch(`${resolveApiBase()}/api/v1/files/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new ApiError(response.status, "No se pudo cargar el archivo");
    return response.blob();
  },
  // Devuelve una URL temporal (blob) para mostrar una imagen con autenticacion.
  fileObjectUrl: async (id: string): Promise<string> => {
    const blob = await api.fileBlob(id);
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

  // --- Cuadernos de notas ---
  notebooks: () => request<Notebook[]>("/api/v1/notebooks"),
  createNotebook: (body: { title?: string; color?: string; content?: string }) =>
    request<Notebook>("/api/v1/notebooks", { method: "POST", body: JSON.stringify(body) }),
  updateNotebook: (
    id: string,
    body: { title?: string; color?: string; content?: string },
  ) => request<Notebook>(`/api/v1/notebooks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteNotebook: (id: string) =>
    request<void>(`/api/v1/notebooks/${id}`, { method: "DELETE" }),
  downloadNotebookWord: (id: string, filename: string) =>
    downloadAuthenticated(
      `/api/v1/notebooks/${id}/word`,
      filename.endsWith(".docx") ? filename : `${filename}.docx`,
      "No se pudo exportar el cuaderno a Word",
    ),
  downloadStudioWord: (id: string, filename: string) =>
    downloadAuthenticated(
      `/api/v1/studio/outputs/${id}/word`,
      filename.endsWith(".docx") ? filename : `${filename}.docx`,
      "No se pudo exportar a Word",
    ),
  exportTasksExcel: () =>
    downloadAuthenticated(
      "/api/v1/exports/tasks.xlsx",
      "tareas-academic-autopilot.xlsx",
      "No se pudo exportar las tareas a Excel",
    ),
  exportNotebooksExcel: () =>
    downloadAuthenticated(
      "/api/v1/exports/notebooks.xlsx",
      "cuadernos-academic-autopilot.xlsx",
      "No se pudo exportar los cuadernos a Excel",
    ),
  shareNotebook: (id: string, body: { class_id: string; permission: "read" | "edit" }) =>
    request<Notebook>(`/api/v1/notebooks/${id}/share`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  unshareNotebook: (id: string) =>
    request<Notebook>(`/api/v1/notebooks/${id}/share`, { method: "DELETE" }),
  classNotebooks: (id: string) =>
    request<Notebook[]>(`/api/v1/classes/${id}/notebooks`),
  notebookSources: (id: string) =>
    request<NotebookSource[]>(`/api/v1/notebooks/${id}/sources`),
  addNotebookSource: (id: string, body: { book_id?: string; document_id?: string }) =>
    request<NotebookSource>(`/api/v1/notebooks/${id}/sources`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeNotebookSource: (id: string, sourceId: string) =>
    request<void>(`/api/v1/notebooks/${id}/sources/${sourceId}`, { method: "DELETE" }),

  // --- Repaso: flashcards y examenes ---
  flashcards: (params?: { due_only?: boolean; notebook_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.due_only) query.set("due_only", "true");
    if (params?.notebook_id) query.set("notebook_id", params.notebook_id);
    return request<Flashcard[]>(`/api/v1/flashcards${query.size ? `?${query}` : ""}`);
  },
  createFlashcard: (body: { front: string; back: string; notebook_id?: string | null }) =>
    request<Flashcard>("/api/v1/flashcards", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateFlashcard: (id: string, body: { front?: string; back?: string }) =>
    request<Flashcard>(`/api/v1/flashcards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteFlashcard: (id: string) =>
    request<void>(`/api/v1/flashcards/${id}`, { method: "DELETE" }),
  generateFlashcards: (notebookId: string) =>
    request<FlashcardsGenerated>("/api/v1/flashcards/generate", {
      method: "POST",
      body: JSON.stringify({ notebook_id: notebookId }),
    }),
  reviewFlashcard: (id: string, quality: number) =>
    request<{ card: Flashcard; next_due: string; interval_days: number }>(
      `/api/v1/flashcards/${id}/review`,
      { method: "POST", body: JSON.stringify({ quality }) },
    ),
  flashcardStats: () => request<FlashcardStats>("/api/v1/flashcards/stats"),
  quizzes: () => request<Quiz[]>("/api/v1/quizzes"),
  generateQuiz: (notebookId: string) =>
    request<Quiz>("/api/v1/quizzes/generate", {
      method: "POST",
      body: JSON.stringify({ notebook_id: notebookId }),
    }),
  submitQuiz: (id: string, answers: number[]) =>
    request<QuizResult>(`/api/v1/quizzes/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  deleteQuiz: (id: string) =>
    request<void>(`/api/v1/quizzes/${id}`, { method: "DELETE" }),

  // --- Enfoque (Pomodoro) ---
  focusStats: () => request<FocusStats>("/api/v1/focus/stats"),
  focusSessions: (limit = 20) =>
    request<FocusSession[]>(`/api/v1/focus/sessions?limit=${limit}`),
  logFocusSession: (minutes: number, kind: "focus" | "break" = "focus") =>
    request<FocusSession>("/api/v1/focus/sessions", {
      method: "POST",
      body: JSON.stringify({ minutes, kind }),
    }),

  // --- Recordatorios ---
  getReminders: () => request<ReminderSettings>("/api/v1/reminders"),
  updateReminders: (body: {
    enabled?: boolean;
    reminder_hour?: number;
    telegram_chat_id?: string | null;
    telegram_bot_token?: string | null;
  }) =>
    request<ReminderSettings>("/api/v1/reminders", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  testReminder: () =>
    request<{ ok: boolean; message: string }>("/api/v1/reminders/test", { method: "POST" }),

  // --- Importar horario y transcribir ---
  importTimetable: (documentId: string, replace = false) =>
    request<TimetableImportResult>("/api/v1/timetable/import", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, replace }),
    }),
  transcribe: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ text: string; filename: string }>("/api/v1/transcribe", {
      method: "POST",
      body: form,
    });
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
      is_exam?: boolean;
    },
  ) =>
    request<ClassEvent>(`/api/v1/classes/${id}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateClassEvent: (
    id: string,
    eventId: string,
    body: {
      title?: string;
      start_at?: string;
      end_at?: string | null;
      description?: string | null;
      location?: string | null;
      all_day?: boolean;
      is_exam?: boolean;
    },
  ) =>
    request<ClassEvent>(`/api/v1/classes/${id}/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteClassEvent: (id: string, eventId: string) =>
    request<void>(`/api/v1/classes/${id}/events/${eventId}`, { method: "DELETE" }),
  classFiles: (id: string) => request<DocumentFile[]>(`/api/v1/files?class_id=${id}`),

  // --- Trabajo de clase (tareas y entregas) ---
  classAssignments: (id: string) =>
    request<ClassAssignment[]>(`/api/v1/classes/${id}/assignments`),
  createClassAssignment: (
    id: string,
    body: { title: string; description?: string | null; due_at?: string | null },
  ) =>
    request<ClassAssignment>(`/api/v1/classes/${id}/assignments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateClassAssignment: (
    id: string,
    assignmentId: string,
    body: { title?: string; description?: string | null; due_at?: string | null },
  ) =>
    request<ClassAssignment>(`/api/v1/classes/${id}/assignments/${assignmentId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteClassAssignment: (id: string, assignmentId: string) =>
    request<void>(`/api/v1/classes/${id}/assignments/${assignmentId}`, {
      method: "DELETE",
    }),
  setAssignmentCompletion: (id: string, assignmentId: string, completed: boolean) =>
    request<ClassAssignment>(`/api/v1/classes/${id}/assignments/${assignmentId}/completion`, {
      method: "PUT",
      body: JSON.stringify({ completed }),
    }),

  // --- Biblioteca de libros completos ---
  books: () => request<Book[]>("/api/v1/books"),
  book: (id: string) => request<BookDetail>(`/api/v1/books/${id}`),
  importBook: (body: {
    document_id: string;
    title?: string | null;
    author?: string | null;
    course_id?: string | null;
  }) =>
    request<Book>("/api/v1/books/import", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBook: (
    id: string,
    body: { title?: string; author?: string | null; cover_color?: string; course_id?: string | null },
  ) =>
    request<Book>(`/api/v1/books/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteBook: (id: string) => request<void>(`/api/v1/books/${id}`, { method: "DELETE" }),
  reprocessBook: (id: string) =>
    request<Book>(`/api/v1/books/${id}/reprocess`, { method: "POST" }),
  bookSection: (id: string, index: number) =>
    request<BookSection>(`/api/v1/books/${id}/sections/${index}`),
  updateBookProgress: (id: string, body: { section_index: number; percent?: number }) =>
    request<Book>(`/api/v1/books/${id}/progress`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  askBook: (id: string, body: { question: string; section_index?: number | null }) =>
    request<BookAnswer>(`/api/v1/books/${id}/ask`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  bookMessages: (id: string) => request<BookMessage[]>(`/api/v1/books/${id}/messages`),
  clearBookMessages: (id: string) =>
    request<void>(`/api/v1/books/${id}/messages`, { method: "DELETE" }),
  bookSummary: (id: string, body: { scope: "current" | "book"; section_index?: number | null }) =>
    request<BookSummary>(`/api/v1/books/${id}/summary`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // --- IA Studio (resumenes e infografias en PDF) ---
  studioOutputs: () => request<AiOutput[]>("/api/v1/studio/outputs"),
  generateStudio: (documentId: string, kind: "summary" | "infographic" | "mindmap") =>
    request<AiOutput>("/api/v1/studio/generate", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, kind }),
    }),
  deleteStudioOutput: (id: string) =>
    request<void>(`/api/v1/studio/outputs/${id}`, { method: "DELETE" }),
};
