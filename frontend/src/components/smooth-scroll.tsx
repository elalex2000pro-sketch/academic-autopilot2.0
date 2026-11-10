"use client";

// Scroll con inercia en toda la app.
//
// La rueda del ratón del navegador mueve la página a saltos: `scroll-behavior`
// solo afecta a los desplazamientos programáticos, no a la rueda. Lenis
// intercepta la rueda y anima el desplazamiento con un lerp, que es lo que da
// la sensación de deslizamiento.
//
// Se respeta el modo de animación reducida: en ese caso no se instala nada y el
// scroll vuelve a ser el nativo, sin inercia.
import Lenis from "lenis";
import { useEffect } from "react";

import { usePreferences } from "@/components/preferences-provider";

// Paneles con su propio scroll (chat, cajones, tablas...): dentro de ellos el
// gesto debe seguir siendo nativo, no mover la página de detrás.
function hasOwnScroll(node: HTMLElement | null): boolean {
  let element: HTMLElement | null = node;
  while (element && element !== document.body && element !== document.documentElement) {
    const style = window.getComputedStyle(element);
    const vertical =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      element.scrollHeight - element.clientHeight > 1;
    const horizontal =
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      element.scrollWidth - element.clientWidth > 1;
    if (vertical || horizontal) return true;
    element = element.parentElement;
  }
  return false;
}

export function SmoothScroll() {
  const { animationLevel } = usePreferences();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animationLevel === "reduced" || prefersReduced) return;

    const lenis = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      // Un poco más de recorrido en el modo ultra, como el resto de animaciones.
      lerp: animationLevel === "ultra" ? 0.12 : 0.09,
      wheelMultiplier: 1,
      prevent: (node) => hasOwnScroll(node),
    });

    // Con un modal o cajón abierto el shell bloquea el body: si Lenis siguiera
    // activo, la rueda movería la página que queda detrás.
    const sync = () => {
      if (document.body.style.overflow === "hidden") lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });
    sync();

    return () => {
      observer.disconnect();
      lenis.destroy();
    };
  }, [animationLevel]);

  return null;
}
