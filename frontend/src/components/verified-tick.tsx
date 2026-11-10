import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** Tick azul de cuenta verificada, junto al nombre en el chat. */
export function VerifiedTick({
  className,
  label = "Cuenta verificada",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center"
    >
      <BadgeCheck
        strokeWidth={2.4}
        className={cn("h-3.5 w-3.5 text-[#0a84ff]", className)}
      />
    </span>
  );
}
