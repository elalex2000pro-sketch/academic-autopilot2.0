"use client";

// Academic-Office · procesador de textos con motor CKEditor 5 y un shell que
// reproduce la estructura clasica de LibreOffice Writer: menus, dos barras de
// herramientas, hoja A4 centrada, panel lateral y barra de estado.
//
// El motor es local (no hay iframe ni servidor Collabora/OnlyOffice): funciona
// en la web, en Electron y sin claves de API. La paginacion es visual (guias
// A4 + saltos de pagina); el PDF se obtiene con el dialogo de impresion.
import { OfficeFind } from "./office-find";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";

import { lockBodyScroll } from "@/lib/scroll-lock";
import {
  Alignment,
  AutoLink,
  Autoformat,
  Base64UploadAdapter,
  BlockQuote,
  Bold,
  Bookmark,
  ClassicEditor,
  Code,
  CodeBlock,
  Essentials,
  Font,
  GeneralHtmlSupport,
  Heading,
  Highlight,
  HorizontalLine,
  HtmlEmbed,
  Image,
  ImageCaption,
  ImageInsert,
  ImageInsertViaUrl,
  ImageResize,
  ImageStyle,
  ImageTextAlternative,
  ImageToolbar,
  ImageUpload,
  Indent,
  IndentBlock,
  Italic,
  Link,
  List,
  ListProperties,
  MediaEmbed,
  PageBreak,
  Paragraph,
  PasteFromOffice,
  PictureEditing,
  RemoveFormat,
  ShowBlocks,
  SourceEditing,
  SpecialCharacters,
  Strikethrough,
  Style,
  Subscript,
  Superscript,
  Table,
  TableCaption,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableSelection,
  TableToolbar,
  TextTransformation,
  TodoList,
  Underline,
  WordCount,
} from "ckeditor5";
import type { Editor, EditorConfig } from "ckeditor5";
import "ckeditor5/ckeditor5.css";
import "./writer-editor.css";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold as BoldIcon,
  Check,
  ClipboardPaste,
  Compass,
  Copy,
  Eraser,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  ImagePlus,
  Images,
  IndentDecrease,
  IndentIncrease,
  Italic as ItalicIcon,
  Languages,
  Link2,
  List as ListIcon,
  ListChecks,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Palette,
  PanelRight,
  PanelRightClose,
  Paintbrush,
  Plus,
  Printer,
  Redo2,
  Save,
  Scissors,
  Search,
  Settings2,
  Strikethrough as StrikethroughIcon,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type WriterExportKind = "pdf" | "docx" | "html";

export interface WriterEditorProps {
  initialSettings?: Record<string, unknown>;
  onSettingsChange?: (settings: Record<string, unknown>) => void;
  onSaveToPc?: (kind: "html" | "txt") => void;
  html: string;
  documentName: string;
  saving: boolean;
  savedAt: number | null;
  onChange: (html: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onExport: (kind: WriterExportKind) => void;
}

type SidebarTab = "properties" | "styles" | "gallery" | "navigator";
type Orientation = "portrait" | "landscape";

interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface FormatState {
  heading: string;
  fontFamily: string;
  fontSize: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sub: boolean;
  sup: boolean;
  alignment: string;
  listType: string;
  fontColor: string;
  highlight: string;
}

interface WriterStats {
  words: number;
  chars: number;
  pages: number;
  current: number;
}

type MenuItem =
  | { separator: true }
  | {
      separator?: false;
      label: string;
      shortcut?: string;
      action: () => void;
      disabled?: boolean;
    };

interface MenuDefinition {
  label: string;
  items: MenuItem[];
}

const SPECIAL_CHARACTERS = [
  "á", "é", "í", "ó", "ú", "ñ", "ü", "Á",
  "É", "Í", "Ó", "Ú", "Ñ", "Ü", "¿", "¡",
  "€", "£", "¥", "©", "®", "™", "°", "±",
  "×", "÷", "—", "–", "…", "“", "”", "‘",
  "’", "«", "»", "§", "¶", "µ", "·", "•",
];

const FONT_FAMILIES = [
  { label: "Liberation Serif", value: "Liberation Serif" },
  { label: "Liberation Sans", value: "Liberation Sans" },
  { label: "DejaVu Serif", value: "DejaVu Serif" },
  { label: "DejaVu Sans", value: "DejaVu Sans" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Calibri", value: "Calibri" },
  { label: "Courier New", value: "Courier New" },
];

const FONT_SIZES = [
  "8pt", "9pt", "10pt", "11pt", "12pt", "14pt", "16pt", "18pt",
  "20pt", "22pt", "24pt", "28pt", "32pt", "36pt", "48pt", "72pt",
];

const HEADING_OPTIONS = [
  { model: "paragraph", title: "Texto de parrafo", class: "ck-heading_paragraph" },
  { model: "heading1", view: "h1", title: "Titulo 1", class: "ck-heading_heading1" },
  { model: "heading2", view: "h2", title: "Titulo 2", class: "ck-heading_heading2" },
  { model: "heading3", view: "h3", title: "Titulo 3", class: "ck-heading_heading3" },
  { model: "heading4", view: "h4", title: "Titulo 4", class: "ck-heading_heading4" },
] as const;

const ALIGNMENT_OPTIONS: Array<"left" | "center" | "right" | "justify"> = [
  "left",
  "center",
  "right",
  "justify",
];

const LINE_SPACINGS = [
  { label: "Sencillo", value: "1", styleName: "Interlineado sencillo" },
  { label: "1,15", value: "1.15", styleName: "Interlineado 1,15" },
  { label: "1,5", value: "1.5", styleName: "Interlineado 1,5" },
  { label: "Doble", value: "2", styleName: "Interlineado doble" },
];

const EDITOR_CONFIG = {
  licenseKey: "GPL",
  plugins: [
    Essentials,
    Paragraph,
    Heading,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Subscript,
    Superscript,
    Font,
    Alignment,
    List,
    ListProperties,
    TodoList,
    Indent,
    IndentBlock,
    Link,
    AutoLink,
    Table,
    TableToolbar,
    TableProperties,
    TableCellProperties,
    TableColumnResize,
    TableCaption,
    TableSelection,
    Image,
    ImageToolbar,
    ImageCaption,
    ImageStyle,
    ImageResize,
    ImageUpload,
    ImageInsert,
    ImageInsertViaUrl,
    ImageTextAlternative,
    Base64UploadAdapter,
    PictureEditing,
    BlockQuote,
    HorizontalLine,
    PageBreak,
    Highlight,
    RemoveFormat,
    SpecialCharacters,
      PasteFromOffice,
    WordCount,
    SourceEditing,
    GeneralHtmlSupport,
    HtmlEmbed,
    MediaEmbed,
    CodeBlock,
    Code,
    Autoformat,
    TextTransformation,
    Bookmark,
    ShowBlocks,
    Style,
  ],
  toolbar: [],
  placeholder: "Empieza a escribir tu documento...",
  heading: {
    options: [...HEADING_OPTIONS],
  },
  fontFamily: {
    supportAllValues: true,
    options: FONT_FAMILIES.map((font) => ({ title: font.label, model: font.value })),
  },
  fontSize: {
    supportAllValues: true,
    options: FONT_SIZES,
  },
  alignment: { options: ALIGNMENT_OPTIONS },
  list: {
    properties: {
      styles: true,
      startIndex: true,
      reversed: true,
    },
  },
  table: {
    contentToolbar: [
      "tableColumn",
      "tableRow",
      "mergeTableCells",
      "tableProperties",
      "tableCellProperties",
    ],
  },
  image: {
    toolbar: [
      "imageStyle:inline",
      "imageStyle:block",
      "imageStyle:side",
      "|",
      "toggleImageCaption",
      "imageTextAlternative",
      "|",
      "resizeImage",
    ],
    resizeOptions: [
      { name: "resizeImage:original", value: null, label: "Tamano original" },
      { name: "resizeImage:50", value: "50", label: "50 %" },
      { name: "resizeImage:75", value: "75", label: "75 %" },
    ],
  },
  link: {
    addTargetToExternalLinks: true,
    defaultProtocol: "https://",
  },
  htmlSupport: {
    allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
  },
  style: {
    definitions: [
      { name: "Interlineado sencillo", element: "p", styles: { "line-height": "1" } },
      { name: "Interlineado 1,15", element: "p", styles: { "line-height": "1.15" } },
      { name: "Interlineado 1,5", element: "p", styles: { "line-height": "1.5" } },
      { name: "Interlineado doble", element: "p", styles: { "line-height": "2" } },
    ],
  },
} as unknown as EditorConfig;

function toHex(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value
      .slice(1)
      .split("")
      .map((part) => part + part)
      .join("")}`;
  }
  const rgb = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((part) => Number(part).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return fallback;
}

function ToolButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn("office-tool", active && "is-active")}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function WriterEditor({
  html,
  documentName,
  saving,
  savedAt,
  onChange,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  initialSettings,
  onSettingsChange,
  onSaveToPc,
  onExport,
}: WriterEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const marginDragRef = useRef<"left" | "right" | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const listenersRef = useRef<Array<() => void>>([]);
  const syncTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const lastHtmlRef = useRef(html);
  const latestHtmlRef = useRef(html);
  const initialHtmlRef = useRef(html);
  const marginsRef = useRef<Margins>({ top: 20, right: 20, bottom: 20, left: 20 });
  const orientationRef = useRef<Orientation>("portrait");
  const painterRef = useRef<Record<string, unknown> | null>(null);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuShift, setMenuShift] = useState(0);

  const MENU_DROPDOWN_WIDTH = 246;
  const VIEWPORT_MARGIN = 8;

  function positionMenu(trigger: HTMLElement | null) {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxLeft = Math.max(
      VIEWPORT_MARGIN,
      window.innerWidth - MENU_DROPDOWN_WIDTH - VIEWPORT_MARGIN,
    );
    const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), maxLeft);
    setMenuShift(left - rect.left);
  }
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 1100,
  );
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("properties");
  const [zoom, setZoom] = useState(100);
  const [showRuler, setShowRuler] = useState(true);
  const [orientation, setOrientation] = useState<Orientation>(initialSettings?.orientation === "landscape" ? "landscape" : "portrait");
  const [margins, setMargins] = useState<Margins>((initialSettings?.margins as Margins) || { top: 20, right: 20, bottom: 20, left: 20 });
  const [format, setFormat] = useState<FormatState>({
    heading: "paragraph",
    fontFamily: "",
    fontSize: "12pt",
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    sub: false,
    sup: false,
    alignment: "left",
    listType: "",
    fontColor: "#000000",
    highlight: "#ffff00",
  });
  const [stats, setStats] = useState<WriterStats>({ words: 0, chars: 0, pages: 1, current: 1 });
  const [findOpen, setFindOpen] = useState(false);

  const [specialOpen, setSpecialOpen] = useState(false);
  const [paintActive, setPaintActive] = useState(false);
  const [lang, setLang] = useState("es-ES");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const immersive = nativeFullscreen || focusMode;

  latestHtmlRef.current = html;
  useEffect(() => { onSettingsChange?.({ orientation, margins, paper: "A4" }); }, [orientation, margins, onSettingsChange]);
  marginsRef.current = margins;
  orientationRef.current = orientation;

  const syncFormat = useCallback((editor: Editor) => {
    const selection = editor.model.document.selection;
    setFormat({
      heading: (selection.getAttribute("heading") as string) || "paragraph",
      fontFamily: (selection.getAttribute("fontFamily") as string) || "",
      fontSize: (selection.getAttribute("fontSize") as string) || "12pt",
      bold: selection.hasAttribute("bold"),
      italic: selection.hasAttribute("italic"),
      underline: selection.hasAttribute("underline"),
      strike: selection.hasAttribute("strikethrough"),
      sub: selection.hasAttribute("subscript"),
      sup: selection.hasAttribute("superscript"),
      alignment: (selection.getAttribute("alignment") as string) || "left",
      listType: (selection.getAttribute("listType") as string) || "",
      fontColor: toHex(selection.getAttribute("fontColor"), "#000000"),
      highlight: toHex(selection.getAttribute("fontBackgroundColor"), "#ffff00"),
    });
  }, []);

  const updateStats = useCallback((editor: Editor) => {
    const data = editor.getData();
    const text = data
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    const words = text ? text.split(" ").length : 0;
    const chars = text.length;

    let pages = 1;
    let current = 1;
    const editable = editor.ui.getEditableElement();
    if (editable) {
      const computed = window.getComputedStyle(editable);
      const padTop = Number.parseFloat(computed.paddingTop) || 0;
      const padBottom = Number.parseFloat(computed.paddingBottom) || 0;
      const contentHeight = Math.max(0, editable.scrollHeight - padTop - padBottom);
      const activeMargins = marginsRef.current;
      const pageHeightMm = orientationRef.current === "portrait" ? 297 : 210;
      const contentPagePx = ((pageHeightMm - activeMargins.top - activeMargins.bottom) * 96) / 25.4;
      pages = Math.max(1, Math.ceil(contentHeight / Math.max(contentPagePx, 1)));

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        if (rect.width || rect.height) {
          const pageTop = editable.getBoundingClientRect().top + padTop;
          current = Math.max(
            1,
            Math.min(pages, Math.floor((rect.top - pageTop) / Math.max(contentPagePx, 1)) + 1),
          );
        }
      }
    }

    setStats({ words, chars, pages, current });
  }, []);

  const scheduleSync = useCallback(
    (editor: Editor) => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(() => {
        syncFormat(editor);
        updateStats(editor);
      }, 110);
    },
    [syncFormat, updateStats],
  );

  const handleReady = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      lastHtmlRef.current = editor.getData();
      if (latestHtmlRef.current !== lastHtmlRef.current) {
        void editor.setData(latestHtmlRef.current);
        lastHtmlRef.current = latestHtmlRef.current;
      }

      const sync = () => scheduleSync(editor);
      editor.model.document.on("change:data", sync);
      editor.model.document.selection.on("change:range", sync);
      editor.model.document.selection.on("change:attribute", sync);
      listenersRef.current.push(() => {
        editor.model.document.off("change:data", sync);
        editor.model.document.selection.off("change:range", sync);
        editor.model.document.selection.off("change:attribute", sync);
      });

      const editable = editor.ui.getEditableElement();
      if (editable) {
        editable.setAttribute("lang", lang);
        editable.setAttribute("spellcheck", "true");
      }
      scheduleSync(editor);
    },
    [lang, scheduleSync],
  );

  const handleEditorChange = useCallback(
    (editor: Editor) => {
      const data = editor.getData();
      lastHtmlRef.current = data;
      onChange(data);
    },
    [onChange],
  );

  // Cuando el padre crea o abre otro documento, se reemplaza el contenido.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (html !== lastHtmlRef.current && html !== editor.getData()) {
      void editor.setData(html);
      lastHtmlRef.current = html;
    }
  }, [html]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) updateStats(editor);
  }, [margins, orientation, updateStats]);

  useEffect(() => {
    const editable = editorRef.current?.ui.getEditableElement();
    if (editable) editable.setAttribute("lang", lang);
  }, [lang]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuBarRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // La API nativa puede salir con ESC o con el gesto del sistema: el estado
  // del boton debe seguir siempre al elemento que esta realmente a pantalla
  // completa.
  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement === rootRef.current;
      setNativeFullscreen(active);
      if (active) setFocusMode(false);
    };
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  // Fallback para navegadores que no permiten Fullscreen API en un div
  // (Safari/iOS, permisos del navegador o Electron embebido).
  useEffect(() => {
    if (!focusMode) return;
    const releaseScrollLock = lockBodyScroll();
    document.body.classList.add("office-editor-focus");
    return () => {
      releaseScrollLock();
      document.body.classList.remove("office-editor-focus");
    };
  }, [focusMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setFindOpen(false);
        setSpecialOpen(false);
        if (focusMode) setFocusMode(false);
        if (document.fullscreenElement === rootRef.current) {
          void document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  useEffect(() => {
    return () => {
      listenersRef.current.forEach((detach) => detach());
      listenersRef.current = [];
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, []);

  // Pincel de formato: guarda los atributos activos y los aplica en la
  // siguiente seleccion con raton dentro del lienzo.
  useEffect(() => {
    if (!paintActive) return;
    const editor = editorRef.current;
    const editable = editor?.ui.getEditableElement();
    if (!editor || !editable) return;

    const apply = () => {
      const attributes = painterRef.current;
      if (!attributes) return;
      const selection = editor.model.document.selection;
      if (selection.isCollapsed) return;
      const range = selection.getFirstRange();
      if (!range) return;
      editor.model.change((writer) => {
        for (const [name, value] of Object.entries(attributes)) {
          writer.setAttribute(name, value, range);
        }
      });
      painterRef.current = null;
      setPaintActive(false);
      setStatusMessage("Formato aplicado al texto seleccionado.");
      editor.editing.view.focus();
    };

    editable.addEventListener("mouseup", apply);
    return () => editable.removeEventListener("mouseup", apply);
  }, [paintActive]);

  function exec(command: string, value?: unknown) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    try {
      editor.execute(command, value);
    } catch (error) {
      console.warn(`[Academic-Office] No se pudo ejecutar "${command}"`, error);
      setStatusMessage(`La accion "${command}" no esta disponible en este documento.`);
    }
  }

  function insertHtmlSnippet(snippet: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    try {
      const viewFragment = editor.data.processor.toView(snippet);
      const modelFragment = editor.data.toModel(viewFragment);
      editor.model.insertContent(modelFragment);
    } catch (error) {
      console.warn("[Academic-Office] No se pudo insertar HTML", error);
      setStatusMessage("El documento no permite insertar ese elemento.");
    }
  }

  function insertTable() {
    const rows = Number.parseInt(window.prompt("Numero de filas", "3") ?? "3", 10);
    const columns = Number.parseInt(window.prompt("Numero de columnas", "3") ?? "3", 10);
    if (!Number.isFinite(rows) || !Number.isFinite(columns) || rows < 1 || columns < 1) return;
    exec("insertTable", { rows: Math.min(rows, 20), columns: Math.min(columns, 12) });
  }

  function insertLink() {
    const url = window.prompt("Direccion del enlace", "https://");
    if (!url || url === "https://") return;
    exec("link", url.trim());
  }

  function insertImageSource(source: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    try {
      editor.execute("imageInsert", { source });
    } catch {
      insertHtmlSnippet(`<figure class="image"><img src="${source}" alt="" /></figure>`);
    }
  }

  function insertImageFromUrl() {
    const url = window.prompt("Direccion de la imagen", "https://");
    if (!url || url === "https://") return;
    insertImageSource(url.trim());
  }

  function insertFormField(kind: "text" | "checkbox" | "textarea" | "select" | "button") {
    const snippets: Record<typeof kind, string> = {
      text: '<p><input type="text" placeholder="Campo de texto" /></p>',
      checkbox: '<p><input type="checkbox" /> Casilla de verificacion</p>',
      textarea: '<p><textarea rows="3" placeholder="Area de texto"></textarea></p>',
      select:
        '<p><select><option>Primera opcion</option><option>Segunda opcion</option></select></p>',
      button: '<p><input type="button" value="Boton" /></p>',
    };
    insertHtmlSnippet(snippets[kind]);
  }

  function insertSpecial(character: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.model.change((writer) => {
      const position = editor.model.document.selection.getFirstPosition();
      if (position) writer.insertText(character, position);
    });
    editor.editing.view.focus();
    setSpecialOpen(false);
  }

  function insertPageBreak() {
    exec("pageBreak");
  }

  function saveAs() {
    const name = window.prompt("Guardar como", documentName || "Documento sin titulo");
    if (!name?.trim()) return;
    onSaveAs(name.trim());
    setStatusMessage(`Documento guardado como "${name.trim()}".`);
  }

  function startFormatPainter() {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.model.document.selection;
    const attributes: Record<string, unknown> = {};
    for (const name of [
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "fontFamily",
      "fontSize",
      "fontColor",
      "fontBackgroundColor",
      "alignment",
    ]) {
      const value = selection.getAttribute(name);
      if (value !== undefined) attributes[name] = value;
    }
    painterRef.current = attributes;
    setPaintActive(true);
    setStatusMessage("Pincel de formato activo: selecciona el texto de destino.");
  }

  function runClipboard(action: "cut" | "copy" | "paste") {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    try {
      const done = document.execCommand(action);
      if (!done && action === "paste") void pastePlain();
    } catch {
      setStatusMessage("El navegador bloqueo el acceso al portapapeles.");
    }
  }

  async function pastePlain() {
    try {
      const text = await navigator.clipboard.readText();
      const editor = editorRef.current;
      if (!editor || !text) return;
      editor.model.change((writer) => {
        const position = editor.model.document.selection.getFirstPosition();
        if (position) writer.insertText(text, position);
      });
      editor.editing.view.focus();
    } catch {
      setStatusMessage("No se pudo leer el portapapeles. Usa Ctrl+V.");
    }
  }

  async function toggleFullscreen() {
    setOpenMenu(null);

    if (focusMode) {
      setFocusMode(false);
      setStatusMessage("Pantalla completa desactivada.");
      return;
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        setNativeFullscreen(false);
      }
      return;
    }

    const root = rootRef.current;
    if (root?.requestFullscreen) {
      try {
        await root.requestFullscreen();
        setNativeFullscreen(true);
        setStatusMessage("Pantalla completa. Pulsa ESC para salir.");
        return;
      } catch {
        // Sin permiso o API restringida: se usa el modo enfocado de la UI.
      }
    }

    setFocusMode(true);
    setStatusMessage("Modo enfocado. Pulsa ESC para salir.");
  }

  function goToHeading(index: number) {
    const editable = editorRef.current?.ui.getEditableElement();
    const headings = editable?.querySelectorAll<HTMLElement>("h1, h2, h3, h4");
    headings?.[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const headings = useMemo(() => {
    const found: Array<{ text: string; level: number; index: number }> = [];
    const pattern = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = pattern.exec(html)) !== null) {
      const text =
        match[2]
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim() || "Sin titulo";
      found.push({ text, level: Number(match[1]), index });
      index += 1;
    }
    return found;
  }, [html]);

  const actionsRef = useRef({ onNew, onOpen, onSave, onExport, saveAs });
  actionsRef.current = { onNew, onOpen, onSave, onExport, saveAs };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      if (!root || !root.contains(document.activeElement)) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) actionsRef.current.saveAs();
        else actionsRef.current.onSave();
      } else if (key === "o") {
        event.preventDefault();
        actionsRef.current.onOpen();
      } else if (key === "p") {
        event.preventDefault();
        actionsRef.current.onExport("pdf");
      } else if (key === "n") {
        event.preventDefault();
        actionsRef.current.onNew();
      } else if (key === "f" || key === "h") {
        event.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const separator: MenuItem = { separator: true };

  const menus: MenuDefinition[] = [
    {
      label: "Archivo",
      items: [
        { label: "Nuevo", shortcut: "Ctrl+N", action: onNew },
        { label: "Abrir desde el PC...", shortcut: "Ctrl+O", action: onOpen },
        { label: "Guardar", shortcut: "Ctrl+S", action: onSave },
        { label: "Guardar en el PC (.html)", action: () => onSaveToPc?.("html") },
        { label: "Guardar en el PC (.txt)", action: () => onSaveToPc?.("txt") },
        { label: "Guardar como...", shortcut: "Ctrl+Mayus+S", action: saveAs },
        separator,
        { label: "Exportar a PDF...", action: () => onExport("pdf") },
        { label: "Exportar a Word (.docx)", action: () => onExport("docx") },
        { label: "Exportar a HTML", action: () => onExport("html") },
        { label: "Imprimir...", shortcut: "Ctrl+P", action: () => onExport("pdf") },
        separator,
        {
          label: "Propiedades del documento",
          action: () =>
            setStatusMessage(
              `${stats.words} palabras, ${stats.chars} caracteres, ${stats.pages} página(s).`,
            ),
        },
      ],
    },
    {
      label: "Editar",
      items: [
        { label: "Deshacer", shortcut: "Ctrl+Z", action: () => exec("undo") },
        { label: "Rehacer", shortcut: "Ctrl+Y", action: () => exec("redo") },
        separator,
        { label: "Cortar", shortcut: "Ctrl+X", action: () => runClipboard("cut") },
        { label: "Copiar", shortcut: "Ctrl+C", action: () => runClipboard("copy") },
        { label: "Pegar", shortcut: "Ctrl+V", action: () => runClipboard("paste") },
        { label: "Pegar sin formato", action: () => void pastePlain() },
        separator,
        { label: "Seleccionar todo", shortcut: "Ctrl+A", action: () => exec("selectAll") },
        {
          label: "Buscar y reemplazar...",
          shortcut: "Ctrl+F",
          action: () => setFindOpen(true),
        },
      ],
    },
    {
      label: "Ver",
      items: [
        { label: "Zoom 75 %", action: () => setZoom(75) },
        { label: "Zoom 100 %", action: () => setZoom(100) },
        { label: "Zoom 125 %", action: () => setZoom(125) },
        { label: "Zoom 150 %", action: () => setZoom(150) },
        separator,
        { label: "Barra lateral", action: () => setSidebarOpen((value) => !value) },
        { label: "Regla", action: () => setShowRuler((value) => !value) },
        {
          label: immersive ? "Salir de pantalla completa" : "Pantalla completa",
          action: toggleFullscreen,
        },
        { label: "Codigo fuente HTML", action: () => exec("sourceEditing") },
      ],
    },
    {
      label: "Insertar",
      items: [
        { label: "Imagen desde archivo...", action: () => imageInputRef.current?.click() },
        { label: "Imagen desde URL...", action: insertImageFromUrl },
        { label: "Tabla...", action: insertTable },
        { label: "Enlace...", shortcut: "Ctrl+K", action: insertLink },
        separator,
        { label: "Salto de pagina", action: insertPageBreak },
        { label: "Linea horizontal", action: () => exec("horizontalLine") },
        { label: "Cita", action: () => exec("blockQuote") },
        { label: "Bloque de codigo", action: () => exec("codeBlock") },
        separator,
        { label: "Caracteres especiales...", action: () => setSpecialOpen(true) },
        { label: "Campo de texto", action: () => insertFormField("text") },
        { label: "Casilla de verificacion", action: () => insertFormField("checkbox") },
        { label: "Area de texto", action: () => insertFormField("textarea") },
        { label: "Lista desplegable", action: () => insertFormField("select") },
      ],
    },
    {
      label: "Formato",
      items: [
        { label: "Negrita", shortcut: "Ctrl+B", action: () => exec("bold") },
        { label: "Cursiva", shortcut: "Ctrl+I", action: () => exec("italic") },
        { label: "Subrayado", shortcut: "Ctrl+U", action: () => exec("underline") },
        { label: "Tachado", action: () => exec("strikethrough") },
        { label: "Superindice", action: () => exec("superscript") },
        { label: "Subindice", action: () => exec("subscript") },
        separator,
        { label: "Alinear a la izquierda", action: () => exec("alignment", { value: "left" }) },
        { label: "Centrar", action: () => exec("alignment", { value: "center" }) },
        { label: "Alinear a la derecha", action: () => exec("alignment", { value: "right" }) },
        { label: "Justificar", action: () => exec("alignment", { value: "justify" }) },
        separator,
        { label: "Vineta", action: () => exec("bulletedList") },
        { label: "Numeracion", action: () => exec("numberedList") },
        { label: "Lista de tareas", action: () => exec("todoList") },
        separator,
        { label: "Aumentar sangria", action: () => exec("indent") },
        { label: "Disminuir sangria", action: () => exec("outdent") },
        { label: "Limpiar formato", action: () => exec("removeFormat") },
      ],
    },
    {
      label: "Estilos",
      items: [
        { label: "Texto de párrafo", action: () => exec("heading", { value: "paragraph" }) },
        { label: "Título 1", action: () => exec("heading", { value: "heading1" }) },
        { label: "Título 2", action: () => exec("heading", { value: "heading2" }) },
        { label: "Título 3", action: () => exec("heading", { value: "heading3" }) },
        { label: "Título 4", action: () => exec("heading", { value: "heading4" }) },
        separator,
        { label: "Cita", action: () => exec("blockQuote") },
        { label: "Bloque de codigo", action: () => exec("codeBlock") },
        { label: "Quitar estilo", action: () => exec("removeFormat") },
      ],
    },
    {
      label: "Tabla",
      items: [
        { label: "Insertar tabla...", action: insertTable },
        separator,
        { label: "Insertar fila arriba", action: () => exec("insertTableRowAbove") },
        { label: "Insertar fila abajo", action: () => exec("insertTableRowBelow") },
        { label: "Insertar columna a la izquierda", action: () => exec("insertTableColumnLeft") },
        { label: "Insertar columna a la derecha", action: () => exec("insertTableColumnRight") },
        separator,
        { label: "Eliminar fila", action: () => exec("removeTableRow") },
        { label: "Eliminar columna", action: () => exec("removeTableColumn") },
        { label: "Combinar celdas", action: () => exec("mergeTableCells") },
        { label: "Dividir celda", action: () => exec("splitTableCell") },
        separator,
        { label: "Propiedades de tabla...", action: () => exec("tableProperties") },
        { label: "Propiedades de celda...", action: () => exec("tableCellProperties") },
      ],
    },
    {
      label: "Formulario",
      items: [
        { label: "Campo de texto", action: () => insertFormField("text") },
        { label: "Casilla de verificacion", action: () => insertFormField("checkbox") },
        { label: "Area de texto", action: () => insertFormField("textarea") },
        { label: "Lista desplegable", action: () => insertFormField("select") },
        { label: "Boton", action: () => insertFormField("button") },
        separator,
        {
          label: "Insertar formulario HTML",
          action: () =>
            insertHtmlSnippet(
              '<form><p><label>Nombre <input type="text" name="nombre" /></label></p><p><button type="button">Enviar</button></p></form>',
            ),
        },
      ],
    },
    {
      label: "Herramientas",
      items: [
        {
          label: "Contar palabras y caracteres",
          action: () =>
            setStatusMessage(
              `${stats.words} palabras, ${stats.chars} caracteres, ${stats.pages} página(s).`,
            ),
        },
        { label: "Idioma: Español (España)", action: () => setLang("es-ES") },
        { label: "Idioma: Español (Latinoamérica)", action: () => setLang("es-419") },
        { label: "Idioma: English (US)", action: () => setLang("en-US") },
        separator,
        {
          label: "Correccion ortografica del navegador",
          action: () => exec("sourceEditing"),
        },
        {
          label: "Preferencias de Academic-Office",
          action: () => setStatusMessage("Autoguardado activo en este dispositivo."),
        },
      ],
    },
    {
      label: "Ventana",
      items: [
        { label: "Mostrar barra lateral", action: () => setSidebarOpen(true) },
        { label: "Ocultar barra lateral", action: () => setSidebarOpen(false) },
        separator,
        { label: "Propiedades", action: () => { setSidebarOpen(true); setSidebarTab("properties"); } },
        { label: "Estilos", action: () => { setSidebarOpen(true); setSidebarTab("styles"); } },
        { label: "Galeria", action: () => { setSidebarOpen(true); setSidebarTab("gallery"); } },
        { label: "Navegador", action: () => { setSidebarOpen(true); setSidebarTab("navigator"); } },
        separator,
        {
          label: immersive ? "Salir de pantalla completa" : "Pantalla completa",
          action: toggleFullscreen,
        },
        { label: "Nueva ventana", action: () => window.open(window.location.href, "_blank") },
      ],
    },
    {
      label: "Ayuda",
      items: [
        {
          label: "Acerca de Academic-Office",
          action: () =>
            setStatusMessage(
              "Academic-Office Writer · motor CKEditor 5 · documentos locales, sin servidores externos.",
            ),
        },
        {
          label: "Atajos de teclado",
          action: () =>
            setStatusMessage(
              "Ctrl+S guardar · Ctrl+O abrir · Ctrl+P PDF · Ctrl+F buscar · Ctrl+B/I/U formato.",
            ),
        },
        {
          label: "Documentacion de CKEditor 5",
          action: () => window.open("https://ckeditor.com/docs/ckeditor5/latest/", "_blank"),
        },
      ],
    },
  ];

  const pageHeightMm = orientation === "portrait" ? 297 : 210;
  const pageWidthMm = orientation === "portrait" ? 210 : 297;

  const MIN_MARGIN_MM = 5;
  const MAX_MARGIN_MM = 60;

  function applyRulerMargin(clientX: number, side: "left" | "right") {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const millimetres = ratio * pageWidthMm;
    const raw = side === "left" ? millimetres : pageWidthMm - millimetres;
    const value = Math.min(MAX_MARGIN_MM, Math.max(MIN_MARGIN_MM, Math.round(raw)));
    setMargins((current) =>
      current[side] === value ? current : { ...current, [side]: value },
    );
  }

  function startRulerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const millimetres = ((event.clientX - rect.left) / rect.width) * pageWidthMm;
    const distanceToLeft = Math.abs(millimetres - margins.left);
    const distanceToRight = Math.abs(millimetres - (pageWidthMm - margins.right));
    const side = distanceToLeft <= distanceToRight ? "left" : "right";
    marginDragRef.current = side;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Los eventos sinteticos no siempre tienen un puntero capturable.
    }
    event.preventDefault();
    applyRulerMargin(event.clientX, side);
  }

  function moveRulerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const side = marginDragRef.current;
    if (!side) return;
    event.preventDefault();
    applyRulerMargin(event.clientX, side);
  }

  function endRulerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const side = marginDragRef.current;
    if (!side) return;
    marginDragRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignorar: el puntero sintetico puede no existir.
    }
    setStatusMessage("Márgenes actualizados desde la regla.");
  }

  const pageStyle = {
    "--office-page-width": `${pageWidthMm}mm`,
    "--office-page-height": `${pageHeightMm}mm`,
    "--office-pad-top": `${margins.top}mm`,
    "--office-pad-right": `${margins.right}mm`,
    "--office-pad-bottom": `${margins.bottom}mm`,
    "--office-pad-left": `${margins.left}mm`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={cn("office-writer", focusMode && "is-focus-mode")}
    >
      <div ref={menuBarRef} className="office-menu-bar" role="menubar" aria-label="Menu principal">
        {menus.map((menu) => (
          <div
            key={menu.label}
            className="office-menu"
            onMouseEnter={(event) => {
              if (!openMenu) return;
              positionMenu(event.currentTarget.querySelector(".office-menu-trigger"));
              setOpenMenu(menu.label);
            }}
          >
            <button
              type="button"
              className="office-menu-trigger"
              aria-haspopup="menu"
              aria-expanded={openMenu === menu.label}
              onClick={(event) => {
                if (openMenu === menu.label) {
                  setOpenMenu(null);
                  return;
                }
                positionMenu(event.currentTarget);
                setOpenMenu(menu.label);
              }}
            >
              {menu.label}
            </button>
            {openMenu === menu.label && (
              <div
                className="office-menu-dropdown"
                role="menu"
                style={{ transform: `translateX(${menuShift}px)` }}
              >
                {menu.items.map((item, index) =>
                  "separator" in item && item.separator ? (
                    <div key={`separator-${index}`} className="office-menu-sep" />
                  ) : (
                    <button
                      key={`${menu.label}-${item.label}`}
                      type="button"
                      role="menuitem"
                      className="office-menu-item"
                      disabled={"disabled" in item ? item.disabled : false}
                      onClick={() => {
                        setOpenMenu(null);
                        item.action();
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="office-menu-shortcut">{item.shortcut}</span>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          className={cn("office-fullscreen-toggle", immersive && "is-active")}
          onClick={() => void toggleFullscreen()}
          aria-label={immersive ? "Salir de pantalla completa" : "Pantalla completa"}
          aria-pressed={immersive}
          title={immersive ? "Salir de pantalla completa (ESC)" : "Pantalla completa"}
        >
          {immersive ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
          <span className="office-fullscreen-label">
            {immersive ? "Salir de pantalla completa" : "Pantalla completa"}
          </span>
        </button>
      </div>

      <div className="office-toolbar" role="toolbar" aria-label="Barra estandar">
        <ToolButton label="Nuevo documento" onClick={onNew}>
          <FilePlus2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Abrir documento" onClick={onOpen}>
          <FolderOpen className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Guardar" onClick={onSave}>
          <Save className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Exportar a PDF" onClick={() => onExport("pdf")}>
          <FileDown className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Imprimir" onClick={() => onExport("pdf")}>
          <Printer className="h-4 w-4" />
        </ToolButton>
        <span className="office-sep" />
        <ToolButton label="Cortar" onClick={() => runClipboard("cut")}>
          <Scissors className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Copiar" onClick={() => runClipboard("copy")}>
          <Copy className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Pegar" onClick={() => runClipboard("paste")}>
          <ClipboardPaste className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Clonar formato"
          active={paintActive}
          onClick={startFormatPainter}
        >
          <Paintbrush className="h-4 w-4" />
        </ToolButton>
        <span className="office-sep" />
        <ToolButton label="Deshacer" onClick={() => exec("undo")}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Rehacer" onClick={() => exec("redo")}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
        <span className="office-sep" />
        <ToolButton label="Buscar y reemplazar" onClick={() => setFindOpen(true)}>
          <Search className="h-4 w-4" />
        </ToolButton>
      </div>

      <div className="office-toolbar" role="toolbar" aria-label="Barra de formato">
        <select
          className="office-select office-select-style"
          value={format.heading}
          title="Estilo de párrafo"
          aria-label="Estilo de párrafo"
          onChange={(event) => exec("heading", { value: event.target.value })}
        >
          <option value="paragraph">Texto de párrafo</option>
          <option value="heading1">Título 1</option>
          <option value="heading2">Título 2</option>
          <option value="heading3">Título 3</option>
          <option value="heading4">Título 4</option>
        </select>
        <select
          className="office-select office-select-font"
          value={format.fontFamily || "Liberation Serif"}
          title="Fuente"
          aria-label="Fuente"
          onChange={(event) => exec("fontFamily", { value: event.target.value })}
        >
          {format.fontFamily && !FONT_FAMILIES.some((font) => font.value === format.fontFamily) && (
            <option value={format.fontFamily}>{format.fontFamily}</option>
          )}
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
        <select
          className="office-select office-select-size"
          value={format.fontSize}
          title="Tamaño de fuente"
          aria-label="Tamaño de fuente"
          onChange={(event) => exec("fontSize", { value: event.target.value })}
        >
          {!FONT_SIZES.includes(format.fontSize) && (
            <option value={format.fontSize}>{format.fontSize}</option>
          )}
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size.replace("pt", "")}
            </option>
          ))}
        </select>
        <span className="office-sep" />
        <ToolButton label="Negrita" active={format.bold} onClick={() => exec("bold")}>
          <BoldIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Cursiva" active={format.italic} onClick={() => exec("italic")}>
          <ItalicIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Subrayado" active={format.underline} onClick={() => exec("underline")}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Tachado" active={format.strike} onClick={() => exec("strikethrough")}>
          <StrikethroughIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Superindice" active={format.sup} onClick={() => exec("superscript")}>
          <SuperscriptIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Subindice" active={format.sub} onClick={() => exec("subscript")}>
          <SubscriptIcon className="h-4 w-4" />
        </ToolButton>
        <span className="office-sep" />
        <label className="office-status-item" title="Color de letra">
          <Palette className="h-4 w-4" style={{ color: format.fontColor }} />
          <input
            type="color"
            className="office-color"
            value={format.fontColor}
            aria-label="Color de letra"
            onChange={(event) => exec("fontColor", { value: event.target.value })}
          />
        </label>
        <label className="office-status-item" title="Color de resaltado">
          <span
            className="inline-block h-4 w-4 rounded-sm border border-black/20"
            style={{ background: format.highlight }}
          />
          <input
            type="color"
            className="office-color"
            value={format.highlight}
            aria-label="Color de resaltado"
            onChange={(event) => exec("fontBackgroundColor", { value: event.target.value })}
          />
        </label>
        <span className="office-sep" />
        <ToolButton
          label="Alinear a la izquierda"
          active={format.alignment === "left"}
          onClick={() => exec("alignment", { value: "left" })}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Centrar"
          active={format.alignment === "center"}
          onClick={() => exec("alignment", { value: "center" })}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Alinear a la derecha"
          active={format.alignment === "right"}
          onClick={() => exec("alignment", { value: "right" })}
        >
          <AlignRight className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Justificar"
          active={format.alignment === "justify"}
          onClick={() => exec("alignment", { value: "justify" })}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolButton>
        <span className="office-sep" />
        <ToolButton
          label="Vineta"
          active={format.listType === "bulleted"}
          onClick={() => exec("bulletedList")}
        >
          <ListIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Numeracion"
          active={format.listType === "numbered"}
          onClick={() => exec("numberedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Lista de tareas"
          active={format.listType === "todo"}
          onClick={() => exec("todoList")}
        >
          <ListChecks className="h-4 w-4" />
        </ToolButton>
        <span className="office-sep" />
        <select
          className="office-select office-select-spacing"
          defaultValue=""
          title="Espaciado entre líneas"
          aria-label="Espaciado entre líneas"
          onChange={(event) => {
            const spacing = LINE_SPACINGS.find((item) => item.value === event.target.value);
            if (spacing) exec("style", { styleName: spacing.styleName });
            event.target.value = "";
          }}
        >
          <option value="" disabled>
            Interlineado
          </option>
          {LINE_SPACINGS.map((spacing) => (
            <option key={spacing.value} value={spacing.value}>
              {spacing.label}
            </option>
          ))}
        </select>
        <ToolButton label="Aumentar sangria" onClick={() => exec("indent")}>
          <IndentIncrease className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Disminuir sangria" onClick={() => exec("outdent")}>
          <IndentDecrease className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Limpiar formato" onClick={() => exec("removeFormat")}>
          <Eraser className="h-4 w-4" />
        </ToolButton>
        <span className="office-sep" />
        <ToolButton label="Insertar tabla" onClick={insertTable}>
          <Table2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Insertar imagen" onClick={() => imageInputRef.current?.click()}>
          <ImagePlus className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Insertar enlace" onClick={insertLink}>
          <Link2 className="h-4 w-4" />
        </ToolButton>
      </div>

      {findOpen && <OfficeFind editor={editorRef.current} onClose={() => setFindOpen(false)} />}

      <div className="office-body">
        <div className="office-canvas" onClick={() => setOpenMenu(null)}>
          <div className="office-page-shell" style={{ zoom: zoom / 100 }}>
            {showRuler && (
              <div
                ref={rulerRef}
                className="office-ruler"
                role="group"
                aria-label="Regla de márgenes. Haz clic o arrastra para ajustar los márgenes izquierdo y derecho."
                title="Haz clic o arrastra para ajustar los márgenes"
                onPointerDown={startRulerDrag}
                onPointerMove={moveRulerDrag}
                onPointerUp={endRulerDrag}
                onPointerCancel={endRulerDrag}
              >
                <span
                  className="office-ruler-handle"
                  style={{ left: `${(margins.left / pageWidthMm) * 100}%` }}
                  aria-hidden="true"
                />
                <span
                  className="office-ruler-handle"
                  style={{
                    left: `${((pageWidthMm - margins.right) / pageWidthMm) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              </div>
            )}
            <div className="office-page" style={pageStyle}>
              <span className="office-page-corner tl" aria-hidden="true" />
              <span className="office-page-corner tr" aria-hidden="true" />
              <span className="office-page-corner bl" aria-hidden="true" />
              <span className="office-page-corner br" aria-hidden="true" />
              <CKEditor
                editor={ClassicEditor}
                data={initialHtmlRef.current}
                config={EDITOR_CONFIG}
                onReady={handleReady}
                onChange={(_event, editor) => handleEditorChange(editor)}
                onError={(error) => {
                  console.error("[Academic-Office] CKEditor", error);
                  setStatusMessage("No se pudo iniciar el motor ofimatico.");
                }}
              />
            </div>
          </div>
        </div>

        <aside className={cn("office-sidebar", sidebarOpen ? "is-open" : "is-closed")}>
          <div className="office-sidebar-tabs">
            {(
              [
                { id: "properties", label: "Propiedades", icon: Settings2 },
                { id: "styles", label: "Estilos", icon: Type },
                { id: "gallery", label: "Galeria", icon: Images },
                { id: "navigator", label: "Navegador", icon: Compass },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "office-sidebar-tab",
                  sidebarOpen && sidebarTab === tab.id && "is-active",
                )}
                title={tab.label}
                aria-label={tab.label}
                aria-pressed={sidebarOpen && sidebarTab === tab.id}
                onClick={() => {
                  setSidebarOpen(true);
                  setSidebarTab(tab.id);
                }}
              >
                <tab.icon className="h-4 w-4" />
              </button>
            ))}
            <button
              type="button"
              className="office-sidebar-tab"
              title={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
              aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
              onClick={() => setSidebarOpen((value) => !value)}
            >
              {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
            </button>
          </div>

          {sidebarOpen && (
            <div className="office-sidebar-panel">
              {sidebarTab === "properties" && (
                <>
                  <div className="office-panel-section">
                    <p className="office-sidebar-title">Propiedades de pagina</p>
                    <p className="office-sidebar-subtitle">Hoja A4 y margenes del documento.</p>
                    <div className="office-field-row">
                      <span className="office-field-label">Tamano</span>
                      <span className="office-field-label">A4</span>
                    </div>
                    <div className="office-field-row">
                      <span className="office-field-label">Orientacion</span>
                      <select
                        className="office-field-input"
                        value={orientation}
                        onChange={(event) => setOrientation(event.target.value as Orientation)}
                      >
                        <option value="portrait">Retrato</option>
                        <option value="landscape">Horizontal</option>
                      </select>
                    </div>
                    {(["top", "right", "bottom", "left"] as const).map((side) => (
                      <div className="office-field-row" key={side}>
                        <span className="office-field-label">
                          {side === "top"
                            ? "Superior"
                            : side === "bottom"
                              ? "Inferior"
                              : side === "left"
                                ? "Izquierdo"
                                : "Derecho"}{" "}
                          (mm)
                        </span>
                        <input
                          type="number"
                          min={5}
                          max={60}
                          className="office-field-input"
                          value={margins[side]}
                          onChange={(event) => {
                            const value = Math.max(5, Math.min(60, Number(event.target.value) || 5));
                            setMargins((current) => ({ ...current, [side]: value }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="office-panel-section">
                    <p className="office-sidebar-title">Vista</p>
                    <div className="office-field-row">
                      <span className="office-field-label">Zoom</span>
                      <span className="office-field-label">{zoom} %</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={200}
                      step={10}
                      value={zoom}
                      className="w-full accent-[var(--ow-accent)]"
                      aria-label="Zoom del documento"
                      onChange={(event) => setZoom(Number(event.target.value))}
                    />
                    <div className="office-field-row mt-2">
                      <span className="office-field-label">Regla</span>
                      <input
                        type="checkbox"
                        checked={showRuler}
                        onChange={(event) => setShowRuler(event.target.checked)}
                      />
                    </div>
                  </div>
                </>
              )}

              {sidebarTab === "styles" && (
                <div className="office-panel-section">
                  <p className="office-sidebar-title">Estilos de parrafo</p>
                  <p className="office-sidebar-subtitle">Aplica un estilo al bloque seleccionado.</p>
                  {[
                    { label: "Texto de parrafo", value: "paragraph", className: "font-normal" },
                    { label: "Titulo 1", value: "heading1", className: "text-base font-bold" },
                    { label: "Titulo 2", value: "heading2", className: "text-sm font-bold" },
                    { label: "Titulo 3", value: "heading3", className: "text-xs font-bold" },
                    { label: "Titulo 4", value: "heading4", className: "text-[11px] font-bold" },
                  ].map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      className={cn(
                        "office-style-button",
                        style.className,
                        format.heading === style.value && "is-active",
                      )}
                      onClick={() => exec("heading", { value: style.value })}
                    >
                      {style.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="office-style-button italic"
                    onClick={() => exec("blockQuote")}
                  >
                    Cita
                  </button>
                  <button
                    type="button"
                    className="office-style-button font-mono text-[11px]"
                    onClick={() => exec("codeBlock")}
                  >
                    Bloque de codigo
                  </button>
                </div>
              )}

              {sidebarTab === "gallery" && (
                <>
                  <div className="office-panel-section">
                    <p className="office-sidebar-title">Galeria</p>
                    <p className="office-sidebar-subtitle">
                      Inserta elementos y colores rapidos en el documento.
                    </p>
                    <button
                      type="button"
                      className="office-style-button"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-2 inline h-3.5 w-3.5" /> Insertar imagen
                    </button>
                    <button
                      type="button"
                      className="office-style-button"
                      onClick={insertPageBreak}
                    >
                      <FileText className="mr-2 inline h-3.5 w-3.5" /> Salto de pagina
                    </button>
                    <button
                      type="button"
                      className="office-style-button"
                      onClick={() => exec("horizontalLine")}
                    >
                      <Minus className="mr-2 inline h-3.5 w-3.5" /> Linea horizontal
                    </button>
                  </div>
                  <div className="office-panel-section">
                    <p className="office-sidebar-title">Colores rapidos</p>
                    <div className="office-gallery-grid">
                      {["#fff3bf", "#d3f9d8", "#d0ebff", "#ffe3e3", "#e5dbff", "#f1f3f5"].map(
                        (color) => (
                          <button
                            key={color}
                            type="button"
                            className="office-gallery-swatch"
                            style={{ background: color, color: "#1f2937", textShadow: "none" }}
                            title={`Resaltar con ${color}`}
                            onClick={() => exec("fontBackgroundColor", { value: color })}
                          >
                            Aa
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </>
              )}

              {sidebarTab === "navigator" && (
                <div>
                  <p className="office-sidebar-title">Navegador</p>
                  <p className="office-sidebar-subtitle">
                    Ve directamente a cualquier titulo del documento.
                  </p>
                  {headings.length === 0 ? (
                    <div className="office-empty-note">
                      Anade titulos con la barra de estilos para navegar por el documento.
                    </div>
                  ) : (
                    headings.map((heading) => (
                      <button
                        key={`${heading.index}-${heading.text}`}
                        type="button"
                        className="office-navigator-item"
                        style={{ paddingLeft: `${6 + (heading.level - 1) * 10}px` }}
                        onClick={() => goToHeading(heading.index)}
                      >
                        <span className="office-navigator-level">H{heading.level}</span>
                        <span className="truncate">{heading.text}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <footer className="office-status-bar">
        <span className="office-status-item">
          Página {stats.current} de {stats.pages}
        </span>
        <span className="office-status-item">
          {stats.words} palabras · {stats.chars} caracteres
        </span>
        <span className="office-status-item office-status-hide-sm">
          <Languages className="h-3 w-3" /> {lang === "es-ES" ? "Español (España)" : lang === "es-419" ? "Español (Latinoamérica)" : "English (US)"}
        </span>
        <span className="office-status-item office-status-hide-sm">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando...
            </>
          ) : savedAt ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" /> Guardado
            </>
          ) : (
            "Sin guardar"
          )}
        </span>
        {statusMessage && (
          <span className="office-status-item office-status-message">{statusMessage}</span>
        )}
        <span className="office-status-item office-status-grow office-zoom">
          <button
            type="button"
            className="office-tool"
            aria-label="Reducir zoom"
            onClick={() => setZoom((value) => Math.max(50, value - 10))}
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={zoom}
            aria-label="Zoom"
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <span className="office-zoom-value">{zoom} %</span>
          <button
            type="button"
            className="office-tool"
            aria-label="Aumentar zoom"
            onClick={() => setZoom((value) => Math.min(200, value + 10))}
          >
            <Plus className="h-3 w-3" />
          </button>
        </span>
      </footer>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") insertImageSource(reader.result);
          };
          reader.readAsDataURL(file);
          event.target.value = "";
        }}
      />

      {specialOpen && (
        <div className="office-dialog-backdrop" onClick={() => setSpecialOpen(false)}>
          <div className="office-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="office-dialog-header">
              <div>
                <p className="office-sidebar-title">Caracteres especiales</p>
                <p className="office-sidebar-subtitle">
                  Pulsa un caracter para insertarlo en la posicion del cursor.
                </p>
              </div>
              <button
                type="button"
                className="office-tool"
                aria-label="Cerrar"
                onClick={() => setSpecialOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="office-char-grid">
              {SPECIAL_CHARACTERS.map((character) => (
                <button
                  key={character}
                  type="button"
                  className="office-char"
                  title={character}
                  onClick={() => insertSpecial(character)}
                >
                  {character}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
