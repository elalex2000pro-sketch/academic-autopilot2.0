import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Isotipo de Academic Autopilot.
 *
 * Dos chevrones ascendentes superpuestos —despegue y progreso— trazados con un
 * degradado azul→violeta. Es SVG puro, sin fondo ni dependencias: se ve igual
 * sobre el rail carbón, el cristal claro o el login.
 */
const GRADIENT_ID = "autopilot-mark-gradient";

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient
          id={GRADIENT_ID}
          x1="12"
          y1="50"
          x2="52"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4F86FF" />
          <stop offset="0.55" stopColor="#7B8CFF" />
          <stop offset="1" stopColor="#B57BFF" />
        </linearGradient>
      </defs>
      <g
        stroke={`url(#${GRADIENT_ID})`}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 50L32 14L52 50" />
        <path d="M23 45L32 29L41 45" />
      </g>
    </svg>
  );
}
