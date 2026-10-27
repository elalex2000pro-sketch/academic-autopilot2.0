"use client";

import { lazy, Suspense } from "react";

import type { StudioMode } from "@/components/ia-studio";
import { ViewLoading } from "@/components/view-loading";

const IAStudio = lazy(() =>
  import("@/components/ia-studio").then((module) => ({
    default: module.IAStudio,
  })),
);

export function StudioPageView({ initialMode }: { initialMode: StudioMode }) {
  return (
    <Suspense fallback={<ViewLoading label="Cargando IA Studio…" />}>
      <IAStudio initialMode={initialMode} />
    </Suspense>
  );
}
