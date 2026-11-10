/**
 * Candado de scroll del `body` con contador.
 *
 * Antes cada overlay guardaba el `overflow` previo y lo restauraba al cerrarse.
 * Con dos overlays solapados, el segundo guardaba `"hidden"` y al cerrarse lo
 * devolvía tal cual: el `body` quedaba bloqueado para siempre y la rueda no
 * movía ninguna sección. Con un contador global solo se restaura cuando el
 * último overlay libera el candado.
 */
let locks = 0;
let previousOverflow = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = "";
    }
  };
}
