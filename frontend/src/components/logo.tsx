import { cn } from "@/lib/utils";

/**
 * Marca abstracta de Academic Autopilot.
 *
 * Es SVG puro, monocromo y hereda `currentColor`, de modo que funciona igual
 * sobre el rail carbón, el cristal claro o el login. No contiene imágenes ni
 * degradados saturados.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path
        d="M16 3.25c7.04 0 12.75 5.71 12.75 12.75S23.04 28.75 16 28.75 3.25 23.04 3.25 16 8.96 3.25 16 3.25Z"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.3"
      />
      <path
        d="M9.2 23.1 14.35 8.9h3.3L22.8 23.1"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.55 18.1h8.9"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <circle cx="24.9" cy="8.6" r="2.35" fill="currentColor" />
    </svg>
  );
}
