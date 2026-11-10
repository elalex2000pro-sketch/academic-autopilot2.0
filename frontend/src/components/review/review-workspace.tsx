import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRealtime } from "@/components/realtime-provider";
import { api } from "@/lib/api";
import type {
  Flashcard,
  Notebook,
  NotebookChatMessage,
  NotebookCitation,
  NotebookSource,
  NotebookToolAction,
  Quiz,
} from "@/lib/types";
import { ReviewChat } from "./review-chat";
import { ReviewSources } from "./review-sources";
import { ReviewStudio, type StudyTarget } from "./review-studio";

const panels = ["Fuentes", "Chat", "Studio"] as const;
const stages: Record<string, string> = {
  reading: "Leyendo fuentes…",
  answering: "Consultando al modelo…",
  create_flashcards: "Creando tarjetas…",
  create_quiz: "Creando cuestionario…",
  create_summary: "Guardando resumen…",
};

export function ReviewWorkspace({
  notebook,
  cards,
  onNotebookChanged,
  onMaterialChanged,
  onStudy,
}: {
  notebook: Notebook;
  cards: Flashcard[];
  onNotebookChanged: (notebook: Notebook) => void;
  onMaterialChanged: () => Promise<void>;
  onStudy: (target: StudyTarget) => void;
}) {
  const [panel, setPanel] = useState<(typeof panels)[number]>("Chat");
  const [wide, setWide] = useState(false);
  const [sources, setSources] = useState<NotebookSource[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<NotebookChatMessage[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [citation, setCitation] = useState<NotebookCitation | null>(null);
  const [stage, setStage] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const turnId = useRef<string | null>(null);
  const notesRequested = useRef(false);
  const reduced = useReducedMotion();
  const indicatorId = useId();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let current = true;
    Promise.all([
      api.notebookSources(notebook.id),
      api.notebookMessages(notebook.id),
      api.quizzes(),
    ])
      .then(([sourceList, history, quizList]) => {
        if (!current) return;
        setSources(sourceList);
        setSelected(sourceList.map((source) => source.id));
        setMessages(history);
        setQuizzes(quizList.filter((quiz) => quiz.notebook_id === notebook.id));
      })
      .catch((error) => {
        if (current) setNotice(error.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [notebook.id]);

  useRealtime((event) => {
    if (event.event !== "notebook_chat_progress") return;
    const data = event.data as { turn_id?: string; stage?: string } | undefined;
    if (
      turnId.current &&
      data?.turn_id === turnId.current &&
      data.stage &&
      stages[data.stage]
    ) {
      setStage(stages[data.stage]);
    }
  });

  async function send(question: string) {
    if (turnId.current || saving || loading || !selected.length) return;
    const id = crypto.randomUUID();
    turnId.current = id;
    setStage("Enviando consulta…");
    setNotice("");
    setPanel("Chat");
    const createdAt = new Date().toISOString();
    setMessages((history) => [
      ...history,
      {
        id,
        role: "user",
        content: question,
        citations: [],
        actions: [],
        created_at: createdAt,
      },
    ]);
    try {
      const result = await api.notebookChat(notebook.id, {
        question,
        source_ids: selected,
        turn_id: id,
      });
      setMessages((history) => [
        ...history,
        {
          id: result.id,
          role: "assistant",
          content: result.answer,
          citations: result.citations,
          actions: result.actions,
          created_at: createdAt,
        },
      ]);
      setNotice(result.warnings.join(" · "));
      if (result.actions.some((action) => action.ok)) {
        const [updated, quizList] = await Promise.all([
          api.notebook(notebook.id),
          api.quizzes(),
          onMaterialChanged(),
        ]);
        onNotebookChanged(updated);
        setQuizzes(quizList.filter((quiz) => quiz.notebook_id === notebook.id));
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo completar la consulta.",
      );
    } finally {
      turnId.current = null;
      setStage("");
    }
  }

  async function save(id: string) {
    if (saving) return;
    setSaving(id);
    setNotice("");
    try {
      onNotebookChanged(await api.saveNotebookMessageNote(notebook.id, id));
      setSaved((previous) => [...previous, id]);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo guardar la nota.",
      );
    } finally {
      setSaving(null);
    }
  }

  function viewAction(action: NotebookToolAction) {
    if (action.tool === "create_flashcards") {
      onStudy({ tab: "decks", id: notebook.id, cardIds: action.ids });
    } else if (action.tool === "create_quiz" && action.ids?.[0]) {
      onStudy({ tab: "exams", id: action.ids[0] });
    } else {
      notesRequested.current = true;
      setPanel("Studio");
      document
        .getElementById("review-notes")
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  const disabled = loading || Boolean(stage) || saving !== null || selected.length === 0;
  const content = {
    Fuentes: (
      <ReviewSources
        notebookId={notebook.id}
        sources={sources}
        selected={selected}
        citation={citation}
        onSelect={setSelected}
      />
    ),
    Chat: (
      <ReviewChat
        messages={messages}
        disabled={disabled}
        stage={stage}
        onSend={(question) => void send(question)}
        onCitation={(value) => {
          setCitation(value);
          setPanel("Fuentes");
        }}
        onAction={viewAction}
        onSave={(id) => void save(id)}
        saving={saving}
        saved={saved}
      />
    ),
    Studio: (
      <ReviewStudio
        notebook={notebook}
        cardCount={
          cards.filter((card) => card.notebook_id === notebook.id).length
        }
        quizzes={quizzes}
        disabled={disabled}
        onGenerate={(question) => void send(question)}
        onStudy={onStudy}
      />
    ),
  };

  return (
    <div className="space-y-3">
      <div
        className="app-glass grid grid-cols-3 gap-1 rounded-xl p-1 lg:hidden"
        aria-label="Paneles de repaso"
      >
        {panels.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={panel === name}
            onClick={() => setPanel(name)}
            className="relative isolate rounded-lg px-2 py-2 text-sm font-medium"
          >
            {panel === name && (
              <motion.span
                layoutId={indicatorId}
                initial={false}
                className="absolute inset-0 -z-10 rounded-lg bg-primary/15"
              />
            )}
            {name}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          Cargando cuaderno…
        </p>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(10rem,1fr)_minmax(0,2.25fr)_minmax(10rem,1fr)]">
          <AnimatePresence initial={false} mode={wide ? "sync" : "wait"}>
            {(wide ? panels : [panel]).map((name) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: reduced ? 0 : 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduced ? 0 : -8 }}
                onAnimationComplete={() => {
                  if (name === "Studio" && notesRequested.current) {
                    notesRequested.current = false;
                    document
                      .getElementById("review-notes")
                      ?.scrollIntoView({ block: "nearest" });
                  }
                }}
                className="app-glass min-w-0 rounded-2xl p-4"
              >
                {content[name]}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
