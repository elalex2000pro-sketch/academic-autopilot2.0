export type WorkState = "pending" | "in_progress" | "done";
export interface Person {
  id: string;
  username: string;
  name: string;
}
export interface Work {
  user: Person;
  state: WorkState;
  note: string | null;
  shared: boolean;
  files: { id: string; name: string; size: number }[];
}
export interface Task {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  due_at: string | null;
  topic_id: string | null;
  my_state: WorkState;
  completed_count: number;
  total_members: number;
  finished: Person[];
  attachments: { id: string; name: string }[];
  works: Work[];
}
export interface Topic {
  id: string;
  title: string;
  order: number;
  created_by: string;
}
export interface Comment {
  id: string;
  author: Person;
  content: string;
  created_at: string;
}
