/**
 * Normaliza los nombres de archivo que llegan del backend o del selector del
 * sistema. Algunos servidores/proxies decodifican el multipart como latin-1 y
 * convierten "Digitalización Aplicada" en "DigitalizaciÃ³n Aplicada"; aquí se
 * repara ese mojibake y se aplica NFC para que las tildes y la ñ se comparen y
 * se muestren siempre igual.
 */
export function normalizeFilename(name: string): string {
  if (!name) return name;

  let value = name;

  // Solo intentamos reparar si hay marcas típicas de UTF-8 leído como latin-1.
  if (/[ÃÂâð]/.test(value)) {
    try {
      const bytes = Uint8Array.from(value, (character) =>
        character.charCodeAt(0) & 0xff,
      );
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (decoded && decoded !== value) value = decoded;
    } catch {
      // No era mojibake UTF-8: se conserva el nombre original.
    }
  }

  return value.normalize("NFC");
}

/** Devuelve una copia del documento con el nombre ya normalizado. */
export function normalizeDocumentFilename<T extends { filename: string }>(item: T): T {
  const filename = normalizeFilename(item.filename);
  return filename === item.filename ? item : { ...item, filename };
}
