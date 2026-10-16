import { Badge } from "@/components/ui/badge";
import type { TaskPriority } from "@/lib/types";

const LABELS: Record<TaskPriority, string> = {
  urgent: "Urgente",
  long_project: "Proyecto",
  short_task: "Tarea corta",
};

const VARIANTS: Record<TaskPriority, "destructive" | "default" | "secondary"> = {
  urgent: "destructive",
  long_project: "default",
  short_task: "secondary",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={VARIANTS[priority]}>{LABELS[priority]}</Badge>;
}
