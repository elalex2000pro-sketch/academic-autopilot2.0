"use client";

import { ClassworkBoard } from "@/components/class/classwork-board";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  FolderOpen,
  KeyRound,
  Loader2,
  LogOut,
  Megaphone,
  MessageSquare,
  NotebookPen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/auth-provider";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import { getDeletedClassIds } from "@/lib/class-cache";
import { normalizeFilename } from "@/lib/filename";
import { uploadFileInChunks, type UploadProgress } from "@/lib/upload";
import type {
  ClassAssignment,
  ClassDetail,
  ClassEvent,
  ClassMessage,
  DocumentFile,
  Notebook,
} from "@/lib/types";

type Tab = "work" | "calendar" | "notebooks";

// El chat, los archivos y los miembros viven siempre en la vista de 3 columnas;
// estas pestañas añaden el resto de secciones de la clase.
const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "work", label: "Trabajo", icon: ClipboardCheck },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "notebooks", label: "Cuadernos", icon: NotebookPen },
];

const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const ACCEPT =
  ".pdf,.epub,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.gif";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDueDate(iso: string | null): string {
  if (!iso) return "Sin fecha límite";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sin fecha límite";
  return date.toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toDateInput(iso: string | null): string {
  const value = toDateTimeLocal(iso);
  return value ? value.slice(0, 10) : "";
}

function toTimeInput(iso: string | null): string {
  const value = toDateTimeLocal(iso);
  return value ? value.slice(11, 16) : "";
}

type ClassRealtimePayload = {
  class_id?: string;
  action?: string;
  message?: ClassMessage;
  message_id?: string;
  assignment?: ClassAssignment;
  assignment_id?: string;
  event?: ClassEvent;
  event_id?: string;
  user_id?: string;
  completed?: boolean;
  completed_count?: number;
  total_members?: number;
};

function messageTime(message: ClassMessage): number {
  const value = new Date(message.created_at).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function mergeClassMessage(
  current: ClassMessage[],
  incoming: ClassMessage,
  meId: string,
): ClassMessage[] {
  const withoutIncoming = current.filter((message) => message.id !== incoming.id);
  const withoutOptimistic =
    incoming.user_id === meId
      ? withoutIncoming.filter(
          (message) =>
            !(
              message.pending &&
              message.content === incoming.content &&
              message.kind === incoming.kind
            ),
        )
      : withoutIncoming;
  return [...withoutOptimistic, incoming].sort(
    (a, b) => messageTime(a) - messageTime(b),
  );
}

function reconcileClassMessage(
  current: ClassMessage[],
  tempId: string,
  created: ClassMessage,
): ClassMessage[] {
  const withoutStale = current.filter(
    (message) => message.id !== tempId && message.id !== created.id,
  );
  return [...withoutStale, created].sort((a, b) => messageTime(a) - messageTime(b));
}

function formatEventRange(event: ClassEvent): string {
  const start = new Date(event.start_at);
  const startText = start.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!event.end_at) return startText;
  const end = new Date(event.end_at);
  const sameDay = localDayKey(start) === localDayKey(end);
  const endText = sameDay
    ? end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : end.toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
  return `${startText} - ${endText}`;
}

export default function ClassDetailView() {
  const params = useParams<{ id: string }>();
  const classId = (params?.id as string) ?? "";
  const router = useRouter();
  const { user } = useAuth();

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareDatesOpen, setShareDatesOpen] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = detail?.my_role === "owner";

  const loadAll = useCallback(async () => {
    if (!classId) return;
    if (getDeletedClassIds().has(classId)) {
      router.replace("/classes");
      return;
    }
    const [info, msgs, evs, fls, nbs] = await Promise.all([
      api.classDetail(classId),
      api.classMessages(classId),
      api.classEvents(classId),
      api.classFiles(classId),
      api.classNotebooks(classId),
    ]);
    setDetail(info);
    setMessages(msgs);
    setEvents(evs);
    setFiles(fls);
    setNotebooks(nbs);
    setAssignments(await api.classAssignments(classId));
  }, [classId, router]);

  useEffect(() => {
    loadAll()
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [loadAll]);

  useRealtime((event) => {
    if (event.event !== "classes") return;
    const data = event.data as ClassRealtimePayload | undefined;
    if (data?.class_id !== classId) return;

    switch (data.action) {
      case "deleted":
      case "left":
        router.push("/classes");
        return;
      case "message_created": {
        if (data.message) {
          setMessages((prev) =>
            mergeClassMessage(prev, data.message as ClassMessage, user?.id ?? ""),
          );
        }
        return;
      }
      case "message_updated": {
        if (data.message) {
          const incoming = data.message;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === incoming.id ? { ...message, ...incoming } : message,
            ),
          );
        }
        return;
      }
      case "message_deleted": {
        if (data.message_id) {
          setMessages((prev) =>
            prev.filter((message) => message.id !== data.message_id),
          );
        }
        return;
      }
      case "assignment_created": {
        if (data.assignment) {
          const incoming = data.assignment;
          setAssignments((prev) =>
            prev.some((item) => item.id === incoming.id)
              ? prev.map((item) =>
                  item.id === incoming.id ? { ...item, ...incoming } : item,
                )
              : [incoming, ...prev],
          );
        }
        return;
      }
      case "assignment_updated": {
        if (data.assignment) {
          const incoming = data.assignment;
          setAssignments((prev) =>
            prev.map((item) =>
              item.id === incoming.id
                ? { ...item, ...incoming, my_completed: item.my_completed }
                : item,
            ),
          );
        }
        return;
      }
      case "assignment_completion": {
        if (data.assignment_id) {
          const completedByMe = data.user_id === user?.id;
          setAssignments((prev) =>
            prev.map((item) =>
              item.id === data.assignment_id
                ? {
                    ...item,
                    completed_count: data.completed_count ?? item.completed_count,
                    total_members: data.total_members ?? item.total_members,
                    my_completed: completedByMe
                      ? Boolean(data.completed)
                      : item.my_completed,
                  }
                : item,
            ),
          );
        }
        return;
      }
      case "assignment_deleted": {
        if (data.assignment_id) {
          setAssignments((prev) =>
            prev.filter((item) => item.id !== data.assignment_id),
          );
        }
        return;
      }
      case "event_created":
      case "event_updated": {
        if (data.event) {
          const incoming = data.event;
          setEvents((prev) =>
            [...prev.filter((item) => item.id !== incoming.id), incoming].sort(
              (a, b) => a.start_at.localeCompare(b.start_at),
            ),
          );
        }
        return;
      }
      case "event_deleted": {
        if (data.event_id) {
          setEvents((prev) => prev.filter((item) => item.id !== data.event_id));
        }
        return;
      }
      default:
        // Cambios de metadatos o miembros: ahi si conviene releer el detalle.
        loadAll().catch(() => undefined);
    }
  });

  // ------------------------------------------------------------- cabecera
  async function copyCode() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("No se pudo copiar el codigo");
    }
  }

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  function startEditing() {
    if (!detail) return;
    setEditName(detail.name);
    setEditDescription(detail.description ?? "");
    setEditing(true);
  }

  async function saveEditing(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    try {
      const updated = await api.updateClass(classId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function regenerateCode() {
    if (
      !window.confirm(
        "Se generara un codigo nuevo. El codigo actual dejara de servir para unirse. ¿Continuar?",
      )
    )
      return;
    try {
      const updated = await api.regenerateClassCode(classId);
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
      setCopied(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function deleteClass() {
    if (
      !window.confirm(
        "Se eliminara la clase con su chat, calendario y archivos compartidos. ¿Seguro?",
      )
    )
      return;
    try {
      await api.deleteClass(classId);
      setDetail(null);
      router.push("/classes");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function leaveClass() {
    if (!window.confirm("¿Salir de la clase? Podras volver con el codigo.")) return;
    try {
      await api.leaveClass(classId);
      setDetail(null);
      router.push("/classes");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // ------------------------------------------------------------------ chat
  const [draft, setDraft] = useState("");
  const [asAnnouncement, setAsAnnouncement] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // El tablón está siempre visible: al llegar un mensaje, baja hasta el final.
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const pinnedMessages = useMemo(() => messages.filter((m) => m.pinned), [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    const kind = isOwner && asAnnouncement ? "announcement" : "message";
    const tempId = `pending-${
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Date.now().toString(36)
    }`;
    const optimistic: ClassMessage = {
      id: tempId,
      class_id: classId,
      user_id: user?.id ?? "",
      author_name: user?.full_name?.trim() || user?.email || "Tu",
      content,
      kind,
      pinned: kind === "announcement",
      created_at: new Date().toISOString(),
      pending: true,
    };

    setSending(true);
    setError(null);
    setDraft("");
    setMessages((prev) => mergeClassMessage(prev, optimistic, user?.id ?? ""));

    try {
      const message = await api.sendClassMessage(classId, { content, kind });
      setMessages((prev) => reconcileClassMessage(prev, tempId, message));
      setAsAnnouncement(false);
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== tempId));
      setDraft((current) => (current.trim() ? current : content));
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function togglePin(message: ClassMessage) {
    try {
      const updated = await api.updateClassMessage(classId, message.id, {
        pinned: !message.pinned,
      });
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ...updated } : m)));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeMessage(message: ClassMessage) {
    if (!window.confirm("¿Borrar este mensaje?")) return;
    try {
      await api.deleteClassMessage(classId, message.id);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // ----------------------------------------------------------- trabajo de clase
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentDue, setAssignmentDue] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [updatingAssignmentId, setUpdatingAssignmentId] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<ClassAssignment | null>(null);
  const [editAssignmentTitle, setEditAssignmentTitle] = useState("");
  const [editAssignmentDescription, setEditAssignmentDescription] = useState("");
  const [editAssignmentDue, setEditAssignmentDue] = useState("");
  const [savingAssignmentEdit, setSavingAssignmentEdit] = useState(false);

  const pendingAssignments = useMemo(
    () => assignments.filter((assignment) => !assignment.my_completed),
    [assignments],
  );
  const finishedAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.my_completed),
    [assignments],
  );
  const myAssignmentProgress =
    assignments.length === 0
      ? 0
      : Math.round((finishedAssignments.length / assignments.length) * 100);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!assignmentTitle.trim() || savingAssignment) return;
    setSavingAssignment(true);
    setError(null);
    try {
      const created = await api.createClassAssignment(classId, {
        title: assignmentTitle.trim(),
        description: assignmentDescription.trim() || null,
        due_at: assignmentDue ? new Date(assignmentDue).toISOString() : null,
      });
      setAssignments((prev) =>
        prev.some((item) => item.id === created.id)
          ? prev.map((item) => (item.id === created.id ? created : item))
          : [created, ...prev],
      );
      setAssignmentTitle("");
      setAssignmentDescription("");
      setAssignmentDue("");
      setShowAssignmentForm(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingAssignment(false);
    }
  }

  async function toggleAssignment(assignment: ClassAssignment) {
    setUpdatingAssignmentId(assignment.id);
    setError(null);
    try {
      const updated = await api.setAssignmentCompletion(
        classId,
        assignment.id,
        !assignment.my_completed,
      );
      setAssignments((prev) =>
        prev.map((item) => (item.id === assignment.id ? updated : item)),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUpdatingAssignmentId(null);
    }
  }

  async function removeAssignment(assignment: ClassAssignment) {
    if (!window.confirm(`¿Eliminar la tarea "${assignment.title}" de la clase?`)) return;
    try {
      await api.deleteClassAssignment(classId, assignment.id);
      setAssignments((prev) => prev.filter((item) => item.id !== assignment.id));
      if (editingAssignment?.id === assignment.id) setEditingAssignment(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function startEditAssignment(assignment: ClassAssignment) {
    setEditingAssignment(assignment);
    setEditAssignmentTitle(assignment.title);
    setEditAssignmentDescription(assignment.description ?? "");
    setEditAssignmentDue(toDateTimeLocal(assignment.due_at));
    setShowAssignmentForm(false);
  }

  function cancelEditAssignment() {
    setEditingAssignment(null);
    setEditAssignmentTitle("");
    setEditAssignmentDescription("");
    setEditAssignmentDue("");
  }

  async function saveAssignmentEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAssignment || !editAssignmentTitle.trim() || savingAssignmentEdit) return;
    setSavingAssignmentEdit(true);
    setError(null);
    try {
      const updated = await api.updateClassAssignment(classId, editingAssignment.id, {
        title: editAssignmentTitle.trim(),
        description: editAssignmentDescription.trim() || null,
        due_at: editAssignmentDue ? new Date(editAssignmentDue).toISOString() : null,
      });
      setAssignments((prev) =>
        prev.map((item) => (item.id === editingAssignment.id ? updated : item)),
      );
      cancelEditAssignment();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingAssignmentEdit(false);
    }
  }

  function renderAssignmentEditor(assignment: ClassAssignment) {
    return (
      <form
        onSubmit={saveAssignmentEdit}
        className="space-y-2.5 rounded-xl border border-[#0066FF]/25 bg-[#0066FF]/[0.04] p-3"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0066FF] dark:text-[#8ab9ff]">
          Editar tarea
        </p>
        <Input
          value={editAssignmentTitle}
          onChange={(event) => setEditAssignmentTitle(event.target.value)}
          placeholder="Título de la tarea"
          maxLength={300}
          required
          aria-label={`Título de ${assignment.title}`}
        />
        <Input
          value={editAssignmentDescription}
          onChange={(event) => setEditAssignmentDescription(event.target.value)}
          placeholder="Detalles (opcional)"
          maxLength={4000}
          aria-label="Detalles de la tarea"
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[190px] flex-1 space-y-1">
            <Label htmlFor={`assignment-edit-due-${assignment.id}`} className="text-[11px]">
              Fecha límite
            </Label>
            <Input
              id={`assignment-edit-due-${assignment.id}`}
              type="datetime-local"
              value={editAssignmentDue}
              onChange={(event) => setEditAssignmentDue(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={savingAssignmentEdit || !editAssignmentTitle.trim()}>
            {savingAssignmentEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cancelEditAssignment}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  // ------------------------------------------------------------ calendario
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => localDayKey(new Date()));
  const [eventStart, setEventStart] = useState("18:00");
  const [eventEnd, setEventEnd] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventIsExam, setEventIsExam] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const eventFormRef = useRef<HTMLFormElement>(null);

  const monthLabel = useMemo(() => {
    const label = month.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ClassEvent[]>();
    for (const event of events) {
      const key = localDayKey(new Date(event.start_at));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    return cells;
  }, [month]);

  const upcomingEvents = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return [...events]
      .filter((event) => new Date(event.start_at).getTime() >= todayStart.getTime())
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [events]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate || !eventStart || savingEvent) return;
    const start = new Date(`${eventDate}T${eventStart}:00`);
    if (Number.isNaN(start.getTime())) {
      setError("La fecha u hora de inicio no son validas");
      return;
    }
    let endIso: string | null = null;
    if (eventEnd) {
      const end = new Date(`${eventDate}T${eventEnd}:00`);
      if (Number.isNaN(end.getTime()) || end < start) {
        setError("La hora de fin no es valida");
        return;
      }
      endIso = end.toISOString();
    }
    setSavingEvent(true);
    setError(null);
    try {
      const payload = {
        title: eventTitle.trim(),
        start_at: start.toISOString(),
        end_at: endIso,
        location: eventLocation.trim() || null,
        description: eventDescription.trim() || null,
        is_exam: eventIsExam,
      };
      if (editingEventId) {
        const updated = await api.updateClassEvent(classId, editingEventId, payload);
        setEvents((prev) =>
          prev
            .map((event) => (event.id === editingEventId ? updated : event))
            .sort((a, b) => a.start_at.localeCompare(b.start_at)),
        );
      } else {
        const created = await api.createClassEvent(classId, payload);
        setEvents((prev) =>
          [...prev.filter((event) => event.id !== created.id), created].sort((a, b) =>
            a.start_at.localeCompare(b.start_at),
          ),
        );
      }
      resetEventForm();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingEvent(false);
    }
  }

  function resetEventForm() {
    setEditingEventId(null);
    setEventTitle("");
    setEventEnd("");
    setEventLocation("");
    setEventDescription("");
    setEventIsExam(false);
  }

  function startEditEvent(event: ClassEvent) {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventDate(toDateInput(event.start_at) || localDayKey(new Date()));
    setEventStart(toTimeInput(event.start_at) || "18:00");
    setEventEnd(event.end_at ? toTimeInput(event.end_at) : "");
    setEventLocation(event.location ?? "");
    setEventDescription(event.description ?? "");
    setEventIsExam(event.is_exam);
    requestAnimationFrame(() => {
      eventFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function removeEvent(event: ClassEvent) {
    if (!window.confirm(`¿Eliminar "${event.title}"?`)) return;
    try {
      await api.deleteClassEvent(classId, event.id);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // --------------------------------------------------------------- archivos
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setProgress({ uploadedBytes: 0, totalBytes: file.size, percent: 0 });
    setError(null);
    try {
      const document = await uploadFileInChunks(file, {
        classId,
        onProgress: setProgress,
      });
      setFiles((prev) => [document, ...prev]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  const downloadFile = useCallback(async (file: DocumentFile) => {
    try {
      await api.downloadFile(file.id, file.filename);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  const removeFile = useCallback(async (file: DocumentFile) => {
    if (!window.confirm(`¿Borrar "${normalizeFilename(file.filename)}"?`)) return;
    try {
      await api.deleteFile(file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  const canDeleteFile = useCallback(
    (file: DocumentFile) => file.user_id === user?.id || isOwner,
    [user?.id, isOwner],
  );

  // -------------------------------------------------------------- cuadernos
  const [openNotebook, setOpenNotebook] = useState<Notebook | null>(null);
  const [notebookDraft, setNotebookDraft] = useState("");
  const [savingNotebook, setSavingNotebook] = useState(false);

  function openSharedNotebook(notebook: Notebook) {
    setOpenNotebook(notebook);
    setNotebookDraft(notebook.content ?? "");
  }

  const canEditNotebook =
    openNotebook !== null &&
    (openNotebook.user_id === user?.id || openNotebook.share_permission === "edit");

  async function saveSharedNotebook() {
    if (!openNotebook) return;
    setSavingNotebook(true);
    try {
      const updated = await api.updateNotebook(openNotebook.id, { content: notebookDraft });
      setNotebooks((prev) =>
        prev.map((notebook) => (notebook.id === updated.id ? updated : notebook)),
      );
      setOpenNotebook(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingNotebook(false);
    }
  }

  // ------------------------------------------------------------------ render
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando clase...
        </p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error ?? "No se pudo cargar la clase"}
        </div>
        <Link href="/classes" className="text-sm text-primary underline-offset-4 hover:underline">
          Volver a Aulas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <Link
        href="/classes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Aulas
      </Link>

      {/* Cabecera de la clase */}
      <Card>
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl">{detail.name}</CardTitle>
              {detail.description && (
                <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>
              )}
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {detail.member_count} {detail.member_count === 1 ? "miembro" : "miembros"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyCode}
                title="Copiar codigo para invitar"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 font-mono text-sm tracking-widest transition-colors hover:bg-accent"
              >
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                {detail.code}
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              {isOwner && (
                <>
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    Renombrar
                  </Button>
                  <Button variant="outline" size="sm" onClick={regenerateCode}>
                    Nuevo codigo
                  </Button>
                  <Button variant="destructive" size="sm" onClick={deleteClass}>
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </Button>
                </>
              )}
              {!isOwner && (
                <Button variant="outline" size="sm" onClick={leaveClass}>
                  <LogOut className="h-4 w-4" /> Salir
                </Button>
              )}
            </div>
          </div>

          {editing && (
            <form onSubmit={saveEditing} className="space-y-2 rounded-md border border-border/60 p-3">
              <div className="space-y-1">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-description">Descripcion</Label>
                <Input
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={2000}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={!editName.trim()}>
                  Guardar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </CardHeader>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Pestanas */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-card p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab((current) => (current === id ? null : id))}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(170px,210px)_minmax(0,1fr)_minmax(220px,290px)]">
        {/* ---------------------------------------------------------------- Chat */}
        <Card className="order-2 xl:col-start-2 xl:row-start-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tablón de la clase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {pinnedMessages.length > 0 && (
              <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="flex items-center gap-1 text-xs font-medium text-amber-500">
                  <Megaphone className="h-3.5 w-3.5" /> Anuncios fijados
                </p>
                {pinnedMessages.map((message) => (
                  <div key={`pinned-${message.id}`} className="text-sm">
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {message.author_name ?? "Alguien"} - {formatDateTime(message.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Todavia no hay mensajes. Escribe el primero para empezar la conversacion.
                </p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    message.kind === "announcement"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1">
                      {message.kind === "announcement" && (
                        <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                      <span className="truncate font-medium text-foreground/80">
                        {message.author_name ?? "Alguien"}
                        {message.user_id === user?.id ? " (tu)" : ""}
                      </span>
                      {message.pinned && <Pin className="h-3 w-3 shrink-0" />}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {message.pending ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Enviando
                        </span>
                      ) : (
                        formatDateTime(message.created_at)
                      )}
                      {!message.pending && isOwner && (
                        <button
                          type="button"
                          onClick={() => togglePin(message)}
                          title={message.pinned ? "Desfijar" : "Fijar"}
                          className="rounded p-0.5 hover:bg-accent"
                        >
                          {message.pinned ? (
                            <PinOff className="h-3.5 w-3.5" />
                          ) : (
                            <Pin className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      {!message.pending && (message.user_id === user?.id || isOwner) && (
                        <button
                          type="button"
                          onClick={() => removeMessage(message)}
                          title="Borrar mensaje"
                          className="rounded p-0.5 hover:bg-accent"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribe un mensaje..."
                rows={2}
                maxLength={4000}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {isOwner ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={asAnnouncement}
                      onChange={(e) => setAsAnnouncement(e.target.checked)}
                    />
                    Publicar como anuncio (se fija arriba)
                  </label>
                ) : (
                  <span />
                )}
                <Button type="submit" size="sm" disabled={!draft.trim() || sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      {/* ------------------------------------------------------------- Calendario */}
      {tab === "calendar" && (
        <div className="order-4 space-y-4 xl:col-span-full xl:row-start-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base">{monthLabel}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Comparte una fecha de tu calendario personal para que la vea toda la clase.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShareDatesOpen(true)}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Compartir fechas de mi calendario
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="pb-1 text-center text-xs text-muted-foreground">
                    {day}
                  </div>
                ))}
                {grid.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} />;
                  }
                  const key = localDayKey(day);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const isToday = localDayKey(new Date()) === key;
                  const isSelected = eventDate === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      data-touch-compact
                      onClick={() => setEventDate(key)}
                      className={`min-h-[64px] rounded-md border p-1 text-left transition-colors hover:border-primary/50 ${
                        isSelected ? "border-primary" : "border-border/50"
                      } ${isToday ? "bg-primary/5" : ""}`}
                    >
                      <span
                        className={`text-xs ${
                          isToday ? "font-semibold text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`truncate rounded px-1 py-0.5 text-[10px] ${
                              event.is_exam
                                ? "bg-red-50 font-semibold text-red-600"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{dayEvents.length - 2} mas
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {editingEventId ? "Editar evento" : "Anadir evento"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form ref={eventFormRef} onSubmit={createEvent} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="event-title">Titulo</Label>
                    <Input
                      id="event-title"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Examen de Calculo"
                      maxLength={300}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3 space-y-1 sm:col-span-1">
                      <Label htmlFor="event-date">Dia</Label>
                      <Input
                        id="event-date"
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="event-start">Inicio</Label>
                      <Input
                        id="event-start"
                        type="time"
                        value={eventStart}
                        onChange={(e) => setEventStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="event-end">Fin (opcional)</Label>
                      <Input
                        id="event-end"
                        type="time"
                        value={eventEnd}
                        onChange={(e) => setEventEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="event-location">Lugar (opcional)</Label>
                    <Input
                      id="event-location"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="Aula 3 / Zoom"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="event-description">Descripcion (opcional)</Label>
                    <Input
                      id="event-description"
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      maxLength={2000}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={eventIsExam}
                      onChange={(e) => setEventIsExam(e.target.checked)}
                    />
                    Es un examen (se resalta en rojo para toda la clase)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!eventTitle.trim() || savingEvent}
                    >
                      {savingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {editingEventId ? "Guardar cambios" : "Crear evento"}
                    </Button>
                    {editingEventId && (
                      <Button type="button" size="sm" variant="ghost" onClick={resetEventForm}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Proximos eventos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingEvents.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay eventos proximos. Crea uno para que lo vea toda la clase.
                  </p>
                )}
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                      event.is_exam ? "border-red-300 bg-red-50/70" : "border-border/60"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium">
                        {event.is_exam && (
                          <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                            Examen
                          </span>
                        )}
                        <span className="truncate">{event.title}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatEventRange(event)}
                        {event.location ? ` - ${event.location}` : ""}
                      </p>
                      {event.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Creado por {event.creator_name ?? "alguien"}
                      </p>
                    </div>
                    {(event.created_by === user?.id || isOwner) && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditEvent(event)}
                          title="Editar evento"
                          aria-label={`Editar ${event.title}`}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-[#0066FF] dark:hover:text-[#8ab9ff]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEvent(event)}
                          title="Eliminar evento"
                          aria-label={`Eliminar ${event.title}`}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {shareDatesOpen && detail ? (
        <ShareDatesDialog
          classId={detail.id}
          existing={events}
          onClose={() => setShareDatesOpen(false)}
          onCreated={(created) => setEvents((current) => [...current, ...created])}
        />
      ) : null}

      {/* ----------------------------------------------------------- Trabajo */}
      {tab === "work" && <ClassworkBoard classId={classId} isOwner={isOwner} />}

      {/* -------------------------------------------------------------- Cuadernos */}
      {tab === "notebooks" && (
        <Card className="order-4 xl:col-span-full xl:row-start-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Cuadernos compartidos</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Apuntes que los miembros han compartido con la clase.
              </p>
            </div>
            <Link href="/notebooks">
              <Button size="sm" variant="secondary">
                <NotebookPen className="h-4 w-4" /> Mis cuadernos
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {notebooks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nadie ha compartido cuadernos todavía. En Cuadernos, elige uno y pulsa «Compartir
                con una clase».
              </p>
            )}
            {notebooks.map((notebook) => (
              <div
                key={notebook.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: notebook.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{notebook.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {notebook.user_id === user?.id ? "Tu cuaderno" : "Compartido por un compañero"} ·{" "}
                    {notebook.share_permission === "edit" ? "Se puede editar" : "Solo lectura"} ·
                    Actualizado {new Date(notebook.updated_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openSharedNotebook(notebook)}>
                  Abrir
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* -------------------------------------------------------------- Archivos */}
      <Card className="order-3 xl:col-start-3 xl:row-start-1">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Archivos de la clase</CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onFileChange}
              />
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Subir archivo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploading && progress && (
              <div className="space-y-1 rounded-md border border-border/60 px-3 py-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Subiendo... {progress.percent}%</span>
                  <span>
                    {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
                  </span>
                </div>
                <Progress value={progress.percent} />
              </div>
            )}

            {files.length === 0 && !uploading && (
              <p className="text-sm text-muted-foreground">
                No hay archivos compartidos todavia (hasta 20 GB por archivo).
              </p>
            )}

            {files.map((file) => (
              <SharedFileRow
                key={file.id}
                file={file}
                canDelete={canDeleteFile(file)}
                onDownload={downloadFile}
                onRemove={removeFile}
              />
            ))}
          </CardContent>
      </Card>

      {/* -------------------------------------------------------------- Miembros */}
      <Card className="order-1 xl:col-start-1 xl:row-start-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Miembros ({detail.members.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {member.full_name ?? member.email}
                    {member.user_id === user?.id ? " (tu)" : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    member.role === "owner"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {member.role === "owner" ? "Propietario" : "Miembro"}
                </span>
              </div>
            ))}
          </CardContent>
      </Card>
      </div>

      {openNotebook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setOpenNotebook(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{openNotebook.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {openNotebook.share_permission === "edit"
                    ? "Puedes editar este cuaderno"
                    : "Solo lectura"}
                  {openNotebook.user_id === user?.id ? " · Es tuyo" : ""}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOpenNotebook(null)}>
                Cerrar
              </Button>
            </div>
            <textarea
              value={notebookDraft}
              readOnly={!canEditNotebook}
              onChange={(event) => setNotebookDraft(event.target.value)}
              className="mt-3 min-h-[360px] w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:border-primary/40 read-only:bg-muted/40"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Última actualización:{" "}
                {new Date(openNotebook.updated_at).toLocaleString("es-ES", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setOpenNotebook(null)}>
                  Volver
                </Button>
                {canEditNotebook && (
                  <Button size="sm" onClick={saveSharedNotebook} disabled={savingNotebook}>
                    {savingNotebook && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar cambios
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SharedFileRow = memo(function SharedFileRow({
  file,
  canDelete,
  onDownload,
  onRemove,
}: {
  file: DocumentFile;
  canDelete: boolean;
  onDownload: (file: DocumentFile) => void;
  onRemove: (file: DocumentFile) => void;
}) {
  const filename = normalizeFilename(file.filename);
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium" title={filename}>
          {filename}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatBytes(file.size_bytes)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onDownload(file)}>
          <Download className="h-4 w-4" />
        </Button>
        {canDelete && (
          <Button variant="ghost" size="icon" onClick={() => onRemove(file)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </span>
    </div>
  );
});

interface SharedDateCandidate {
  id: string;
  title: string;
  date: string;
  isExam: boolean;
  description: string | null;
}

/**
 * Diálogo para publicar en el calendario de la clase fechas del calendario
 * personal (fechas importantes y exámenes). Evita duplicar las que ya están.
 */
function ShareDatesDialog({
  classId,
  existing,
  onClose,
  onCreated,
}: {
  classId: string;
  existing: ClassEvent[];
  onClose: () => void;
  onCreated: (created: ClassEvent[]) => void;
}) {
  const [items, setItems] = useState<SharedDateCandidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [important, grades] = await Promise.all([
          api.importantDates(),
          api.grades(),
        ]);
        if (cancelled) return;
        const already = new Set(
          existing.map(
            (event) =>
              `${event.title.trim().toLowerCase()}|${event.start_at.slice(0, 10)}`,
          ),
        );
        const candidates: SharedDateCandidate[] = [
          ...important.map((item) => ({
            id: `important-${item.id}`,
            title: item.title,
            date: item.date.slice(0, 10),
            isExam: false,
            description: item.notes?.trim() || null,
          })),
          ...grades
            .filter((grade) => grade.is_exam && grade.graded_at)
            .map((grade) => ({
              id: `exam-${grade.id}`,
              title: grade.title,
              date: (grade.graded_at as string).slice(0, 10),
              isExam: true,
              description: null,
            })),
        ]
          .filter(
            (item) =>
              Boolean(item.date) &&
              !already.has(`${item.title.trim().toLowerCase()}|${item.date}`),
          )
          .sort((a, b) => a.date.localeCompare(b.date));
        setItems(candidates);
        setSelected(candidates.map((item) => item.id));
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [existing]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function confirm() {
    const chosen = items.filter((item) => selected.includes(item.id));
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const created: ClassEvent[] = [];
      for (const item of chosen) {
        created.push(
          await api.createClassEvent(classId, {
            title: item.title,
            description: item.description,
            start_at: new Date(`${item.date}T09:00:00`).toISOString(),
            all_day: !item.isExam,
            is_exam: item.isExam,
          }),
        );
      }
      onCreated(created);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Compartir fechas de mi calendario"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Compartir fechas de mi calendario</h2>
            <p className="text-xs text-muted-foreground">
              Se añadirán al calendario de la clase y las verá todo el mundo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No quedan fechas por compartir: tus fechas importantes y exámenes ya están en el
              calendario de la clase.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{item.title}</span>
                        {item.isExam ? (
                          <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                            Examen
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {longDateLabel(item.date)}
                        {item.description ? ` · ${item.description}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {selected.length} seleccionada{selected.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirm()}
              disabled={busy || selected.length === 0}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Compartir en la clase
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fecha legible de una fecha ISO corta (YYYY-MM-DD). */
function longDateLabel(key: string): string {
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
