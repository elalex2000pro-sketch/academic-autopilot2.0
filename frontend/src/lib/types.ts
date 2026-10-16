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
}

export interface Course {
  id: string;
  source: SourcePlatform;
  external_id: string;
  name: string;
  code: string | null;
  color: string | null;
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

export type AiOutputKind = "summary" | "infographic";

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

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  source: string | null;
  document_id: string | null;
  created_at: string;
}

export interface AssistantStatus {
  enabled: boolean;
  configured: boolean;
  model: string;
  vision_model: string;
  tools_enabled: boolean;
  base_url: string;
  provider: "local" | "gemini";
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
  course_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
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
