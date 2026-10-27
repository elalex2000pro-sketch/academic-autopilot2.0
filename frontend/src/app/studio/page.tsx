import type { Metadata } from "next";

import type { StudioMode } from "@/components/ia-studio";
import { StudioPageView } from "@/components/studio-page-view";

export const metadata: Metadata = {
  title: "IA Studio",
  description: "Chat tutor, transcripción de audio y análisis de documentos en un solo lugar.",
};

const MODES: StudioMode[] = ["chat", "audio", "document"];

export default function StudioPage({
  searchParams,
}: {
  searchParams?: { mode?: string | string[] };
}) {
  const raw = Array.isArray(searchParams?.mode) ? searchParams?.mode[0] : searchParams?.mode;
  const initialMode = MODES.includes(raw as StudioMode) ? (raw as StudioMode) : "chat";
  return <StudioPageView initialMode={initialMode} />;
}
