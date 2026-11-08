"use client";

import { lazy, Suspense } from "react";

import { ViewLoading } from "@/components/view-loading";

const ChatView = lazy(() =>
  import("@/components/chat-view").then((module) => ({ default: module.ChatView })),
);

export function ChatPageView() {
  return (
    <Suspense fallback={<ViewLoading label="Cargando chat…" />}>
      <ChatView />
    </Suspense>
  );
}
