// Secciones de la biblioteca local. El id se guarda en cada PDF (IndexedDB);
// las etiquetas viven aquí para que pestañas y menús no se desincronicen.
export type LibraryCategoryId = "apuntes" | "libros-smr" | "lectura" | "otros";

export interface LibraryCategory {
  id: LibraryCategoryId;
  label: string;
  hint: string;
}

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  { id: "apuntes", label: "Apuntes", hint: "Apuntes de clase y resúmenes" },
  { id: "libros-smr", label: "Libros SMR", hint: "Manuales y libros del ciclo" },
  { id: "lectura", label: "Lectura", hint: "Lectura personal" },
  { id: "otros", label: "Otros", hint: "Sin clasificar" },
];

/** Los PDFs nuevos caen en Apuntes, que es el caso más habitual en clase. */
export const DEFAULT_LIBRARY_CATEGORY: LibraryCategoryId = "apuntes";

/** Los PDFs importados antes de existir las secciones quedan en Otros. */
export const LEGACY_LIBRARY_CATEGORY: LibraryCategoryId = "otros";

export function normalizeCategory(value: unknown): LibraryCategoryId {
  return LIBRARY_CATEGORIES.some((category) => category.id === value)
    ? (value as LibraryCategoryId)
    : LEGACY_LIBRARY_CATEGORY;
}

export function categoryLabel(id: string): string {
  return LIBRARY_CATEGORIES.find((category) => category.id === id)?.label ?? "Otros";
}
