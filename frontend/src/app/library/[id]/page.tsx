"use client";

import { lazy, Suspense } from "react";

import { ViewLoading } from "@/components/view-loading";

const BookReaderView = lazy(() => import("@/components/book-reader-view"));

export default function BookReaderPage() {
  return (
    <Suspense fallback={<ViewLoading label="Abriendo el libro…" />}>
      <BookReaderView />
    </Suspense>
  );
}
