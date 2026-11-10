import Link from "next/link";
import { BookOpen, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotebookCitation, NotebookSource } from "@/lib/types";

export function ReviewSources({
  notebookId,
  sources,
  selected,
  citation,
  onSelect,
}: {
  notebookId: string;
  sources: NotebookSource[];
  selected: string[];
  citation: NotebookCitation | null;
  onSelect: (ids: string[]) => void;
}) {
  return (
    <section className="space-y-4" aria-label="Fuentes">
      <h2 className="font-semibold">Fuentes</h2>
      <Link
        href={`/notebooks?addSource=${notebookId}`}
        className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"
      >
        <Plus className="h-4 w-4" /> Añadir una fuente
      </Link>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Añade un libro o documento para consultar este cuaderno.
        </p>
      ) : (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onSelect(
                selected.length === sources.length
                  ? []
                  : sources.map((source) => source.id),
              )
            }
          >
            {selected.length === sources.length
              ? "Deseleccionar todas"
              : "Seleccionar todas"}
          </Button>
          <ul className="space-y-2">
            {sources.map((source) => {
              const Icon = source.kind === "book" ? BookOpen : FileText;
              return (
                <li key={source.id}>
                  <label
                    className={`flex items-start gap-2 rounded-xl border p-2.5 text-sm ${citation?.source_id === source.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.includes(source.id)}
                      onChange={(event) =>
                        onSelect(
                          event.target.checked
                            ? [...selected, source.id]
                            : selected.filter((id) => id !== source.id),
                        )
                      }
                    />
                    <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 break-words">{source.title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {citation && (
        <div
          aria-live="polite"
          className="rounded-xl border border-primary/30 bg-background/50 p-3 text-sm"
        >
          <p className="break-words font-medium">
            [{citation.number}] {citation.title}
          </p>
          {citation.page && (
            <p className="text-xs text-muted-foreground">
              Pág. {citation.page}
              {citation.page_end && citation.page_end !== citation.page
                ? `–${citation.page_end}`
                : ""}
            </p>
          )}
          <blockquote className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words">
            {citation.fragment}
          </blockquote>
        </div>
      )}
    </section>
  );
}
