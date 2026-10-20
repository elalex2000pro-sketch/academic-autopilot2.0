"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FolderOpen,
  KeyRound,
  Loader2,
  LogOut,
  Megaphone,
  MessageSquare,
  Pin,
  PinOff,
  Send,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/auth-provider";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import { uploadFileInChunks, type UploadProgress } from "@/lib/upload";
import type { ClassDetail, ClassEvent, ClassMessage, DocumentFile } from "@/lib/types";

type Tab = "chat" | "calendar" | "files" | "members";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "files", label: "Archivos", icon: FolderOpen },
  { id: "members", label: "Miembros", icon: Users },
];

const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.gif";

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

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const classId = (params?.id as string) ?? "";
  const router = useRouter();
  const { user } = useAuth();

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [copied, setCopied] = useState(false);

  const isOwner = detail?.my_role === "owner";

  const loadAll = useCallback(async () => {
    if (!classId) return;
    const [info, msgs, evs, fls] = await Promise.all([
      api.classDetail(classId),
      api.classMessages(classId),
      api.classEvents(classId),
      api.classFiles(classId),
    ]);
    setDetail(info);
    setMessages(msgs);
    setEvents(evs);
    setFiles(fls);
  }, [classId]);

  useEffect(() => {
    loadAll()
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [loadAll]);

  useRealtime((event) => {
    if (event.event !== "classes") return;
    const data = event.data as { class_id?: string; action?: string } | undefined;
    if (data?.class_id !== classId) return;
    if (data.action === "deleted" || data.action === "left") {
      router.push("/classes");
      return;
    }
    loadAll().catch(() => undefined);
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
      router.push("/classes");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function leaveClass() {
    if (!window.confirm("¿Salir de la clase? Podras volver con el codigo.")) return;
    try {
      await api.leaveClass(classId);
      router.push("/classes");
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
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages.length, tab]);

  const pinnedMessages = useMemo(() => messages.filter((m) => m.pinned), [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await api.sendClassMessage(classId, {
        content,
        kind: isOwner && asAnnouncement ? "announcement" : "message",
      });
      setDraft("");
      setAsAnnouncement(false);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
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

  const monthLabel = useMemo(
    () => month.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
    [month],
  );

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
      const created = await api.createClassEvent(classId, {
        title: eventTitle.trim(),
        start_at: start.toISOString(),
        end_at: endIso,
        location: eventLocation.trim() || null,
        description: eventDescription.trim() || null,
        is_exam: eventIsExam,
      });
      setEvents((prev) =>
        [...prev, created].sort((a, b) => a.start_at.localeCompare(b.start_at)),
      );
      setEventTitle("");
      setEventEnd("");
      setEventLocation("");
      setEventDescription("");
      setEventIsExam(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingEvent(false);
    }
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

  async function downloadFile(file: DocumentFile) {
    try {
      await api.downloadFile(file.id, file.filename);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeFile(file: DocumentFile) {
    if (!window.confirm(`¿Borrar "${file.filename}"?`)) return;
    try {
      await api.deleteFile(file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const canDeleteFile = (file: DocumentFile) => file.user_id === user?.id || isOwner;

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
          Volver a las clases
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <Link
        href="/classes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Clases
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
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ Chat */}
      {tab === "chat" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
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
                      {formatDateTime(message.created_at)}
                      {isOwner && (
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
                      {(message.user_id === user?.id || isOwner) && (
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
      )}

      {/* ------------------------------------------------------------- Calendario */}
      {tab === "calendar" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
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
                <CardTitle className="text-base">Anadir evento</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createEvent} className="space-y-3">
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
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!eventTitle.trim() || savingEvent}
                  >
                    {savingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Crear evento
                  </Button>
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
                      <button
                        type="button"
                        onClick={() => removeEvent(event)}
                        title="Eliminar evento"
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------- Archivos */}
      {tab === "files" && (
        <Card>
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
              <div
                key={file.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{file.filename}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(file.size_bytes)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => downloadFile(file)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDeleteFile(file) && (
                    <Button variant="ghost" size="icon" onClick={() => removeFile(file)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* -------------------------------------------------------------- Miembros */}
      {tab === "members" && (
        <Card>
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
      )}
    </div>
  );
}
