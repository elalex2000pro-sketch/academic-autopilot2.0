"use client";

import { lazy, Suspense } from "react";

import { ViewLoading } from "@/components/view-loading";

const LibraryView = lazy(() => import("@/components/library-view"));

export default function LibraryPage() {
  return (
    <Suspense fallback={<ViewLoading label="Cargando biblioteca…" />}>
      <LibraryView />
    </Suspense>
  );
}
