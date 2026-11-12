"use client";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List as ListIcon,
  ListOrdered,
  ListChecks,
  IndentIncrease,
  IndentDecrease,
  Eraser,
  Table2,
  ImagePlus,
  Link2,
} from "lucide-react";
import { ToolButton } from "./writer-tool-button";
import { FONT_FAMILIES, FONT_SIZES, LINE_SPACINGS } from "./writer-config";

export interface FormatState {
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

interface WriterFormatToolbarProps {
  format: FormatState;
  exec: (command: string, value?: unknown) => void;
  insertTable: () => void;
  insertLink: () => void;
  onInsertImage: () => void;
}

export function WriterFormatToolbar({ format, exec, insertTable, insertLink, onInsertImage }: WriterFormatToolbarProps) {
  return (
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
        <ToolButton label="Insertar imagen" onClick={onInsertImage}>
          <ImagePlus className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Insertar enlace" onClick={insertLink}>
          <Link2 className="h-4 w-4" />
        </ToolButton>
      </div>
  );
}
