"use client";

import dynamic from "next/dynamic";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "@/components/library/pdf-reader.css";

import { ViewLoading } from "@/components/view-loading";

const BookReaderView = dynamic(
  () => import("@/components/book-reader-view"),
  {
    ssr: false,
    loading: () => <ViewLoading label="Abriendo el PDF…" />,
  },
);

export default function BookReaderPage() {
  return <BookReaderView />;
}
