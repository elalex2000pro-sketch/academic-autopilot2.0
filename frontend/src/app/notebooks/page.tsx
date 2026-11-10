"use client";

import { motion } from "framer-motion";
import { pageItem, pageStagger } from "@/components/page-animated-wrapper";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  LayoutTemplate,
  Loader2,
  NotebookPen,
  Plus,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { NotebookChat } from "@/components/notebook-chat";
import { useAuth } from "@/components/auth-provider";
import { api, ApiError } from "@/lib/api";
import { NEW_NOTEBOOK_EVENT } from "@/lib/documents";
import {
  deleteNotebookDraft,
  getNotebookDraft,
  saveNotebookDraft,
} from "@/lib/local-cache";
import type { Book, DocumentFile, Notebook, NotebookSource, SharedClass } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
];

const TEMPLATES: { name: string; description: string; title: string; content: string }[] = [
  {
    name: "Cuaderno en blanco",
    description: "Empieza desde cero.",
    title: "Cuaderno sin título",
    content: "",
  },
  {
    name: "Método Cornell",
    description: "Preguntas, notas y resumen en columnas.",
    title: "Apuntes Cornell",
    content:
      "# Tema\n\n## Preguntas clave\n- \n- \n\n## Notas\n\n\n## Resumen\n\n",
  },
  {
    name: "Apuntes de clase",
    description: "Ideal para tomar notas en directo.",
    title: "Apuntes de clase",
    content:
      "# Título de la clase\n\n**Fecha:** \n**Profesor/a:** \n\n## Ideas clave\n- \n- \n\n## Desarrollo\n\n\n## Dudas para preguntar\n- \n",
  },
  {
    name: "Práctica de laboratorio",
    description: "Objetivo, materiales, pasos y conclusiones.",
    title: "Práctica de laboratorio",
    content:
      "# Práctica: título\n\n## Objetivo\n\n## Materiales\n- \n- \n\n## Procedimiento\n1. \n2. \n\n## Resultados\n\n## Conclusiones\n\n",
  },
  {
    name: "Preparar un examen",
    description: "Temario, preguntas y puntos débiles.",
    title: "Preparación de examen",
    content:
      "# Examen de ...\n\n**Fecha:** \n\n## Temario\n- \n- \n\n## Preguntas clave\n1. \n2. \n\n## Resumen\n\n## Puntos débiles\n- \n",
  },
  {
    name: "Proyecto",
    description: "Planificación, tareas y entregables.",
    title: "Proyecto",
    content:
      "# Nombre del proyecto\n\n## Objetivo\n\n## Tareas\n- [ ] \n- [ ] \n\n## Entregables\n- \n\n## Notas\n\n",
  },
];

type Draft = { title: string; color: string; content: string };

function toDraft(notebook: Notebook): Draft {
  return {
    title: notebook.title,
    color: notebook.color || "#6366f1",
    content: notebook.content || "",
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: "", color: "#6366f1", content: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [classes, setClasses] = useState<SharedClass[]>([]);
  const [shareClassId, setShareClassId] = useState("");
  const [sharePermission, setSharePermission] = useState<"read" | "edit">("read");
  const [sharing, setSharing] = useState(false);
  const [sources, setSources] = useState<NotebookSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [sourceTab, setSourceTab] = useState<"book" | "file">("book");
  const [sourceBooks, setSourceBooks] = useState<Book[]>([]);
  const [sourceFiles, setSourceFiles] = useState<DocumentFile[]>([]);
  const [sourceBooksLoading, setSourceBooksLoading] = useState(false);
  const [sourceFilesLoading, setSourceFilesLoading] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const [pickedBook, setPickedBook] = useState("");
  const [pickedDocument, setPickedDocument] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [sourceActionId, setSourceActionId] = useState<string | null>(null);
  const { user } = useAuth();

  const draftRef = useRef<Draft>(draft);
  draftRef.current = draft;
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;

  // Documentos puede pedir un apunte nuevo sin salir de la sección.
  useEffect(() => {
    const onNew = () => setShowTemplates(true);
    window.addEventListener(NEW_NOTEBOOK_EVENT, onNew);
    return () => window.removeEventListener(NEW_NOTEBOOK_EVENT, onNew);
  }, []);

  const selected = useMemo(
    () => notebooks.find((notebook) => notebook.id === selectedId) ?? null,
    [notebooks, selectedId],
  );

  const load = useCallback(async () => {
    const data = await api.notebooks();
    setNotebooks(data);
    if (data.length > 0) {
      setSelectedId((current) => current ?? data[0].id);
    }
  }, []);

  useEffect(() => {
    load().catch((error) => setNotice(errorMessage(error)));
    api
      .classes()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [load]);

  // Al cambiar de cuaderno, se carga su contenido en el editor. Si hay una
  // copia local más reciente (por ejemplo, editada sin conexión), se recupera.
  useEffect(() => {
    if (!selected) return;
    const base = toDraft(selected);
    setDraft(base);
    setDirty(false);
    setLocalOnly(false);
    setSavedAt(null);
    setShareClassId(selected.shared_class_id ?? "");
    setSharePermission(selected.share_permission === "edit" ? "edit" : "read");

    let cancelled = false;
    getNotebookDraft(selected.id)
      .then((saved) => {
        if (cancelled || !saved) return;
        const local = { title: saved.title, color: saved.color, content: saved.content };
        if (JSON.stringify(local) === JSON.stringify(base)) {
          void deleteNotebookDraft(selected.id);
          return;
        }
        setDraft(local);
        setDirty(false);
        setLocalOnly(true);
        setSavedAt(
          new Date(saved.savedAt).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        setNotice(
          "Recuperados cambios guardados en este dispositivo. Se sincronizarán al volver la conexión.",
        );
      })
      .catch(() => {
        // Sin IndexedDB se usa directamente la copia del servidor.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) {
      setSources([]);
      return;
    }
    let cancelled = false;
    setSourcesLoading(true);
    api
      .notebookSources(selectedId)
      .then((data) => {
        if (!cancelled) setSources(data);
      })
      .catch((error) => {
        if (!cancelled) setNotice(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!showSourcePicker) return;
    setSourceBooksLoading(true);
    setSourceFilesLoading(true);
    setPickedBook("");
    setPickedDocument("");
    setSourceSearch("");
    api
      .books()
      .then(setSourceBooks)
      .catch((error) => setNotice(errorMessage(error)))
      .finally(() => setSourceBooksLoading(false));
    api
      .files()
      .then(setSourceFiles)
      .catch((error) => setNotice(errorMessage(error)))
      .finally(() => setSourceFilesLoading(false));
  }, [showSourcePicker]);

  const canManageSources = Boolean(selected && user && selected.user_id === user.id);

  const filteredSourceBooks = useMemo(() => {
    const term = sourceSearch.trim().toLowerCase();
    if (!term) return sourceBooks;
    return sourceBooks.filter((book) =>
      `${book.title} ${book.author ?? ""}`.toLowerCase().includes(term),
    );
  }, [sourceBooks, sourceSearch]);

  const filteredSourceFiles = useMemo(() => {
    const term = sourceSearch.trim().toLowerCase();
    if (!term) return sourceFiles;
    return sourceFiles.filter((file) => file.filename.toLowerCase().includes(term));
  }, [sourceFiles, sourceSearch]);

  const save = useCallback(
    async (id: string, payload: Draft) => {
      setSaving(true);
      setNotice(null);
      try {
        const updated = await api.updateNotebook(id, payload);
        const isCurrent = JSON.stringify(draftRef.current) === JSON.stringify(payload);
        if (isCurrent) {
          await deleteNotebookDraft(id);
          if (selectedIdRef.current === id) setLocalOnly(false);
        }
        setNotebooks((prev) =>
          prev.map((notebook) => (notebook.id === id ? updated : notebook)),
        );
        if (isCurrent && selectedIdRef.current === id) {
          setDirty(false);
          setSavedAt(
            new Date().toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
      } catch (error) {
        const offline =
          error instanceof ApiError &&
          (error.status === 0 || [502, 503, 504].includes(error.status));
        if (offline) {
          // Sin red (o con el servidor caído): los apuntes se guardan en el
          // dispositivo y se reintenta la sincronización al recuperar la conexión.
          await saveNotebookDraft(id, payload);
          const isCurrent = JSON.stringify(draftRef.current) === JSON.stringify(payload);
          if (isCurrent && selectedIdRef.current === id) {
            setDirty(false);
            setSavedAt(
              new Date().toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            );
            setLocalOnly(true);
            setNotice(
              "No hay conexión con el servidor: los cambios están guardados en este dispositivo. Se sincronizarán cuando vuelva internet.",
            );
          }
        } else if (selectedIdRef.current === id) {
          setNotice(errorMessage(error));
        }
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // Guarda también una copia en IndexedDB mientras se escribe. Así no se
  // pierden los apuntes si la conexión cae antes del autoguardado del servidor.
  useEffect(() => {
    if (!selectedId || !dirty) return;
    const timeout = setTimeout(() => {
      void saveNotebookDraft(selectedId, draft);
    }, 300);
    return () => clearTimeout(timeout);
  }, [draft, dirty, selectedId]);

  // Al volver la conexión se reintenta guardar lo que quedó solo en local.
  useEffect(() => {
    const retry = () => {
      if (selectedId && (dirty || localOnly)) {
        void save(selectedId, draftRef.current);
      }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [dirty, localOnly, save, selectedId]);

  // Si al abrir la app ya hay internet, sincroniza los cambios recuperados de
  // IndexedDB sin obligar a pulsar "Sincronizar".
  useEffect(() => {
    if (!selectedId || !localOnly || dirty || !navigator.onLine) return;
    const timeout = setTimeout(() => {
      void save(selectedId, draftRef.current);
    }, 900);
    return () => clearTimeout(timeout);
  }, [dirty, localOnly, save, selectedId]);

  // Autoguardado con retardo para no escribir en cada pulsacion.
  useEffect(() => {
    if (!selectedId || !dirty) return;
    const timeout = setTimeout(() => {
      void save(selectedId, draft);
    }, 1200);
    return () => clearTimeout(timeout);
  }, [draft, dirty, selectedId, save]);

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function selectNotebook(id: string) {
    if (id === selectedId) return;
    if (dirty && selectedId) void save(selectedId, draft);
    setSelectedId(id);
  }

  async function createNotebook(templateIndex = 0) {
    setCreating(true);
    setNotice(null);
    const template = TEMPLATES[templateIndex] ?? TEMPLATES[0];
    try {
      const created = await api.createNotebook({
        title: template.title,
        color: COLORS[notebooks.length % COLORS.length],
        content: template.content,
      });
      setNotebooks((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setLocalOnly(false);
      setShowTemplates(false);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function shareWithClass() {
    if (!selected || !shareClassId) {
      setNotice("Selecciona una clase para compartir el cuaderno.");
      return;
    }
    setSharing(true);
    try {
      const updated = await api.shareNotebook(selected.id, {
        class_id: shareClassId,
        permission: sharePermission,
      });
      setNotebooks((prev) =>
        prev.map((notebook) => (notebook.id === updated.id ? updated : notebook)),
      );
      setNotice(
        `Compartido con la clase en modo ${
          sharePermission === "edit" ? "edición" : "solo lectura"
        }. Tus compañeros lo verán en la pestaña Cuadernos de la clase.`,
      );
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSharing(false);
    }
  }

  async function stopSharing() {
    if (!selected) return;
    setSharing(true);
    try {
      const updated = await api.unshareNotebook(selected.id);
      setNotebooks((prev) =>
        prev.map((notebook) => (notebook.id === updated.id ? updated : notebook)),
      );
      setShareClassId("");
      setNotice("El cuaderno ha dejado de estar compartido.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSharing(false);
    }
  }

  async function removeNotebook() {
    if (!selected) return;
    if (!window.confirm(`¿Eliminar el cuaderno "${selected.title}"?`)) return;
    try {
      await api.deleteNotebook(selected.id);
      await deleteNotebookDraft(selected.id);
      const rest = notebooks.filter((notebook) => notebook.id !== selected.id);
      setNotebooks(rest);
      setSelectedId(rest[0]?.id ?? null);
      setDraft({ title: "", color: "#6366f1", content: "" });
      setLocalOnly(false);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function downloadWord() {
    if (!selected) return;
    try {
      await api.downloadNotebookWord(selected.id, `${selected.title || "cuaderno"}.docx`);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function downloadExcel() {
    try {
      await api.exportNotebooksExcel();
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function addSource() {
    if (!selected) return;
    if (sourceTab === "book" && !pickedBook) {
      setNotice("Elige un libro de tu biblioteca.");
      return;
    }
    if (sourceTab === "file" && !pickedDocument) {
      setNotice("Elige un archivo ya subido.");
      return;
    }
    setAddingSource(true);
    setNotice(null);
    try {
      const created = await api.addNotebookSource(
        selected.id,
        sourceTab === "book" ? { book_id: pickedBook } : { document_id: pickedDocument },
      );
      setSources((current) => [...current, created]);
      setShowSourcePicker(false);
      setNotice(`"${created.title}" se añadió como fuente del cuaderno.`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setAddingSource(false);
    }
  }

  async function removeSource(source: NotebookSource) {
    if (!selected) return;
    try {
      await api.removeNotebookSource(selected.id, source.id);
      setSources((current) => current.filter((item) => item.id !== source.id));
      setNotice(`"${source.title}" se quitó del cuaderno. El libro o archivo sigue guardado.`);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function insertSummary(source: NotebookSource) {
    if (!selected || !source.book_id) return;
    setSourceActionId(source.id);
    setNotice(null);
    try {
      const summary = await api.bookSummary(source.book_id, { scope: "book" });
      const points = summary.key_points.map((point) => `- ${point}`).join("\n");
      const block = [
        "",
        "",
        `## Resumen de ${source.title}`,
        "",
        summary.summary,
        "",
        points,
        "",
        `> Fuente: ${source.title}${summary.citations.length ? ` · ${summary.citations.length} referencias del libro` : ""}`,
      ].join("\n");
      updateDraft({ content: `${draftRef.current.content.trimEnd()}${block}` });
      setNotice("Resumen insertado al final del cuaderno. Se guardará automáticamente.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSourceActionId(null);
    }
  }

  async function downloadSourceFile(source: NotebookSource) {
    if (!source.document_id) return;
    try {
      await api.downloadFile(source.document_id, source.title);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <motion.div variants={pageStagger} className="mx-auto max-w-6xl space-y-6 p-5 sm:p-7">
      <motion.header variants={pageItem} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/[0.06] pb-4 dark:border-white/[0.07]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#8ab9ff]">
            <NotebookPen className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/95">
              Cuadernos
            </h1>
            <p className="text-[11.5px] text-slate-500 dark:text-white/40">
              Apuntes que se guardan solos. Sin ruido, solo tú y las ideas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href="/studio?mode=audio">
            <Button variant="ghost" size="sm">
              <AudioLines className="h-4 w-4" /> Audio
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={downloadExcel} disabled={notebooks.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button size="sm" onClick={() => setShowTemplates(true)} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Nuevo cuaderno
          </Button>
        </div>
      </motion.header>

      {notice && (
        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-200">
          {notice}
        </p>
      )}

      {notebooks.length === 0 ? (
        <motion.div variants={pageItem} className="rounded-3xl bg-white/45 p-12 text-center backdrop-blur-xl dark:bg-white/[0.03]">
          <NotebookPen className="mx-auto h-10 w-10 text-indigo-400" />
          <h2 className="mt-3 text-lg font-semibold">Todavía no tienes cuadernos</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Crea tu primer cuaderno para organizar apuntes, pegar resúmenes de IA Studio o
            preparar un examen.
          </p>
          <Button className="mt-4" onClick={() => setShowTemplates(true)}>
            <Plus className="h-4 w-4" /> Crear mi primer cuaderno
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={pageItem} className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="space-y-1">
            <p className="px-3 pb-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
              Tus cuadernos
            </p>
            {notebooks.map((notebook) => (
              <button
                key={notebook.id}
                type="button"
                onClick={() => selectNotebook(notebook.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                  notebook.id === selectedId
                    ? "bg-slate-900/[0.055] dark:bg-white/[0.075]"
                    : "hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: notebook.color }}
                  />
                  <span className="truncate text-[13px] font-medium text-slate-700 dark:text-white/80">
                    {notebook.title}
                  </span>
                </span>
                <span className="mt-0.5 block truncate pl-4 text-[10.5px] text-slate-400 dark:text-white/30">
                  {notebook.content.trim()
                    ? notebook.content.trim().slice(0, 60)
                    : "Cuaderno vacío"}
                </span>
              </button>
            ))}
          </aside>

          <section className="min-w-0 rounded-3xl bg-white/55 p-4 shadow-[0_24px_70px_-45px_rgba(32,39,48,0.4)] backdrop-blur-2xl dark:bg-white/[0.035] sm:p-7">
            {selected ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <input
                    value={draft.title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    className="w-full bg-transparent px-1 py-1 text-[24px] font-semibold tracking-[-0.035em] text-slate-900 outline-none placeholder:text-slate-300 dark:text-white/90 dark:placeholder:text-white/20"
                    placeholder="Cuaderno sin título"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Color ${color}`}
                          onClick={() => updateDraft({ color })}
                          className={cn(
                            "h-5 w-5 rounded-full transition-transform hover:scale-110",
                            draft.color === color
                              ? "ring-2 ring-slate-700 dark:ring-white/70"
                              : "opacity-70",
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTools((value) => !value)}
                      aria-expanded={showTools}
                      className="text-slate-500 dark:text-white/45"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Herramientas
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition-transform", showTools && "rotate-180")}
                      />
                    </Button>
                  </div>
                </div>

                {showTools && (
                  <div className="space-y-3 rounded-2xl bg-slate-900/[0.025] p-3 dark:bg-white/[0.03]">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-700 dark:text-white/75">
                            <BookOpen className="h-3.5 w-3.5" /> Fuentes del cuaderno
                          </p>
                          <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/35">
                            Libros y archivos que quieres tener a mano mientras estudias.
                          </p>
                        </div>
                        {canManageSources && (
                          <Button size="sm" variant="secondary" onClick={() => setShowSourcePicker(true)}>
                            <Plus className="h-3.5 w-3.5" /> Añadir fuente
                          </Button>
                        )}
                      </div>

                      {sourcesLoading ? (
                        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando fuentes...
                        </div>
                      ) : sources.length === 0 ? (
                        <p className="mt-2 rounded-xl bg-slate-900/[0.03] px-3 py-3 text-[10.5px] text-slate-500 dark:bg-white/[0.03] dark:text-white/35">
                          Aún no hay fuentes. {canManageSources
                            ? "Añade un libro de la Biblioteca o un archivo de Archivos para tenerlo junto a tus apuntes."
                            : "El propietario del cuaderno todavía no ha añadido libros ni archivos."}
                        </p>
                      ) : (
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {sources.map((source) => (
                            <div
                              key={source.id}
                              className="rounded-xl bg-white/50 p-2.5 dark:bg-white/[0.04]"
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                                  {source.kind === "book" ? (
                                    <BookOpen className="h-3.5 w-3.5" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold" title={source.title}>
                                    {source.title}
                                  </p>
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    {source.format ? `${source.format} · ` : ""}
                                    {source.subtitle || (source.kind === "book" ? "Libro" : "Archivo")}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-1">
                                {source.kind === "book" && source.book_id ? (
                                  canManageSources ? (
                                    <>
                                      <Link href={`/library/${source.book_id}`}>
                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                                          Abrir libro
                                        </Button>
                                      </Link>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-[10px]"
                                        onClick={() => void insertSummary(source)}
                                        disabled={sourceActionId === source.id}
                                      >
                                        {sourceActionId === source.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Sparkles className="h-3 w-3" />
                                        )}
                                        Insertar resumen
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="px-1 text-[10px] text-muted-foreground">
                                      Fuente compartida
                                    </span>
                                  )
                                ) : source.document_id ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[10px]"
                                    onClick={() => void downloadSourceFile(source)}
                                  >
                                    <Download className="h-3 w-3" /> Abrir archivo
                                  </Button>
                                ) : null}
                                {canManageSources && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="ml-auto h-7 px-2 text-[10px] text-rose-500 hover:text-rose-700"
                                    onClick={() => void removeSource(source)}
                                    aria-label={`Quitar ${source.title}`}
                                  >
                                    <X className="h-3 w-3" /> Quitar
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-900/[0.05] pt-3 dark:border-white/[0.06]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-700 dark:text-white/75">
                          <Users className="h-3.5 w-3.5" /> Compartir con una clase
                        </span>
                        {selected.shared_class_id && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            {selected.share_permission === "edit" ? "Edición" : "Solo lectura"}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          value={shareClassId}
                          onChange={(event) => setShareClassId(event.target.value)}
                          className="min-w-[180px] flex-1 rounded-xl bg-slate-900/[0.035] px-3 py-1.5 text-xs outline-none dark:bg-white/[0.05]"
                        >
                          <option value="">Selecciona una clase</option>
                          {classes.map((sharedClass) => (
                            <option key={sharedClass.id} value={sharedClass.id}>
                              {sharedClass.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={sharePermission}
                          onChange={(event) =>
                            setSharePermission(event.target.value === "edit" ? "edit" : "read")
                          }
                          className="rounded-xl bg-slate-900/[0.035] px-3 py-1.5 text-xs outline-none dark:bg-white/[0.05]"
                        >
                          <option value="read">Solo lectura</option>
                          <option value="edit">Pueden editar</option>
                        </select>
                        <Button size="sm" onClick={shareWithClass} disabled={sharing || !shareClassId}>
                          {sharing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Share2 className="h-3.5 w-3.5" />
                          )}
                          Compartir
                        </Button>
                        {selected.shared_class_id && (
                          <Button size="sm" variant="ghost" onClick={stopSharing} disabled={sharing}>
                            Dejar de compartir
                          </Button>
                        )}
                      </div>
                      {classes.length === 0 && (
                        <p className="mt-2 text-[10.5px] text-slate-500 dark:text-white/35">
                          Aún no perteneces a ninguna clase.{" "}
                          <Link href="/classes" className="font-semibold underline">
                            Crea o únete a una clase
                          </Link>{" "}
                          para compartir apuntes.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <textarea
                  value={draft.content}
                  onChange={(event) => updateDraft({ content: event.target.value })}
                  placeholder={
                    "Escribe aquí tus apuntes...\n\n# Título de sección\n## Subtítulo\n- Idea o dato clave"
                  }
                  className="min-h-[520px] w-full resize-y bg-transparent px-1 py-2 text-[14.5px] leading-7 text-slate-700 outline-none placeholder:text-slate-300 dark:text-white/75 dark:placeholder:text-white/20"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/[0.05] pt-3 dark:border-white/[0.06]">
                  <span className="flex items-center gap-2 text-[10.5px] text-slate-400 dark:text-white/30">
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...
                      </>
                    ) : dirty ? (
                      "Cambios sin guardar"
                    ) : localOnly ? (
                      <>
                        <HardDrive className="h-3.5 w-3.5 text-amber-500" /> Guardado en este
                        dispositivo · pendiente de sincronizar
                      </>
                    ) : savedAt ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" /> Guardado a las {savedAt}
                      </>
                    ) : (
                      "Autoguardado activo"
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => save(selected.id, draft)}
                      disabled={saving || (!dirty && !localOnly)}
                    >
                      <Check className="h-4 w-4" /> {localOnly ? "Sincronizar" : "Guardar"}
                    </Button>
                    <NotebookChat
                      key={selected.id}
                      notebookId={selected.id}
                      disabled={dirty || saving || localOnly}
                      onNotebookChanged={(updated) => {
                        setNotebooks((current) => current.map((item) => item.id === updated.id ? updated : item));
                        if (selectedIdRef.current === updated.id) setDraft(toDraft(updated));
                      }}
                    />
                    <Button variant="ghost" size="sm" onClick={downloadWord}>
                      <Download className="h-4 w-4" /> Word
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={removeNotebook}
                      aria-label="Eliminar cuaderno"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecciona un cuaderno de la lista para empezar a escribir.
              </p>
            )}
          </section>
        </motion.div>
      )}

      {showSourcePicker && (
        <motion.div variants={pageItem}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setShowSourcePicker(false)}
        >
          <div
            className="animate-pop max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-300/40 bg-slate-100/85 p-6 shadow-[0_28px_80px_-36px_rgba(32,39,48,0.45)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/92 dark:shadow-[0_28px_80px_-36px_rgba(0,0,0,0.9)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <BookOpen className="h-5 w-5 text-indigo-600" /> Añadir una fuente
                </h2>
                <p className="text-sm text-muted-foreground">
                  Elige un libro de tu Biblioteca o un archivo ya subido. No se copia nada: queda
                  enlazado al cuaderno.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSourcePicker(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-white/40 dark:hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold dark:bg-white/[0.06]">
              <button
                type="button"
                onClick={() => setSourceTab("book")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2",
                  sourceTab === "book"
                    ? "bg-slate-100/90 text-indigo-700 shadow-sm dark:bg-white/10 dark:text-blue-200"
                    : "text-slate-500 dark:text-white/50",
                )}
              >
                <BookOpen className="h-3.5 w-3.5" /> Libros ({sourceBooks.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceTab("file")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2",
                  sourceTab === "file"
                    ? "bg-slate-100/90 text-indigo-700 shadow-sm dark:bg-white/10 dark:text-blue-200"
                    : "text-slate-500 dark:text-white/50",
                )}
              >
                <FileText className="h-3.5 w-3.5" /> Archivos ({sourceFiles.length})
              </button>
            </div>

            <input
              value={sourceSearch}
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder={sourceTab === "book" ? "Buscar un libro..." : "Buscar un archivo..."}
              className="mt-3 w-full rounded-xl border border-slate-300/40 bg-slate-100/70 px-3 py-2 text-sm outline-none backdrop-blur-xl focus:border-indigo-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80"
            />

            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {sourceTab === "book" ? (
                sourceBooksLoading ? (
                  <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando libros...
                  </p>
                ) : filteredSourceBooks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground dark:border-white/10">
                    {sourceBooks.length === 0 ? (
                      <>
                        Todavía no tienes libros.{" "}
                        <Link href="/library" className="font-semibold text-indigo-600 underline">
                          Sube uno en la Biblioteca
                        </Link>
                        .
                      </>
                    ) : (
                      "Ningún libro coincide con la búsqueda."
                    )}
                  </div>
                ) : (
                  filteredSourceBooks.map((book) => {
                    const selectedBook = pickedBook === book.id;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        disabled={book.status !== "ready"}
                        onClick={() => setPickedBook(book.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-55",
                          selectedBook
                            ? "border-indigo-400 bg-indigo-50/70 ring-1 ring-indigo-200 dark:border-blue-500/60 dark:bg-blue-500/10 dark:ring-blue-500/30"
                            : "border-slate-300/40 bg-slate-100/70 hover:border-indigo-200 hover:bg-slate-100/85 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-blue-500/40 dark:hover:bg-white/[0.07]",
                        )}
                      >
                        <span
                          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-white"
                          style={{ background: `linear-gradient(145deg, ${book.cover_color}, #0f172a)` }}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{book.title}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {book.author || "Sin autor"} · {book.total_sections} secciones
                            {book.status === "processing" ? " · Preparando..." : ""}
                            {book.status === "error" ? " · No se pudo abrir" : ""}
                          </span>
                        </span>
                        {selectedBook && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                      </button>
                    );
                  })
                )
              ) : sourceFilesLoading ? (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando archivos...
                </p>
              ) : filteredSourceFiles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground dark:border-white/10">
                  {sourceFiles.length === 0 ? (
                    <>
                      Todavía no tienes archivos.{" "}
                      <Link href="/files" className="font-semibold text-indigo-600 underline">
                        Sube uno en Archivos
                      </Link>
                      .
                    </>
                  ) : (
                    "Ningún archivo coincide con la búsqueda."
                  )}
                </div>
              ) : (
                filteredSourceFiles.map((file) => {
                  const selectedFile = pickedDocument === file.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setPickedDocument(file.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                        selectedFile
                          ? "border-indigo-400 bg-indigo-50/70 ring-1 ring-indigo-200"
                          : "border-slate-300/40 bg-slate-100/70 hover:border-indigo-200 hover:bg-slate-100/85 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-blue-500/40 dark:hover:bg-white/[0.07]",
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/50">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{file.filename}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {formatBytes(file.size_bytes)} ·{" "}
                          {file.created_at
                            ? new Date(file.created_at).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                              })
                            : "Archivo"}
                        </span>
                      </span>
                      {selectedFile && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                {sourceTab === "book"
                  ? "Los libros deben terminar de prepararse para poder insertar su resumen."
                  : "Puedes adjuntar cualquier archivo que ya esté en Archivos."}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowSourcePicker(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void addSource()}
                  disabled={
                    addingSource ||
                    (sourceTab === "book" ? !pickedBook : !pickedDocument)
                  }
                >
                  {addingSource ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Añadir al cuaderno
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {showTemplates && (
        <motion.div variants={pageItem}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setShowTemplates(false)}
        >
          <div
            className="animate-pop max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-300/40 bg-slate-100/85 p-6 shadow-[0_28px_80px_-36px_rgba(32,39,48,0.45)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b0f18]/92 dark:shadow-[0_28px_80px_-36px_rgba(0,0,0,0.9)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <LayoutTemplate className="h-5 w-5 text-indigo-600" /> Elige una plantilla
                </h2>
                <p className="text-sm text-muted-foreground">
                  Empieza con una estructura lista para rellenar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-white/40 dark:hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {TEMPLATES.map((template, index) => (
                <button
                  key={template.name}
                  type="button"
                  disabled={creating}
                  onClick={() => void createNotebook(index)}
                  className="group rounded-2xl border border-slate-300/40 bg-slate-100/50 p-4 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-slate-100/75 hover:shadow-md disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-blue-500/40 dark:hover:bg-white/[0.07]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-white/85">{template.name}</span>
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    ) : (
                      <Plus className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {template.description}
                  </span>
                  <span className="mt-2 block truncate rounded-lg bg-slate-100/70 px-2 py-1 font-mono text-[10px] text-slate-500 ring-1 ring-slate-300/40 dark:bg-white/[0.05] dark:text-white/45 dark:ring-white/10">
                    {template.content.split("\n")[0] || "Página en blanco"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
