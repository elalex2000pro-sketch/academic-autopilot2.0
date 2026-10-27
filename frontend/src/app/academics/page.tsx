"use client";

import { lazy, Suspense } from "react";

import { ViewLoading } from "@/components/view-loading";

const AcademicsView = lazy(() =>
  import("@/components/academics-view").then((module) => ({
    default: module.AcademicsView,
  })),
);

export default function AcademicsPage() {
  return (
    <Suspense fallback={<ViewLoading label="Cargando Académico…" />}>
      <AcademicsView />
    </Suspense>
  );
}
