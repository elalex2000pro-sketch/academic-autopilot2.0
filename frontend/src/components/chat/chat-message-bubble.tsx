"use client";

import type { ReactNode } from "react";
import { Forward } from "lucide-react";
import { MessageText, MessageTicks } from "@/components/chat/chat-message-content";
import { VerifiedTick } from "@/components/verified-tick";
import { formatClock, formatDay } from "@/lib/chat-format";
import type { ChatConversation, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  mine: boolean;
  newDay: boolean;
  kind: ChatConversation["kind"];
  attachment: ReactNode;
  onForward: (message: ChatMessage) => void;
}

export function ChatMessageBubble({
  message,
  mine,
  newDay,
  kind,
  attachment,
  onForward,
}: ChatMessageBubbleProps) {
  return (
    <div>
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
          {!mine && kind === "group" ? (
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {message.sender_username
                ? `@${message.sender_username}`
                : message.sender_name}
              {message.sender_verified ? (
                <VerifiedTick className="h-3 w-3" />
              ) : null}
            </p>
          ) : null}
          {attachment}
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
            onClick={() => onForward(message)}
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
}
