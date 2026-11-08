import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Isotipo geométrico de Academic Autopilot.
 *
 * Un hexágono central del que nacen seis pétalos entrelazados, con simetría
 * radial de 60°. Es SVG puro, sin fondo y monocromo: hereda `currentColor`,
 * así que funciona igual sobre el rail carbón, el cristal claro o el login.
 */
const HEXAGON_PATH =
  "M42 32L37 40.66L27 40.66L22 32L27 23.34L37 23.34Z";
const PETAL_PATH =
  "M27 23.34C23.8 16 26 9.6 32 5.6C38 9.6 40.2 16 37 23.34";
const PETAL_ROTATIONS = [0, 60, 120, 180, 240, 300] as const;

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
      <g
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={HEXAGON_PATH} />
        {PETAL_ROTATIONS.map((angle) => (
          <path
            key={angle}
            d={PETAL_PATH}
            transform={`rotate(${angle} 32 32)`}
          />
        ))}
      </g>
    </svg>
  );
}
