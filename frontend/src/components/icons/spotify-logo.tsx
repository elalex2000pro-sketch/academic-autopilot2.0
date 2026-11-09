import type { SVGProps } from "react";

/** Isotipo de Spotify (tres ondas), monocromo para encajar en el rail. */
export function SpotifyLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.503 17.309a.75.75 0 0 1-1.031.25c-2.824-1.725-6.378-2.116-10.565-1.159a.75.75 0 1 1-.334-1.462c4.582-1.046 8.508-.595 11.68 1.34a.75.75 0 0 1 .25 1.031Zm1.47-3.27a.938.938 0 0 1-1.289.309c-3.232-1.986-8.158-2.561-11.98-1.401a.938.938 0 1 1-.546-1.797c4.365-1.326 9.797-.686 13.506 1.595a.938.938 0 0 1 .309 1.294Zm.126-3.405c-3.876-2.301-10.273-2.513-13.975-1.389a1.125 1.125 0 1 1-.655-2.154c4.249-1.291 11.31-1.041 15.762 1.602a1.125 1.125 0 1 1-1.132 1.941Z" />
    </svg>
  );
}
