"use client";

import type * as React from "react";
import type { Dispatch, SetStateAction } from "react";
import { Avatar } from "@/components/chat/chat-message-content";
import { conversationTitle, conversationSubtitle, presenceLabel } from "@/lib/chat-format";
import { ArrowLeft, Bell, BellOff, Palette } from "lucide-react";
import { VerifiedTick } from "@/components/verified-tick";
import { setChatMuted } from "@/lib/chat-mutes";
import type { ChatConversation, ChatUser } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  setMobileThread: Dispatch<SetStateAction<boolean>>;
  active: ChatConversation;
  meId: string;
  peer: ChatUser | undefined;
  setMutedChats: Dispatch<SetStateAction<string[]>>;
  activeMuted: boolean;
  setBackgroundOpen: Dispatch<SetStateAction<boolean>>;
  InviteButton: ({ conversation, onInvited, }: { conversation: ChatConversation; onInvited: () => void; }) => JSX.Element | null;
  refreshList: () => Promise<void>;
};

export function ChatThreadHeader({
  setMobileThread,
  active,
  meId,
  peer,
  setMutedChats,
  activeMuted,
  setBackgroundOpen,
  InviteButton,
  refreshList,
}: Props) {
  return (
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
  );
}
