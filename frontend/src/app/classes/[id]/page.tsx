"use client";

import { lazy, Suspense } from "react";

import { ViewLoading } from "@/components/view-loading";

const ClassDetailView = lazy(() => import("@/components/class-detail-view"));

export default function ClassDetailPage() {
  return (
    <Suspense fallback={<ViewLoading label="Cargando la clase…" />}>
      <ClassDetailView />
    </Suspense>
  );
}
