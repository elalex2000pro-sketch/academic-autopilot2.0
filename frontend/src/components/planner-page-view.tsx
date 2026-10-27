"use client";

import { lazy, Suspense } from "react";

import { ViewLoading } from "@/components/view-loading";

const PlannerView = lazy(() =>
  import("@/components/planner-view").then((module) => ({
    default: module.PlannerView,
  })),
);

export function PlannerPageView({
  defaultOpenTools = false,
}: {
  defaultOpenTools?: boolean;
}) {
  return (
    <Suspense fallback={<ViewLoading label="Cargando planificador…" />}>
      <PlannerView defaultOpenTools={defaultOpenTools} />
    </Suspense>
  );
}
