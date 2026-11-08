"use client";

import { lazy, Suspense } from "react";

import { ViewLoading } from "@/components/view-loading";

// Ajustes es una ruta secundaria: su código (formularios, integraciones y
// subpaneles) se descarga solo al entrar, no en el arranque del dashboard.
const SettingsView = lazy(() =>
  import("@/components/settings-view").then((module) => ({
    default: module.SettingsView,
  })),
);

export default function SettingsPage() {
  return (
    <Suspense fallback={<ViewLoading label="Cargando ajustes…" />}>
      <SettingsView />
    </Suspense>
  );
}
