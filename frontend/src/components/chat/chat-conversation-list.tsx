"use client";

import type * as React from "react";
import type { Dispatch, SetStateAction } from "react";
import { MessageTicks, Avatar } from "@/components/chat/chat-message-content";
import { conversationTitle, conversationSubtitle, formatClock, messagePreview } from "@/lib/chat-format";
import { BellOff, Loader2, MessageSquarePlus } from "lucide-react";
import type { ChatConversation } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  loadingList: boolean;
  visibleConversations: ChatConversation[];
  query: string;
  setDialogOpen: Dispatch<SetStateAction<boolean>>;
  meId: string;
  openConversation: (id: string) => Promise<void>;
  activeId: string | null;
  mutedChats: string[];
};

export function ChatConversationList({
  loadingList,
  visibleConversations,
  query,
  setDialogOpen,
  meId,
  openConversation,
  activeId,
  mutedChats,
}: Props) {
  return (
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
  );
}
