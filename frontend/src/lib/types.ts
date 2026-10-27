// Tipos compartidos con la API del backend (ver backend/app/schemas).

export type TaskPriority = "urgent" | "long_project" | "short_task";
export type TaskStatus = "pending" | "in_progress" | "completed" | "archived";
export type SourcePlatform = "moodle" | "google_classroom" | "manual";
export type Provider = "moodle" | "google_classroom" | "all";
export type SyncStatus = "success" | "partial" | "error";
export type IntegrationStatus = "connected" | "error" | "disabled";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  timezone: string;
  created_at: string;
  /** Pregunta configurada para recuperar la cuenta sin correo. */
  recovery_question?: string | null;
  /** True si la cuenta ya tiene pregunta y respuesta de seguridad. */
  has_recovery?: boolean;
}

export interface Course {
  id: string;
  source: SourcePlatform;
  external_id: string;
  name: string;
  code: string | null;
  color: string | null;
  teacher?: string | null;
}

export interface Grade {
  id: string;
  course_id: string | null;
  title: string;
  score: number | null;
  max_score: number;
  weight: number | null;
  graded_at: string | null;
  notes: string | null;
  is_exam: boolean;
  percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface CourseGradeSummary {
  course_id: string | null;
  course_name: string | null;
  average_percent: number | null;
  graded_count: number;
  total_weight: number | null;
}

export interface GradeSummary {
  overall_average_percent: number | null;
  graded_count: number;
  courses: CourseGradeSummary[];
}

export interface TimetableEntry {
  id: string;
  course_id: string | null;
  title: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
}

export type AiOutputKind = "summary" | "infographic" | "mindmap";

export interface AiOutput {
  id: string;
  source_document_id: string | null;
  output_document_id: string | null;
  kind: AiOutputKind | string;
  title: string;
  content: string;
  source: string | null;
  created_at: string;
}

export interface ChatAttachment {
  name: string;
  mime_type: string;
  /** Base64 de la imagen que se envía a la IA (solo en el borrador). */
  data?: string;
  /** Miniatura en data URL que se muestra antes y después de enviar. */
  preview?: string | null;
  page?: number | null;
  total_pages?: number | null;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  source: string | null;
  document_id: string | null;
  attachments?: ChatAttachment[] | null;
  created_at: string;
}

export interface AssistantStatus {
  enabled: boolean;
  configured: boolean;
  model: string;
  vision_model: string;
  tools_enabled: boolean;
  base_url: string;
  provider: string;
  has_api_key: boolean;
}

export interface PendingAction {
  tool: string;
  args: Record<string, unknown>;
}

export interface ChatResponse {
  reply: string;
  source: string;
  created_at: string;
  document_id: string | null;
  pending_action: PendingAction | null;
}

export interface DocumentFile {
  id: string;
  user_id: string;
  course_id: string | null;
  class_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

// --- Subidas por trozos (archivos grandes) ---
export interface UploadSession {
  id: string;
  filename: string;
  size_bytes: number;
  received_bytes: number;
  chunk_size: number;
  status: string;
  created_at: string;
}

// --- Clases compartidas ---
export interface SharedClass {
  id: string;
  name: string;
  description: string | null;
  code: string;
  owner_id: string;
  created_at: string;
  member_count: number;
  my_role: "owner" | "member" | string;
}

export interface ClassMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  joined_at: string;
}

export interface ClassDetail extends SharedClass {
  members: ClassMember[];
}

export interface ClassMessage {
  id: string;
  class_id: string;
  user_id: string;
  author_name: string | null;
  content: string;
  kind: "message" | "announcement" | string;
  pinned: boolean;
  created_at: string;
}

export interface ClassEvent {
  id: string;
  class_id: string;
  created_by: string;
  creator_name: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  is_exam: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  course_id: string | null;
  source: SourcePlatform;
  external_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  estimated_minutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  target_start_at: string | null;
  target_end_at: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OptimizedPlanItem {
  task_id: string;
  parent_task_id: string | null;
  title: string;
  course_name: string | null;
  priority: TaskPriority;
  estimated_minutes: number;
  due_at: string | null;
  effective_due_at: string | null;
  start_at: string;
  end_at: string;
}

export interface OptimizedPlan {
  generated_at: string;
  scheduled: OptimizedPlanItem[];
  unscheduled_task_ids: string[];
  total_scheduled_minutes: number;
}

export interface DailyAgendaItem {
  task_id: string;
  title: string;
  course_name: string | null;
  priority: TaskPriority;
  start_at: string;
  end_at: string;
  completed: boolean;
}

export interface DailyAgenda {
  day: string;
  items: DailyAgendaItem[];
  total_minutes: number;
  completed_minutes: number;
  progress_percent: number;
}

export interface ScheduleBlock {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string | null;
  is_active: boolean;
}

export interface Integration {
  id: string;
  provider: Provider;
  status: IntegrationStatus;
  base_url: string | null;
  expires_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface SyncLog {
  id: string;
  provider: Provider;
  status: SyncStatus;
  started_at: string;
  finished_at: string | null;
  created: number;
  updated: number;
  removed: number;
  message: string | null;
  errors: { provider: string; message: string }[];
}

export interface SyncResult {
  provider: Provider;
  status: SyncStatus;
  created: number;
  updated: number;
  removed: number;
  message: string | null;
  errors: { provider: string; message: string }[];
}

export interface Notebook {
  id: string;
  user_id: string;
  title: string;
  color: string;
  content: string;
  shared_class_id: string | null;
  share_permission: "read" | "edit" | string;
  created_at: string;
  updated_at: string;
}

export interface NotebookSource {
  id: string;
  notebook_id: string;
  kind: "book" | "file" | string;
  title: string;
  subtitle: string | null;
  book_id: string | null;
  document_id: string | null;
  format: string | null;
  size_bytes: number;
  created_at: string;
}

// --- Repaso: flashcards y examenes ---
export interface Flashcard {
  id: string;
  notebook_id: string | null;
  front: string;
  back: string;
  source: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  created_at: string;
}

export interface FlashcardStats {
  total: number;
  due: number;
}

export interface FlashcardsGenerated {
  created: number;
  source: string;
  flashcards: Flashcard[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string | null;
}

export interface Quiz {
  id: string;
  notebook_id: string | null;
  title: string;
  source: string;
  questions: QuizQuestion[];
  score: number | null;
  total: number;
  completed_at: string | null;
  created_at: string;
}

export interface QuizResult {
  quiz: Quiz;
  score: number;
  total: number;
  details: boolean[];
}

// --- Enfoque (Pomodoro) ---
export interface FocusSession {
  id: string;
  minutes: number;
  kind: "focus" | "break" | string;
  finished_at: string;
}

export interface FocusDay {
  date: string;
  minutes: number;
}

export interface FocusStats {
  today_minutes: number;
  week_minutes: number;
  streak_days: number;
  total_sessions: number;
  days: FocusDay[];
}

// --- Recordatorios ---
export interface ReminderSettings {
  enabled: boolean;
  reminder_hour: number;
  telegram_chat_id: string | null;
  has_token: boolean;
}

export interface TimetableImportResult {
  created: number;
  source: string;
  entries: TimetableEntry[];
}

// --- Biblioteca de libros completos ---
export interface Book {
  id: string;
  user_id: string;
  course_id: string | null;
  document_id: string | null;
  title: string;
  author: string | null;
  format: string;
  cover_color: string;
  status: "processing" | "ready" | "error" | string;
  error_message: string | null;
  total_sections: number;
  total_chars: number;
  text_available?: boolean;
  current_section_index: number;
  progress_percent: number;
  last_opened_at: string | null;
  source_filename: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  current_section_title: string | null;
  estimated_minutes: number;
}

export interface BookSectionMeta {
  id: string;
  section_index: number;
  title: string;
  char_count: number;
  page_start: number | null;
  page_end: number | null;
}

export interface BookSection extends BookSectionMeta {
  content: string;
}

export interface BookDetail extends Book {
  sections: BookSectionMeta[];
}

export interface BookCitation {
  section_id: string;
  section_index: number;
  title: string;
  quote: string;
  page_start: number | null;
  page_end: number | null;
}

export interface BookAnswer {
  answer: string;
  citations: BookCitation[];
  source: "ai" | "extractive" | "heuristic" | string;
  notice: string | null;
  created_at: string;
}

export interface BookSummary {
  title: string;
  summary: string;
  key_points: string[];
  citations: BookCitation[];
  source: "ai" | "extractive" | "heuristic" | string;
  notice: string | null;
}

export interface BookMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  citations: BookCitation[];
  source: string;
  created_at: string;
}

// --- Trabajo de clase (estilo Classroom) ---
export interface ClassAssignment {
  id: string;
  class_id: string;
  created_by: string;
  creator_name: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  created_at: string;
  my_completed: boolean;
  completed_count: number;
  total_members: number;
}
