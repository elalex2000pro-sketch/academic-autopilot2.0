// Catálogo de modelos de Gemini que se pueden elegir en Ajustes y en la
// cabecera de IA Studio. El valor es el ID exacto que recibe la API.
export interface GeminiModelOption {
  value: string;
  label: string;
  /** Google ya no sirve el modelo; se conserva para equipos que lo pidan. */
  retired?: boolean;
}

export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash · rápido y actual" },
  { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash · tareas complejas y agentes" },
  { value: "gemini-3.7-flash", label: "Gemini 3.7 Flash · programación y razonamiento" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview · razonamiento avanzado" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro · razonamiento avanzado" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite · el más ligero" },
  {
    value: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash · clásico rápido",
    retired: true,
  },
  {
    value: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro · clásico, 2M de contexto",
    retired: true,
  },
];

export const GEMINI_RETIRED_NOTE =
  "Google retiró los modelos 1.5 en septiembre de 2025. Si tu clave responde 404, elige un modelo 2.5.";

/** Nombre corto para la cabecera del chat (sin la descripción). */
export function shortGeminiModelLabel(value: string): string {
  const preset = GEMINI_MODEL_OPTIONS.find((option) => option.value === value);
  return preset ? preset.label.split(" · ")[0] : value;
}
