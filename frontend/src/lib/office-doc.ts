// Exportacion de documentos de Academic-Office: HTML y PDF; DOCX nativo en office-docx.ts.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DOCUMENT_STYLES = `
  @page { size: A4; margin: 2cm; }
  body {
    font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #111827;
  }
  h1 { font-size: 22pt; line-height: 1.25; margin: 0 0 12pt; }
  h2 { font-size: 16pt; margin: 18pt 0 8pt; }
  h3 { font-size: 13pt; margin: 14pt 0 6pt; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 0 0 10pt 18pt; padding: 0; }
  li { margin-bottom: 4pt; }
  blockquote {
    margin: 10pt 0;
    padding: 6pt 12pt;
    border-left: 3pt solid #2563eb;
    color: #374151;
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 0.75pt solid #9ca3af; padding: 4pt 6pt; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 10pt; }
  a { color: #1d4ed8; }
  hr { border: 0; border-top: 0.75pt solid #d1d5db; margin: 12pt 0; }
`;

export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/** Documento HTML completo, con estilos de impresion y metadatos de Word. */
export function buildDocumentHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40" lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
<![endif]-->
<style>${DOCUMENT_STYLES}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

export function downloadFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportDocumentAsHtml(title: string, bodyHtml: string): void {
  downloadFile(
    `${title}.html`,
    new Blob([buildDocumentHtml(title, bodyHtml)], { type: "text/html" }),
  );
}

/** PDF mediante el dialogo de impresion del navegador (Guardar como PDF). */
export function printDocumentAsPdf(title: string, bodyHtml: string): void {
  const frame = window.open("", "_blank", "width=900,height=760");
  if (!frame) return;
  frame.document.open();
  frame.document.write(buildDocumentHtml(title, bodyHtml));
  frame.document.close();
  frame.focus();
  setTimeout(() => frame.print(), 350);
}

/** Nombre de archivo seguro a partir del titulo del documento. */
export function safeFileName(title: string): string {
  const clean = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return clean || "Documento sin titulo";
}
