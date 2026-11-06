"use client";

// Editor de documentos de Academic-Office sobre Tiptap (ProseMirror).
import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from "lucide-react";

interface DocumentEditorProps {
  html: string;
  onChange: (html: string) => void;
}

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
        active
          ? "border-primary/40 bg-primary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          : "border-transparent text-foreground/70 hover:border-border hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  function setLink() {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("URL del enlace", previous || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-white/40 px-3 py-2 dark:border-white/10">
      <ToolButton
        label="Deshacer"
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Rehacer"
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        label="Texto normal"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Titulo 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Titulo 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Titulo 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        label="Negrita"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Cursiva"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Subrayado"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Tachado"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Codigo"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code2 className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        label="Lista"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Cita"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Linea separadora"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        label="Anadir enlace"
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <Link2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Quitar enlace"
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Unlink className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}

export function DocumentEditor({ html, onChange }: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: html,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "office-prose min-h-[58vh] px-8 py-7 focus:outline-none",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  // Abrir otro documento o crear uno nuevo reemplaza el contenido del editor.
  useEffect(() => {
    if (!editor) return;
    if (html !== editor.getHTML()) {
      editor.commands.setContent(html, false);
    }
  }, [editor, html]);

  if (!editor) {
    return (
      <div className="flex min-h-[58vh] items-center justify-center text-sm text-muted-foreground">
        Cargando editor de documentos...
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar editor={editor} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto my-6 w-full max-w-[820px] rounded-xl border border-white/50 bg-white/85 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-950/70">
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/40 px-4 py-1.5 text-[11px] text-muted-foreground dark:border-white/10">
        <span>
          {editor.getText().split(/\s+/).filter(Boolean).length} palabras
        </span>
        <span>{editor.isEditable ? "Edicion activa" : "Solo lectura"}</span>
      </div>
      <style jsx global>{`
        .office-prose {
          color: hsl(var(--foreground));
          font-size: 15px;
          line-height: 1.65;
        }
        .office-prose h1 {
          font-size: 1.9rem;
          font-weight: 700;
          line-height: 1.2;
          margin: 0 0 0.6rem;
        }
        .office-prose h2 {
          font-size: 1.4rem;
          font-weight: 650;
          margin: 1.3rem 0 0.5rem;
        }
        .office-prose h3 {
          font-size: 1.15rem;
          font-weight: 600;
          margin: 1.1rem 0 0.4rem;
        }
        .office-prose p {
          margin: 0 0 0.65rem;
        }
        .office-prose ul,
        .office-prose ol {
          margin: 0 0 0.75rem 1.25rem;
          list-style: revert;
        }
        .office-prose li {
          margin-bottom: 0.2rem;
        }
        .office-prose blockquote {
          border-left: 3px solid hsl(var(--primary));
          margin: 0.8rem 0;
          padding: 0.35rem 0.9rem;
          color: hsl(var(--muted-foreground));
        }
        .office-prose code {
          background: hsl(var(--muted));
          border-radius: 4px;
          font-size: 0.85em;
          padding: 0.1rem 0.3rem;
        }
        .office-prose hr {
          border-color: hsl(var(--border));
          margin: 1.2rem 0;
        }
        .office-prose a {
          color: hsl(var(--primary));
          text-decoration: underline;
        }
        .office-prose p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground));
          content: "Empieza a escribir tu documento...";
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
