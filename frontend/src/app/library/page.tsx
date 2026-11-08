"use client";

import dynamic from "next/dynamic";

import { ViewLoading } from "@/components/view-loading";

const LibraryView = dynamic(() => import("@/components/library-view"), {
  ssr: false,
  loading: () => <ViewLoading label="Cargando biblioteca…" />,
});

export default function LibraryPage() {
  return <LibraryView />;
}
