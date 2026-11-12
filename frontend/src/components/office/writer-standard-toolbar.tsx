"use client";
import { FilePlus2, FolderOpen, Save, FileDown, Printer, Scissors, Copy, ClipboardPaste, Paintbrush, Undo2, Redo2, Search } from "lucide-react";
import { ToolButton } from "./writer-tool-button";

interface WriterStandardToolbarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: (kind: "pdf") => void;
  runClipboard: (action: "cut" | "copy" | "paste") => void;
  paintActive: boolean;
  startFormatPainter: () => void;
  exec: (command: string, value?: unknown) => void;
  onFind: () => void;
}

export function WriterStandardToolbar({ onNew, onOpen, onSave, onExport, runClipboard, paintActive, startFormatPainter, exec, onFind }: WriterStandardToolbarProps) {
  return (
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
        <ToolButton label="Buscar y reemplazar" onClick={onFind}>
          <Search className="h-4 w-4" />
        </ToolButton>
      </div>
  );
}
