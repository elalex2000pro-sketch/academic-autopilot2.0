import { Button } from "@/components/ui/button";
import type { Notebook, Quiz } from "@/lib/types";

export const generationPrompts = {
  Resumen:
    "Crea y guarda un resumen de las ideas principales de las fuentes seleccionadas.",
  Tarjetas: "Crea tarjetas de repaso basadas en las fuentes seleccionadas.",
  Cuestionario:
    "Crea un cuestionario de autoevaluación basado en las fuentes seleccionadas.",
};

export type StudyTarget = {
  tab: "decks" | "exams" | "games";
  id?: string;
  cardIds?: string[];
};

export function ReviewStudio({
  notebook,
  cardCount,
  quizzes,
  disabled,
  onGenerate,
  onStudy,
}: {
  notebook: Notebook;
  cardCount: number;
  quizzes: Quiz[];
  disabled: boolean;
  onGenerate: (question: string) => void;
  onStudy: (target: StudyTarget) => void;
}) {
  return (
    <section className="space-y-5" aria-label="Studio">
      <h2 className="font-semibold">Studio</h2>
      <div className="grid gap-2">
        {(
          Object.keys(generationPrompts) as (keyof typeof generationPrompts)[]
        ).map((label) => (
          <Button
            key={label}
            variant="secondary"
            disabled={disabled}
            onClick={() => onGenerate(generationPrompts[label])}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Material de estudio</h3>
        {cardCount === 0 && quizzes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            El material que crees aparecerá aquí.
          </p>
        )}
        {cardCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onStudy({ tab: "decks", id: notebook.id })}
          >
            Estudiar {cardCount} {cardCount === 1 ? "tarjeta" : "tarjetas"}
          </Button>
        )}
        {quizzes.map((quiz) => (
          <Button
            key={quiz.id}
            size="sm"
            variant="outline"
            className="h-auto w-full whitespace-normal text-left"
            onClick={() => onStudy({ tab: "exams", id: quiz.id })}
          >
            {quiz.title}
          </Button>
        ))}
      </div>
      <div id="review-notes" className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Notas guardadas</h3>
        {notebook.content.trim() ? (
          <div className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background/50 p-3 text-sm">
            {notebook.content}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Guarda una respuesta del chat o genera un resumen.
          </p>
        )}
      </div>
    </section>
  );
}
