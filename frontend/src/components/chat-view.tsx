"use client";

// Vista de chat: conversaciones privadas y grupales, @usuarios, adjuntos
// (PDF/imagenes) y enlaces clickeables. Los mensajes nuevos llegan por el
// WebSocket compartido de la app (`useRealtime`, evento "chat").
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Check,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Search,
  Send,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useRealtime } from "@/components/realtime-provider";
import { Button } from "@/components/ui/button";
import { chatApi } from "@/lib/api";
import type { ChatConversation, ChatMessage, ChatUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Algo salio mal";
}

function nameOf(user: { display_name: string; username: string | null }): string {
  return user.username ? `@${user.username}` : user.display_name;
}

function conversationTitle(conversation: ChatConversation, meId: string): string {
  if (conversation.kind === "group") return conversation.title || "Grupo";
  const other = conversation.members.find((member) => member.user.id !== meId);
  return other ? other.user.display_name : "Chat privado";
}

function conversationSubtitle(conversation: ChatConversation): string {
  if (conversation.kind === "group") {
    return `${conversation.members.length} miembros`;
  }
  const other = conversation.members[1] ?? conversation.members[0];
  return other?.user.username ? `@${other.user.username}` : "Privado";
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "long" });
}

function timeValue(item: { created_at: string }): number {
  const value = new Date(item.created_at).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function sortByCreatedAt<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => timeValue(a) - timeValue(b));
}

/** Upsert por id, sin mutar el array. La burbuja optimista del emisor se
 * reemplaza cuando llega el mensaje real (por evento o por respuesta HTTP). */
function mergeIncomingMessage(
  current: ChatMessage[],
  incoming: ChatMessage,
  meId: string,
): ChatMessage[] {
  const withoutIncoming = current.filter((message) => message.id !== incoming.id);
  const withoutOptimistic =
    incoming.sender_id === meId
      ? withoutIncoming.filter(
          (message) =>
            !(
              message.pending &&
              message.content === incoming.content &&
              message.attachment?.name === incoming.attachment?.name
            ),
        )
      : withoutIncoming;
  return sortByCreatedAt([...withoutOptimistic, incoming]);
}

function reconcileSentMessage(
  current: ChatMessage[],
  tempId: string,
  created: ChatMessage,
): ChatMessage[] {
  const withoutStale = current.filter(
    (message) => message.id !== tempId && message.id !== created.id,
  );
  return sortByCreatedAt([...withoutStale, created]);
}

function isImage(contentType: string, name: string): boolean {
  return (
    contentType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp)$/i.test(name)
  );
}

function isPdf(contentType: string, name: string): boolean {
  return contentType === "application/pdf" || /\.pdf$/i.test(name);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Texto con enlaces clickeables (y vista previa si el enlace es una imagen). */
function MessageText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const image = /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(part);
          return (
            <span key={`${part}-${index}`} className="block">
              <a
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2 hover:opacity-80"
              >
                {part}
              </a>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={part}
                  alt="Vista previa del enlace"
                  className="mt-2 max-h-64 w-auto rounded-lg border border-black/10 object-contain"
                  loading="lazy"
                />
              ) : null}
            </span>
          );
        }
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </span>
  );
}

/** Adjunto: imagen en linea, PDF con boton de descarga, resto como archivo. */
function AttachmentCard({ message }: { message: ChatMessage }) {
  const attachment = message.attachment;
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const image = attachment
    ? isImage(attachment.content_type, attachment.name)
    : false;

  useEffect(() => {
    if (!attachment || !image || message.pending) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    chatApi
      .downloadAttachment(message.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, image, message.id, message.pending]);

  if (!attachment) return null;

  if (message.pending) {
    return (
      <div className="mt-2 flex w-full max-w-xs items-center gap-3 rounded-lg border border-black/10 bg-background/60 px-3 py-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Paperclip className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {attachment.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatSize(attachment.size_bytes)} · enviando
          </span>
        </span>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  async function download() {
    if (downloading || message.pending) return;
    setDownloading(true);
    try {
      const blob = await chatApi.downloadAttachment(message.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment?.name ?? "adjunto";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  if (image) {
    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-black/10">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={attachment.name}
            className="max-h-72 w-auto object-contain"
          />
        ) : (
          <div className="flex h-32 w-48 items-center justify-center text-xs text-muted-foreground">
            {failed ? "No se pudo cargar la imagen" : "Cargando imagen..."}
          </div>
        )}
        <button
          type="button"
          onClick={download}
          className="flex w-full items-center gap-2 border-t border-black/10 px-2 py-1.5 text-xs hover:bg-black/5"
        >
          <Download className="h-3.5 w-3.5" />
          {attachment.name}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      className="mt-2 flex w-full max-w-xs items-center gap-3 rounded-lg border border-black/10 bg-background/60 px-3 py-2 text-left transition hover:bg-background"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {isPdf(attachment.content_type, attachment.name) ? (
          <FileText className="h-4 w-4" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {attachment.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatSize(attachment.size_bytes)} · descargar
        </span>
      </span>
      {downloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </button>
  );
}

export function ChatView() {
  const { user } = useAuth();
  const meId = user?.id ?? "";

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // @usuario: null hasta que la persona elige el suyo.
  const [claimedName, setClaimedName] = useState<string | null>(
    user?.username ?? null,
  );
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const active = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [activeId, conversations],
  );

  const refreshList = useCallback(async () => {
    try {
      const items = await chatApi.conversations();
      setConversations(items);
      setError(null);
    } catch (loadError) {
      setError(readError(loadError));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const openConversation = useCallback(async (conversationId: string) => {
    setActiveId(conversationId);
    setMobileThread(true);
    setLoadingThread(true);
    setError(null);
    try {
      const items = await chatApi.messages(conversationId);
      setMessages(items);
      await chatApi.markRead(conversationId);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unread_count: 0 }
            : conversation,
        ),
      );
    } catch (loadError) {
      setError(readError(loadError));
    } finally {
      setLoadingThread(false);
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "auto" }),
      );
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshList();
  }, [refreshList, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useRealtime((event) => {
    if (event.event !== "chat") return;
    const data = event.data as
      | {
          conversation_id?: string;
          action?: string;
          message?: ChatMessage;
        }
      | undefined;
    const conversationId = data?.conversation_id;
    if (!conversationId) return;
    const incoming = data?.message;

    if (data?.action === "message" && incoming) {
      if (conversationId === activeIdRef.current) {
        setMessages((current) => mergeIncomingMessage(current, incoming, meId));
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  last_message: incoming,
                  unread_count: 0,
                  updated_at: incoming.created_at,
                }
              : conversation,
          ),
        );
        void chatApi.markRead(conversationId);
      } else {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  last_message: incoming,
                  unread_count:
                    incoming.sender_id === meId
                      ? conversation.unread_count
                      : conversation.unread_count + 1,
                  updated_at: incoming.created_at,
                }
              : conversation,
          ),
        );
      }
      return;
    }

    // Compatibilidad con eventos antiguos (sin payload): una sola recarga.
    void refreshList();
    if (conversationId === activeIdRef.current) {
      void chatApi
        .messages(conversationId)
        .then((items) => {
          setMessages(sortByCreatedAt(items));
          void chatApi.markRead(conversationId);
        })
        .catch(() => undefined);
    }
  });

  async function claimUsername() {
    const clean = usernameDraft.trim().replace(/^@/, "").toLowerCase();
    if (!clean || savingName) return;
    setSavingName(true);
    setNameMessage(null);
    try {
      const check = await chatApi.usernameAvailable(clean);
      if (!check.available) {
        setNameMessage(check.reason ?? "Ese @usuario no esta disponible");
        return;
      }
      const updated = await chatApi.setUsername(clean);
      setClaimedName(updated.username ?? clean);
      setUsernameDraft("");
    } catch (claimError) {
      setNameMessage(readError(claimError));
    } finally {
      setSavingName(false);
    }
  }

  async function handleSend() {
    if (!activeId || sending) return;
    const targetId = activeId;
    const text = draft.trim();
    const pendingFile = file;
    if (!text && !pendingFile) return;
    const tempId = `pending-${
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Date.now().toString(36)
    }`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: targetId,
      sender_id: meId,
      sender_name: user?.full_name?.trim() || user?.email || "Tu",
      sender_username: user?.username ?? null,
      content: text,
      attachment: pendingFile
        ? {
            name: pendingFile.name,
            content_type: pendingFile.type || "application/octet-stream",
            size_bytes: pendingFile.size,
          }
        : null,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setSending(true);
    setError(null);
    setDraft("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setMessages((current) => sortByCreatedAt([...current, optimistic]));

    try {
      const created = await chatApi.sendMessage(targetId, text, pendingFile);
      setMessages((current) => reconcileSentMessage(current, tempId, created));
      void refreshList();
    } catch (sendError) {
      setMessages((current) =>
        current.filter((message) => message.id !== tempId),
      );
      setDraft((current) => (current.trim() ? current : text));
      setFile(pendingFile);
      setError(readError(sendError));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[520px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* -------------------------------------------------- lista lateral */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-border md:w-80 md:border-r",
          mobileThread && "hidden md:flex",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold">Chat</h1>
            <p className="text-xs text-muted-foreground">
              {conversations.length} conversaciones
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            aria-label="Nueva conversacion"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {!claimedName ? (
          <div className="border-b border-border bg-primary/5 px-4 py-3">
            <p className="text-xs font-medium">Elige tu @usuario</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Con el te encuentran tus companeros para chatear.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void claimUsername();
                }}
                placeholder="tu_nombre"
                maxLength={24}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void claimUsername()}
                disabled={savingName}
              >
                {savingName ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Guardar"
                )}
              </Button>
            </div>
            {nameMessage ? (
              <p className="mt-1.5 text-[11px] text-destructive">
                {nameMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              <MessageSquarePlus className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Aun no tienes conversaciones. Crea un grupo o escribe a alguien por
              su @usuario.
            </div>
          ) : (
            conversations.map((conversation) => {
              const title = conversationTitle(conversation, meId);
              const selected = conversation.id === activeId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void openConversation(conversation.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-muted/60",
                    selected && "bg-muted",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {conversation.kind === "group" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      initials(title)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{title}</span>
                      {conversation.last_message ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatClock(conversation.last_message.created_at)}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {conversation.last_message?.content ||
                          conversationSubtitle(conversation)}
                      </span>
                      {conversation.unread_count > 0 ? (
                        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                          {conversation.unread_count}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------- hilo */}
      <section
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          !mobileThread && "hidden md:flex",
        )}
      >
        {active ? (
          <>
            <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <button
                type="button"
                className="rounded-md p-1.5 hover:bg-muted md:hidden"
                onClick={() => setMobileThread(false)}
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {conversationTitle(active, meId)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {active.members
                    .map((member) => nameOf(member.user))
                    .join(" · ")}
                </p>
              </div>
              {active.members.find((member) => member.user.id === meId)
                ?.role === "owner" ? (
                <InviteButton
                  conversation={active}
                  onInvited={() => void refreshList()}
                />
              ) : null}
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {loadingThread ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Todavia no hay mensajes. Escribe el primero.
                </p>
              ) : (
                messages.map((message, index) => {
                  const mine = message.sender_id === meId;
                  const previous = messages[index - 1];
                  const newDay =
                    !previous ||
                    new Date(previous.created_at).toDateString() !==
                      new Date(message.created_at).toDateString();
                  return (
                    <div key={message.id}>
                      {newDay ? (
                        <p className="my-3 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
                          {formatDay(message.created_at)}
                        </p>
                      ) : null}
                      <div
                        className={cn(
                          "flex gap-2",
                          mine ? "justify-end" : "justify-start",
                        )}
                      >
                        {!mine ? (
                          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                            {initials(message.sender_name)}
                          </span>
                        ) : null}
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                            mine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
                          {!mine && active.kind === "group" ? (
                            <p className="mb-0.5 text-[11px] font-semibold opacity-70">
                              {message.sender_username
                                ? `@${message.sender_username}`
                                : message.sender_name}
                            </p>
                          ) : null}
                          {message.content ? (
                            <MessageText text={message.content} />
                          ) : null}
                          {message.attachment ? (
                            <AttachmentCard message={message} />
                          ) : null}
                          <p
                            className={cn(
                              "mt-1 text-right text-[10px]",
                              mine
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            <span className="inline-flex items-center gap-1">
                              {message.pending ? (
                                <>
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  Enviando
                                </>
                              ) : (
                                <>
                                  {mine ? (
                                    <Check className="h-2.5 w-2.5" />
                                  ) : null}
                                  {formatClock(message.created_at)}
                                </>
                              )}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {error ? (
              <p className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <div className="border-t border-border p-3">
              {file ? (
                <div className="mb-2 flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    aria-label="Quitar adjunto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  className="hidden"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Adjuntar archivo"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Escribe un mensaje..."
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={() => void handleSend()}
                  disabled={sending || (!draft.trim() && !file)}
                  aria-label="Enviar"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Enter envia · Mayusculas+Enter salta de linea · adjuntos hasta 25
                MB
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
            <MessageSquarePlus className="h-10 w-10 opacity-40" />
            <p>Elige una conversacion o crea una nueva.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" /> Nueva conversacion
            </Button>
          </div>
        )}
      </section>

      {dialogOpen ? (
        <NewConversationDialog
          onClose={() => setDialogOpen(false)}
          onCreated={(conversation) => {
            setDialogOpen(false);
            void refreshList();
            void openConversation(conversation.id);
          }}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- invitados */

function InviteButton({
  conversation,
  onInvited,
}: {
  conversation: ChatConversation;
  onInvited: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (conversation.kind !== "group" || conversation.members.length === 0) {
    return null;
  }

  async function invite() {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) return;
    setBusy(true);
    setMessage(null);
    try {
      await chatApi.invite(conversation.id, clean);
      setUsername("");
      setOpen(false);
      onInvited();
    } catch (inviteError) {
      setMessage(readError(inviteError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <UserPlus className="h-4 w-4" /> Invitar
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
          <label className="text-xs font-medium" htmlFor="invite-username">
            @usuario
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="invite-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="ana"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void invite()}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invitar"}
            </Button>
          </div>
          {message ? (
            <p className="mt-2 text-xs text-destructive">{message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------ nueva conversacion */

function NewConversationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversation: ChatConversation) => void;
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<ChatUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      chatApi
        .users(query)
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function toggle(user: ChatUser) {
    if (mode === "direct") {
      setSelected([user]);
      return;
    }
    setSelected((current) =>
      current.some((item) => item.id === user.id)
        ? current.filter((item) => item.id !== user.id)
        : [...current, user],
    );
  }

  async function create() {
    if (busy) return;
    if (selected.length === 0) {
      setError("Elige al menos a una persona");
      return;
    }
    if (mode === "group" && !title.trim()) {
      setError("Ponle un nombre al grupo");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const conversation = await chatApi.createConversation({
        kind: mode,
        title: mode === "group" ? title.trim() : null,
        member_ids: selected.map((user) => user.id),
      });
      onCreated(conversation);
    } catch (createError) {
      setError(readError(createError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nueva conversacion"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nueva conversacion</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["direct", "group"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setMode(option);
                setSelected([]);
              }}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition",
                mode === option
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "direct" ? "Chat privado" : "Grupo"}
            </button>
          ))}
        </div>

        {mode === "group" ? (
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nombre del grupo"
            maxLength={200}
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        ) : null}

        {selected.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selected.map((user) => (
              <span
                key={user.id}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                {nameOf(user)}
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  aria-label={`Quitar ${nameOf(user)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por @usuario o email"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </div>

        <div className="mt-2 max-h-56 overflow-y-auto">
          {searching && results.length === 0 ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              <AtSign className="mx-auto mb-1 h-5 w-5 opacity-50" />
              Sin resultados. Pide a la persona su @usuario.
            </p>
          ) : (
            results.map((user) => {
              const picked = selected.some((item) => item.id === user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggle(user)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                    picked && "bg-muted",
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {initials(user.display_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {user.display_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.username ? `@${user.username}` : "Sin @usuario"}
                    </span>
                  </span>
                  {picked ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>

        {error ? (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={() => void create()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
          </Button>
        </div>
      </div>
    </div>
  );
}
