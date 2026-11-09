"use client";

import { ErrorFallback } from "@/components/error-boundary";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} onRetry={reset} />;
}
