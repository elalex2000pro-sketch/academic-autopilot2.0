"use client";

import { createPortal } from "react-dom";
import "./chat-workspace.css";

// Vista de chat: conversaciones privadas y grupales, @usuarios, adjuntos
// (PDF/imagenes) y enlaces clickeables. Los mensajes nuevos llegan por el
// WebSocket compartido de la app (`useRealtime`, evento "chat").
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  FileText,
  FolderOpen,
  Forward,
  Loader2,
  MessageSquarePlus,
  Palette,
  Paperclip,
  Plus,
  Save,
  Search,
  Send,
  SmilePlus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ChatBackgroundPicker } from "@/components/chat-background-picker";
import { ChatExtrasPicker } from "@/components/chat-extras-picker";
import {
  ChatForwardModal,
  type ForwardTarget,
} from "@/components/chat-forward-modal";
import { useRealtime } from "@/components/realtime-provider";
import { setActiveChatConversation } from "@/lib/chat-active";
import { Button } from "@/components/ui/button";
import { VerifiedTick } from "@/components/verified-tick";

import { chatApi } from "@/lib/api";
import {
  isChatMuted,
  setChatMuted,
  subscribeChatMutes,
} from "@/lib/chat-mutes";
import {
  DEFAULT_CHAT_BACKGROUND,
  backgroundStyle,
  loadChatBackground,
  saveChatBackground,
  type ChatBackground,
} from "@/lib/chat-background";
import {
  XP_EVENT,
  getGamification,
  getLevelInfo,
  parseStickerMessage,
  stickerMessage,
  type ChatSticker,
} from "@/lib/gamification";
import { openFileWithSystem, saveFileAs } from "@/lib/native-files";
import type { ChatConversation, ChatMessage, ChatUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { lockBodyScroll } from "@/lib/scroll-lock";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Algo salio mal";
}

function nameOf(user: {
  display_name: string;
  username: string | null;
}): string {
  return user.username ? `@${user.username}` : user.display_name;
}

function conversationTitle(
  conversation: ChatConversation,
  meId: string,
): string {
  if (conversation.kind === "group") return conversation.title || "Grupo";
  const other = conversation.members.find((member) => member.user.id !== meId);
  return other ? other.user.display_name : "Chat privado";
}

function conversationSubtitle(
  conversation: ChatConversation,
  meId: string,
): string {
  if (conversation.kind === "group") {
    return `${conversation.members.length} miembros`;
  }
  const other = conversation.members.find((member) => member.user.id !== meId);
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

function messagePreview(message: ChatMessage): string {
  const sticker = parseStickerMessage(message.content);
  return sticker ? `${sticker.emoji} ${sticker.name}` : message.content;
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
  const withoutIncoming = current.filter(
    (message) => message.id !== incoming.id,
  );
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
    contentType.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name)
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Texto con enlaces clickeables (y vista previa si el enlace es una imagen). */
function MessageText({ text }: { text: string }) {
  const sticker = parseStickerMessage(text);
  if (sticker) {
    return (
      <span className="flex min-w-[88px] flex-col items-center gap-1 py-1">
        <span className="text-[42px] leading-none drop-shadow-sm">
          {sticker.emoji}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-65">
          {sticker.name}
        </span>
      </span>
    );
  }
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

/**
 * Ticks de WhatsApp en la esquina de la burbuja: un tick gris al enviar, dos
 * grises al entregar y dos azules al leer. El azul es claro para que se vea
 * sobre la burbuja azul del emisor.
 */
function MessageTicks({
  mine,
  status,
  pending,
}: {
  mine: boolean;
  status?: ChatMessage["status"];
  pending?: boolean;
}) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Enviando
      </span>
    );
  }
  if (!mine) return null;
  const value = status ?? "sent";
  if (value === "sent") {
    return (
      <Check
        className="h-3.5 w-3.5 text-[#75877d] dark:text-[#adbbb2]"
        aria-label="Enviado"
      />
    );
  }
  const read = value === "read";
  return (
    <CheckCheck
      className={cn(
        "h-3.5 w-3.5",
        read
          ? "text-[#168ac2] dark:text-[#6bcfee]"
          : "text-[#75877d] dark:text-[#adbbb2]",
      )}
      aria-label={read ? "Leído" : "Entregado"}
    />
  );
}

/** Adjunto: imagen en linea o archivo, con Abrir y Guardar nativos. */
function AttachmentCard({ message }: { message: ChatMessage }) {
  const attachment = message.attachment;
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
          <span className="block truncate text-sm font-medium text-slate-900 dark:text-white/90">
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

  async function handleFileAction(action: "open" | "save") {
    if (opening || saving || message.pending) return;
    const setBusy = action === "open" ? setOpening : setSaving;
    setBusy(true);
    setActionError(null);
    try {
      const blob = await chatApi.downloadAttachment(message.id);
      if (action === "open") {
        await openFileWithSystem(blob, attachment?.name ?? "adjunto");
      } else {
        await saveFileAs(blob, attachment?.name ?? "adjunto");
      }
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la acción.",
      );
    } finally {
      setBusy(false);
    }
  }

  const actionButtons = (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void handleFileAction("open")}
        disabled={opening || saving}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-white/60 bg-white/85 px-2.5 text-[10px] font-semibold text-slate-700 shadow-sm transition hover:bg-white disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20"
      >
        {opening ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FolderOpen className="h-3 w-3" />
        )}
        Abrir
      </button>
      <button
        type="button"
        onClick={() => void handleFileAction("save")}
        disabled={opening || saving}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-white/60 bg-white/85 px-2.5 text-[10px] font-semibold text-slate-700 shadow-sm transition hover:bg-white disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20"
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Save className="h-3 w-3" />
        )}
        Guardar
      </button>
    </span>
  );

  const actionErrorText = actionError ? (
    <p className="bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive">
      {actionError}
    </p>
  ) : null;

  if (image) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-white/45 bg-white/55 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-slate-950/30">
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
        <div className="flex flex-wrap items-center gap-2 border-t border-white/45 px-2 py-1.5 dark:border-white/10">
          <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700 dark:text-white/75">
            {attachment.name}
          </span>
          {actionButtons}
        </div>
        {actionErrorText}
      </div>
    );
  }

  return (
    <div className="mt-2 w-full max-w-xs overflow-hidden rounded-xl border border-white/45 bg-white/60 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-slate-950/30">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900 dark:text-white/90">
            {attachment.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatSize(attachment.size_bytes)}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-end border-t border-white/45 px-2 py-1.5 dark:border-white/10">
        {actionButtons}
      </div>
      {actionErrorText}
    </div>
  );
}

function sortConversations(items: ChatConversation[]): ChatConversation[] {
  return [...items].sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
  );
}

const STATUS_RANK = { sent: 0, delivered: 1, read: 2 } as const;
function advancedStatus(
  current: ChatMessage["status"],
  next: ChatMessage["status"],
) {
  return STATUS_RANK[current ?? "sent"] > STATUS_RANK[next ?? "sent"]
    ? current
    : next;
}

function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    byId.set(message.id, {
      ...message,
      status: advancedStatus(previous?.status, message.status),
    });
  }
  return sortByCreatedAt([...byId.values()]);
}

function presenceLabel(peer: ChatUser | undefined): string {
  if (peer?.online) return "En línea";
  if (!peer?.last_seen_at) return "Sin conexión";
  const date = new Date(peer.last_seen_at);
  return `Última vez ${formatDay(peer.last_seen_at).toLowerCase()} a las ${formatClock(date.toISOString())}`;
}

function Avatar({
  name,
  group = false,
  online = false,
}: {
  name: string;
  group?: boolean;
  online?: boolean;
}) {
  return (
    <span className="chat-avatar" aria-hidden="true">
      {group ? <Users className="h-5 w-5" /> : initials(name)}
      {online ? <span className="chat-online-dot" /> : null}
    </span>
  );
}

export function ChatView() {
  const { user, refreshUser } = useAuth();
  const meId = user?.id ?? "";
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [mutedChats, setMutedChats] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [background, setBackground] = useState<ChatBackground>(
    DEFAULT_CHAT_BACKGROUND,
  );
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [forwardNotice, setForwardNotice] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const mobileThreadRef = useRef(false);
  const mountedRef = useRef(true);
  const readRequests = useRef(new Set<string>());
  const lastReadCursor = useRef(new Map<string, string>());
  const messagesRef = useRef<ChatMessage[]>([]);
  const loadedConversation = useRef<string | null>(null);
  const openRequest = useRef(0);
  const listRequest = useRef(0);
  const shouldScroll = useRef(false);
  activeIdRef.current = activeId;
  mobileThreadRef.current = mobileThread;
  messagesRef.current = messages;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (editingUsername) {
      usernameRef.current?.focus();
      usernameRef.current?.select();
    }
  }, [editingUsername]);
  const active = conversations.find((item) => item.id === activeId) ?? null;
  const peer = active?.members.find((member) => member.user.id !== meId)?.user;
  const activeMuted = !!activeId && mutedChats.includes(activeId);
  const visibleConversations = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return sortConversations(conversations).filter(
      (item) =>
        !term ||
        [
          conversationTitle(item, meId),
          conversationSubtitle(item, meId),
          item.last_message ? messagePreview(item.last_message) : "",
        ].some((value) => value.toLocaleLowerCase().includes(term)),
    );
  }, [conversations, query, meId]);
  const forwardTargets = useMemo<ForwardTarget[]>(
    () =>
      conversations
        .filter((item) => item.id !== activeId)
        .map((item) => ({
          id: item.id,
          title: conversationTitle(item, meId),
          subtitle: conversationSubtitle(item, meId),
          kind: item.kind,
        })),
    [conversations, activeId, meId],
  );

  const threadVisible = useCallback(
    () =>
      document.visibilityState === "visible" &&
      document.hasFocus() &&
      (window.matchMedia("(min-width: 768px)").matches ||
        mobileThreadRef.current),
    [],
  );
  const atBottom = useCallback(() => {
    const element = threadRef.current;
    return (
      !element ||
      element.scrollHeight - element.scrollTop - element.clientHeight < 100
    );
  }, []);
  const markVisibleRead = useCallback(
    async function confirmVisibleRead(id: string) {
      if (
        loadedConversation.current !== id ||
        activeIdRef.current !== id ||
        !threadVisible() ||
        !atBottom() ||
        readRequests.current.has(id)
      )
        return;
      const cursor = [...messagesRef.current]
        .reverse()
        .find((message) => !message.pending)?.id;
      if (!cursor || lastReadCursor.current.get(id) === cursor) return;
      readRequests.current.add(id);
      let confirmed = false;
      try {
        await chatApi.markRead(id, cursor);
        lastReadCursor.current.set(id, cursor);
        confirmed = true;
        if (mountedRef.current)
          setConversations((items) =>
            items.map((item) =>
              item.id === id ? { ...item, unread_count: 0 } : item,
            ),
          );
      } catch {
        /* La próxima entrada o reconexión vuelve a confirmar la lectura. */
      } finally {
        readRequests.current.delete(id);
        const latest = [...messagesRef.current]
          .reverse()
          .find((message) => !message.pending)?.id;
        if (
          confirmed &&
          mountedRef.current &&
          activeIdRef.current === id &&
          latest !== cursor
        ) {
          requestAnimationFrame(() => void confirmVisibleRead(id));
        }
      }
    },
    [threadVisible, atBottom],
  );

  const refreshList = useCallback(async () => {
    const request = ++listRequest.current;
    try {
      const items = await chatApi.conversations();
      if (mountedRef.current && request === listRequest.current) {
        setConversations(sortConversations(items));
        setError(null);
      }
    } catch (caught) {
      if (mountedRef.current) setError(readError(caught));
    } finally {
      if (mountedRef.current) setLoadingList(false);
    }
  }, []);

  const refreshPresence = useCallback(async (id: string) => {
    try {
      const people = await chatApi.presence(id);
      if (!mountedRef.current) return;
      setConversations((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                members: item.members.map((member) => ({
                  ...member,
                  user:
                    people.find((person) => person.id === member.user.id) ??
                    member.user,
                })),
              }
            : item,
        ),
      );
    } catch {
      /* La presencia se actualiza también mediante WebSocket. */
    }
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      const request = ++openRequest.current;
      activeIdRef.current = id;
      loadedConversation.current = null;
      setActiveId(id);
      setMobileThread(true);
      setLoadingThread(true);
      setMessages([]);
      setError(null);
      setDraft("");
      setFile(null);
      setHasOlder(false);
      void refreshPresence(id);
      try {
        const items = await chatApi.messages(id);
        if (
          !mountedRef.current ||
          activeIdRef.current !== id ||
          request !== openRequest.current
        )
          return;
        loadedConversation.current = id;
        shouldScroll.current = true;
        setMessages((current) => mergeMessages(items, current));
        setHasOlder(items.length === 50);
      } catch (caught) {
        if (activeIdRef.current === id && request === openRequest.current)
          setError(readError(caught));
      } finally {
        if (
          mountedRef.current &&
          activeIdRef.current === id &&
          request === openRequest.current
        )
          setLoadingThread(false);
      }
    },
    [refreshPresence],
  );

  async function loadOlder() {
    const id = activeIdRef.current;
    if (!id || loadingOlder || !messages.length) return;
    const element = threadRef.current;
    const oldHeight = element?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const items = await chatApi.messages(id, messages[0].created_at);
      if (activeIdRef.current !== id) return;
      setHasOlder(items.length === 50);
      setMessages((current) => mergeMessages(items, current));
      requestAnimationFrame(() => {
        if (element && activeIdRef.current === id)
          element.scrollTop += element.scrollHeight - oldHeight;
      });
    } catch (caught) {
      if (activeIdRef.current === id) setError(readError(caught));
    } finally {
      if (mountedRef.current) setLoadingOlder(false);
    }
  }

  useEffect(() => {
    if (meId) void refreshList();
  }, [meId, refreshList]);
  useEffect(() => subscribeChatMutes(setMutedChats), []);
  useEffect(() => {
    const sync = () =>
      setLevel(meId ? getLevelInfo(getGamification(meId).xp).level : 1);
    sync();
    window.addEventListener(XP_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(XP_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [meId]);
  useEffect(() => {
    setExtrasOpen(false);
    setBackgroundOpen(false);
    setForwarding(null);
    setForwardNotice(null);
    setBackground(
      activeId ? loadChatBackground(activeId) : DEFAULT_CHAT_BACKGROUND,
    );
  }, [activeId]);
  useEffect(() => {
    if (!file || !isImage(file.type, file.name)) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.style.height = "auto";
    composerRef.current.style.height = `${Math.min(144, composerRef.current.scrollHeight)}px`;
  }, [draft, activeId]);
  useEffect(() => {
    if (!shouldScroll.current || loadingThread) return;
    shouldScroll.current = false;
    const element = threadRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    if (activeId) void markVisibleRead(activeId);
  }, [messages, loadingThread, activeId, markVisibleRead]);
  useEffect(() => {
    const sync = () => {
      const id = activeIdRef.current;
      setActiveChatConversation(threadVisible() ? id : null);
      if (id) void markVisibleRead(id);
    };
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    window.addEventListener("resize", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      setActiveChatConversation(null);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      window.removeEventListener("resize", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [activeId, mobileThread, threadVisible, markVisibleRead]);
  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(
      () => void refreshPresence(activeId),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, [activeId, refreshPresence]);
  useEffect(() => {
    if (!forwardNotice) return;
    const timer = window.setTimeout(() => setForwardNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [forwardNotice]);

  useRealtime((event) => {
    if (event.event === "reconnected") {
      void refreshList();
      const id = activeIdRef.current;
      if (id) {
        void refreshPresence(id);
        void chatApi
          .messages(id)
          .then((items) => {
            if (activeIdRef.current === id)
              setMessages((current) => mergeMessages(current, items));
          })
          .catch(() => undefined);
      }
      return;
    }
    if (event.event !== "chat") return;
    const data = event.data as
      | {
          action?: string;
          conversation_id?: string;
          message?: ChatMessage;
          message_ids?: string[];
          status?: ChatMessage["status"];
          user_id?: string;
          online?: boolean;
          last_seen_at?: string | null;
        }
      | undefined;
    if (data?.action === "presence" && data.user_id) {
      setConversations((items) =>
        items.map((item) => ({
          ...item,
          members: item.members.map((member) =>
            member.user.id === data.user_id
              ? {
                  ...member,
                  user: {
                    ...member.user,
                    online: data.online ?? false,
                    last_seen_at: data.last_seen_at ?? null,
                  },
                }
              : member,
          ),
        })),
      );
      return;
    }
    const id = data?.conversation_id;
    if (!id) return;
    if (data?.action === "status") {
      const ids = new Set(data.message_ids ?? []);
      const status = data.status === "read" ? "read" : "delivered";
      setMessages((items) =>
        items.map((item) =>
          ids.has(item.id)
            ? { ...item, status: advancedStatus(item.status, status) }
            : item,
        ),
      );
      setConversations((items) =>
        items.map((item) =>
          item.last_message && ids.has(item.last_message.id)
            ? {
                ...item,
                last_message: {
                  ...item.last_message,
                  status: advancedStatus(item.last_message.status, status),
                },
              }
            : item,
        ),
      );
      return;
    }
    const incoming = data?.message;
    if (data?.action === "message" && incoming) {
      const showing = id === activeIdRef.current;
      if (showing) {
        shouldScroll.current = atBottom() || incoming.sender_id === meId;
        setMessages((current) => {
          const reconciled = mergeIncomingMessage(current, incoming, meId);
          return mergeMessages(
            reconciled,
            current.filter((message) => message.id === incoming.id),
          );
        });
      }
      // Refresh also discovers a conversation created on another device. Read
      // receipts run after rendering, and only for a visible, focused thread.
      void refreshList();
      if (showing && incoming.sender_id !== meId)
        requestAnimationFrame(() => void markVisibleRead(id));
      return;
    }
    void refreshList();
  });

  function selectFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (
      !/\.(pdf|png|jpe?g|gif|webp|txt|md|csv|docx?|pptx?|xlsx?)$/i.test(
        next.name,
      )
    ) {
      setError(
        "Formato no permitido. Adjunta una imagen, PDF o documento de Office.",
      );
      return;
    }
    if (!next.size || next.size > 25 * 1024 * 1024) {
      setError("El archivo debe contener datos y ocupar como máximo 25 MB.");
      return;
    }
    setFile(next);
    setError(null);
  }
  async function claimUsername() {
    if (savingName) return;
    setSavingName(true);
    setNameMessage(null);
    try {
      await chatApi.setUsername(
        usernameDraft.trim().replace(/^@/, "").toLowerCase(),
      );
      await refreshUser();
      setEditingUsername(false);
      setUsernameDraft("");
    } catch (caught) {
      setNameMessage(readError(caught));
    } finally {
      setSavingName(false);
    }
  }
  async function handleSend(overrideText?: string) {
    const id = activeIdRef.current;
    if (!id || sending || loadingThread) return;
    const text = (overrideText ?? draft).trim();
    const attachment = overrideText === undefined ? file : null;
    if (!text && !attachment) return;
    const tempId = `pending-${crypto.randomUUID()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: id,
      sender_id: meId,
      sender_name: user?.full_name?.trim() || user?.username || "Tú",
      sender_username: user?.username ?? null,
      sender_verified: user?.is_verified ?? false,
      content: text,
      attachment: attachment
        ? {
            name: attachment.name,
            content_type: attachment.type || "application/octet-stream",
            size_bytes: attachment.size,
          }
        : null,
      created_at: new Date().toISOString(),
      status: "sent",
      pending: true,
    };
    setSending(true);
    setError(null);
    setExtrasOpen(false);
    if (overrideText === undefined) {
      setDraft("");
      setFile(null);
    }
    if (fileRef.current) fileRef.current.value = "";
    shouldScroll.current = true;
    setMessages((items) => [...items, optimistic]);
    try {
      const created = await chatApi.sendMessage(id, text, attachment);
      if (!mountedRef.current) return;
      if (activeIdRef.current === id)
        setMessages((items) => {
          const existing = items.find((item) => item.id === created.id);
          return reconcileSentMessage(items, tempId, {
            ...created,
            status: advancedStatus(existing?.status, created.status),
          });
        });
      void refreshList();
    } catch (caught) {
      if (mountedRef.current && activeIdRef.current === id) {
        setMessages((items) => items.filter((item) => item.id !== tempId));
        if (overrideText === undefined) {
          setDraft((current) => current || text);
          setFile(attachment);
        }
        setError(readError(caught));
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  return (
    <div className="chat-workspace" aria-label="Mensajería">
      <aside
        className={cn("chat-sidebar", mobileThread && "chat-mobile-hidden")}
      >
        <div className="chat-profile">
          <Avatar name={user?.full_name || user?.username || "Tú"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {user?.full_name || "Tu perfil"}
            </p>
            <button
              type="button"
              aria-label="Cambiar tu @usuario"
              aria-expanded={editingUsername}
              aria-controls="chat-username-form"
              disabled={savingName}
              title="Cambiar tu @usuario"
              className="flex max-w-full items-center gap-1 truncate rounded text-left text-xs text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
              onClick={() => {
                setUsernameDraft(user?.username ?? "");
                setNameMessage(null);
                setEditingUsername((value) => !value);
              }}
            >
              {user?.username ? `@${user.username}` : "Configura tu @usuario"}
              <AtSign className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          </div>
          <button
            className="chat-icon-button"
            onClick={() => setDialogOpen(true)}
            aria-label="Nuevo chat / Añadir contacto"
            title="Nuevo chat"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 pb-3 pt-4">
          <h1 className="mb-3 text-[23px] font-semibold tracking-[-0.04em]">
            Chats
          </h1>
          <label className="chat-search">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar chats o @usuario"
              aria-label="Buscar chats abiertos"
            />
            {query ? (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
        </div>
        {!user?.username || editingUsername ? (
          <form
            id="chat-username-form"
            className="mx-4 mb-3 rounded-xl border border-border bg-background/40 p-3"
            onSubmit={(event) => { event.preventDefault(); void claimUsername(); }}
          >
            <p className="mb-2 text-xs">
              Elige tu @usuario para que puedan encontrarte.
            </p>
            <div className="flex gap-2">
              <input
                ref={usernameRef}
                aria-label="Tu nuevo @usuario"
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                placeholder="@tu_usuario"
                maxLength={25}
                disabled={savingName}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={savingName || !usernameDraft.trim()}
              >
                Guardar
              </Button>
            </div>
            {user?.username ? (
              <button
                type="button"
                className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
                disabled={savingName}
                onClick={() => { setEditingUsername(false); setNameMessage(null); }}
              >
                Cancelar
              </button>
            ) : null}
            {nameMessage ? (
              <p className="mt-2 text-xs text-destructive">{nameMessage}</p>
            ) : null}
          </form>
        ) : null}
        <div className="chat-conversation-list" aria-label="Conversaciones">
          {loadingList ? (
            <div className="flex justify-center p-10">
              <Loader2
                className="h-5 w-5 animate-spin"
                aria-label="Cargando chats"
              />
            </div>
          ) : !visibleConversations.length ? (
            <div className="px-7 py-12 text-center text-sm text-muted-foreground">
              <MessageSquarePlus className="mx-auto mb-3 h-8 w-8 opacity-50" />
              <p>
                {query
                  ? "No hay chats que coincidan."
                  : "Tu próxima conversación empieza con un @usuario."}
              </p>
              {!query ? (
                <button
                  onClick={() => setDialogOpen(true)}
                  className="mt-3 font-medium text-foreground underline underline-offset-4"
                >
                  Añadir contacto
                </button>
              ) : null}
            </div>
          ) : (
            visibleConversations.map((item) => {
              const title = conversationTitle(item, meId);
              const other = item.members.find(
                (member) => member.user.id !== meId,
              )?.user;
              return (
                <button
                  key={item.id}
                  onClick={() => void openConversation(item.id)}
                  className={cn(
                    "chat-conversation",
                    item.id === activeId && "chat-conversation-selected",
                  )}
                  aria-current={item.id === activeId ? "true" : undefined}
                >
                  <Avatar
                    name={title}
                    group={item.kind === "group"}
                    online={item.kind === "direct" && !!other?.online}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold">
                        {title}
                      </span>
                      {item.last_message ? (
                        <span
                          className={cn(
                            "shrink-0 text-[10px]",
                            item.unread_count
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatClock(item.last_message.created_at)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {conversationSubtitle(item, meId)}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {item.last_message ? (
                          <>
                            {item.last_message.sender_id === meId ? (
                              <span className="mr-1 inline-flex align-middle">
                                <MessageTicks
                                  mine
                                  status={item.last_message.status}
                                />
                              </span>
                            ) : null}
                            {messagePreview(item.last_message) ||
                              (item.last_message.attachment
                                ? `📎 ${item.last_message.attachment.name}`
                                : "Mensaje")}
                          </>
                        ) : (
                          "Envía el primer mensaje"
                        )}
                      </span>
                      {mutedChats.includes(item.id) ? (
                        <BellOff
                          className="h-3 w-3 shrink-0 text-muted-foreground"
                          aria-label="Silenciado"
                        />
                      ) : null}
                      {item.unread_count > 0 ? (
                        <span
                          className="chat-unread"
                          aria-label={`${item.unread_count} mensajes sin leer`}
                        >
                          {item.unread_count > 99 ? "99+" : item.unread_count}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        {error && !active ? (
          <p
            role="alert"
            className="m-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}
      </aside>
      <section
        className={cn("chat-thread", !mobileThread && "chat-mobile-hidden")}
        aria-label="Conversación activa"
      >
        {active ? (
          <>
            <header className="chat-thread-header">
              <button
                className="chat-icon-button chat-back"
                onClick={() => setMobileThread(false)}
                aria-label="Volver a los chats"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar
                name={conversationTitle(active, meId)}
                group={active.kind === "group"}
                online={active.kind === "direct" && !!peer?.online}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold">
                  {conversationTitle(active, meId)}
                  {peer?.is_verified && active.kind === "direct" ? (
                    <VerifiedTick />
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {conversationSubtitle(active, meId)}
                  {active.kind === "direct" ? (
                    <span
                      className={cn(
                        "ml-2",
                        peer?.online &&
                          "text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      {presenceLabel(peer)}
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                onClick={() =>
                  setMutedChats(setChatMuted(active.id, !activeMuted))
                }
                className="chat-icon-button"
                aria-label={
                  activeMuted
                    ? "Activar notificaciones"
                    : "Silenciar conversación"
                }
                aria-pressed={activeMuted}
                title={activeMuted ? "Activar notificaciones" : "Silenciar"}
              >
                {activeMuted ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setBackgroundOpen(true)}
                className="chat-icon-button"
                aria-label="Cambiar fondo del chat"
                title="Fondo del chat"
              >
                <Palette className="h-4 w-4" />
              </button>
              {active.kind === "group" &&
              active.members.find((member) => member.user.id === meId)?.role ===
                "owner" ? (
                <InviteButton
                  conversation={active}
                  onInvited={() => void refreshList()}
                />
              ) : null}
            </header>
            <div
              ref={threadRef}
              className="chat-messages"
              style={background.image ? backgroundStyle(background) : undefined}
              role="log"
              aria-label="Mensajes"
              aria-live="polite"
              aria-busy={loadingThread}
              onScroll={() => {
                if (atBottom()) void markVisibleRead(active.id);
              }}
            >
              {hasOlder && !loadingThread ? (
                <div className="mb-5 text-center">
                  <button
                    onClick={() => void loadOlder()}
                    disabled={loadingOlder}
                    className="chat-history-button"
                  >
                    {loadingOlder ? "Cargando…" : "Cargar mensajes anteriores"}
                  </button>
                </div>
              ) : null}
              {loadingThread ? (
                <div className="flex justify-center p-10">
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-label="Cargando mensajes"
                  />
                </div>
              ) : !messages.length ? (
                <div className="py-12 text-center">
                  <span className="chat-day-label">
                    Aquí empieza vuestra conversación.
                  </span>
                </div>
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
                        <p className="my-5 text-center">
                          <span className="chat-day-label">
                            {formatDay(message.created_at)}
                          </span>
                        </p>
                      ) : null}
                      <div
                        className={cn(
                          "chat-message-row group",
                          mine && "chat-message-row-mine",
                        )}
                      >
                        <div
                          className={cn(
                            "chat-bubble",
                            mine ? "chat-bubble-mine" : "chat-bubble-received",
                          )}
                        >
                          {!mine && active.kind === "group" ? (
                            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              {message.sender_username
                                ? `@${message.sender_username}`
                                : message.sender_name}
                              {message.sender_verified ? (
                                <VerifiedTick className="h-3 w-3" />
                              ) : null}
                            </p>
                          ) : null}
                          {message.attachment ? (
                            <AttachmentCard message={message} />
                          ) : null}
                          {message.content ? (
                            <MessageText text={message.content} />
                          ) : null}
                          <p className="chat-bubble-meta">
                            <time dateTime={message.created_at}>
                              {formatClock(message.created_at)}
                            </time>
                            <MessageTicks
                              mine={mine}
                              status={message.status}
                              pending={message.pending}
                            />
                          </p>
                        </div>
                        {!message.pending ? (
                          <button
                            onClick={() => setForwarding(message)}
                            aria-label="Reenviar mensaje"
                            title="Reenviar"
                            className="chat-forward"
                          >
                            <Forward className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            {error ? (
              <p
                role="alert"
                className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive"
              >
                {error}
              </p>
            ) : null}
            {forwardNotice ? (
              <p
                role="status"
                className="px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300"
              >
                Reenviado a {forwardNotice}
              </p>
            ) : null}
            <div
              className="chat-composer"
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files"))
                  event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files[0] ?? null);
              }}
            >
              {file ? (
                <div className="chat-file-preview">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt={`Vista previa de ${file.name}`}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <FileText className="h-7 w-7 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{file.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="chat-icon-button"
                    aria-label="Quitar adjunto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {extrasOpen ? (
                <ChatExtrasPicker
                  level={level}
                  onEmoji={(emoji) => {
                    setDraft((text) => text + emoji);
                    composerRef.current?.focus();
                  }}
                  onSticker={(sticker) =>
                    void handleSend(stickerMessage(sticker.id))
                  }
                  onClose={() => setExtrasOpen(false)}
                />
              ) : null}
              <div className="flex items-end gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  className="hidden"
                  aria-label="Seleccionar foto o documento"
                  onChange={(event) => {
                    selectFile(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
                <button
                  onClick={() => setExtrasOpen((value) => !value)}
                  className="chat-icon-button"
                  aria-label="Emojis y stickers"
                  aria-expanded={extrasOpen}
                >
                  <SmilePlus className="h-5 w-5" />
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="chat-icon-button"
                  aria-label="Adjuntar foto o documento"
                  title="Adjuntar foto o documento"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <textarea
                  ref={composerRef}
                  value={draft}
                  maxLength={4000}
                  onChange={(event) => setDraft(event.target.value)}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.files[0];
                    if (pasted) {
                      event.preventDefault();
                      selectFile(pasted);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Escribe un mensaje"
                  aria-label="Mensaje"
                  className="chat-textarea"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={
                    sending || loadingThread || (!draft.trim() && !file)
                  }
                  className="chat-send"
                  aria-label="Enviar mensaje"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 pl-2 text-[10px] text-muted-foreground">
                Enter para enviar · Mayús + Enter para otra línea · Adjuntos
                hasta 25 MB
              </p>
            </div>
          </>
        ) : (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <MessageSquarePlus className="h-10 w-10" strokeWidth={1.3} />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              Tu espacio para conversar
            </h2>
            <p className="max-w-[270px] text-sm leading-relaxed text-muted-foreground">
              Comparte apuntes, fotos e ideas con tus compañeros. Solo necesitas
              su @usuario.
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="mt-2 rounded-full"
            >
              <Plus className="h-4 w-4" /> Nuevo chat
            </Button>
          </div>
        )}
      </section>
      {dialogOpen ? (
        <NewConversationDialog
          onClose={() => setDialogOpen(false)}
          onCreated={(item) => {
            setDialogOpen(false);
            setConversations((current) =>
              sortConversations([
                ...current.filter((other) => other.id !== item.id),
                item,
              ]),
            );
            void openConversation(item.id);
          }}
        />
      ) : null}
      {backgroundOpen && active ? (
        <ChatBackgroundPicker
          conversationTitle={conversationTitle(active, meId)}
          current={background}
          onSelect={(next) => {
            saveChatBackground(active.id, next);
            setBackground(next);
            setBackgroundOpen(false);
          }}
          onClose={() => setBackgroundOpen(false)}
        />
      ) : null}
      {forwarding && active ? (
        <ChatForwardModal
          message={forwarding}
          preview={
            forwarding.attachment && !forwarding.content
              ? `Adjunto: ${forwarding.attachment.name}`
              : messagePreview(forwarding)
          }
          targets={forwardTargets}
          onClose={() => setForwarding(null)}
          onForwarded={(title) => {
            setForwardNotice(title);
            void refreshList();
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const dialogMounted = useRef(true);
  closeRef.current = onClose;

  useEffect(() => {
    dialogMounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const release = lockBodyScroll();
    dialogRef.current
      ?.querySelector<HTMLInputElement>("#chat-contact-search")
      ?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), [tabindex='0']",
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      dialogMounted.current = false;
      release();
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const term = query.trim().replace(/^@/, "").toLowerCase();
    setResults([]);
    setError(null);
    if (!term) {
      setSearching(false);
      return;
    }
    if (!/^[a-z0-9_]{1,24}$/.test(term)) {
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      chatApi
        .users(term)
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch((caught) => {
          if (!cancelled) {
            setResults([]);
            setError(readError(caught));
          }
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
      setSelected((current) => current[0]?.id === user.id ? [] : [user]);
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
        usernames: selected
          .map((user) => user.username)
          .filter((name): name is string => !!name),
      });
      if (dialogMounted.current) onCreated(conversation);
    } catch (createError) {
      if (dialogMounted.current) setError(readError(createError));
    } finally {
      if (dialogMounted.current) setBusy(false);
    }
  }

  return createPortal(
    <div
      className="chat-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-chat-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="chat-dialog">
        <div className="flex items-center justify-between">
          <h2
            id="new-chat-title"
            className="text-lg font-semibold tracking-tight"
          >
            Nuevo chat
          </h2>
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

        <label
          htmlFor="chat-contact-search"
          className="mt-4 block text-xs font-medium"
        >
          Añadir contacto por @usuario
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            id="chat-contact-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="@alejandro"
            autoComplete="off"
            spellCheck={false}
            maxLength={25}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </div>

        <div
          className="mt-2 max-h-56 overflow-y-auto"
          aria-live="polite"
          aria-busy={searching}
        >
          {searching && results.length === 0 ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              <AtSign className="mx-auto mb-1 h-5 w-5 opacity-50" />
              {query.trim()
                ? "No encontramos ese @usuario."
                : "Escribe el @usuario de tu compañero para empezar."}
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
                    <span className="flex items-center gap-1 truncate font-medium">
                      {user.display_name}
                      {user.is_verified ? (
                        <VerifiedTick className="h-3 w-3" />
                      ) : null}
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
          <Button
            type="button"
            size="sm"
            onClick={() => void create()}
            disabled={busy || selected.length === 0}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "direct" ? (
              "Abrir chat"
            ) : (
              "Crear grupo"
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
