"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type {
  Flashcard,
  FlashcardStats,
  Notebook,
  Quiz,
  QuizResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "cards" | "exams";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>("cards");
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebookId, setNotebookId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .notebooks()
      .then((data) => {
        setNotebooks(data);
        if (data.length > 0) setNotebookId(data[0].id);
      })
      .catch((error) => setNotice(errorMessage(error)));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 animate-fade-up">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Brain className="h-6 w-6 text-violet-600" />
          Repaso inteligente
        </h1>
        <p className="text-sm text-muted-foreground">
          Flashcards con repaso espaciado y exámenes tipo test corregidos al instante, generados a
          partir de tus cuadernos.
        </p>
      </header>

      <div className="flex gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-border dark:bg-card">
        <button
          type="button"
          onClick={() => setTab("cards")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
            tab === "cards"
              ? "bg-violet-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200",
          )}
        >
          <Layers className="h-4 w-4" /> Flashcards
        </button>
        <button
          type="button"
          onClick={() => setTab("exams")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
            tab === "exams"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200",
          )}
        >
          <GraduationCap className="h-4 w-4" /> Modo examen
        </button>
      </div>

      {notice && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          {notice}
        </p>
      )}

      {tab === "cards" ? (
        <FlashcardsTab
          notebooks={notebooks}
          notebookId={notebookId}
          setNotebookId={setNotebookId}
          notify={setNotice}
        />
      ) : (
        <ExamsTab
          notebooks={notebooks}
          notebookId={notebookId}
          setNotebookId={setNotebookId}
          notify={setNotice}
          busy={busy}
          setBusy={setBusy}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Flashcards
// --------------------------------------------------------------------------- //
function FlashcardsTab({
  notebooks,
  notebookId,
  setNotebookId,
  notify,
}: {
  notebooks: Notebook[];
  notebookId: string;
  setNotebookId: (id: string) => void;
  notify: (message: string | null) => void;
}) {
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<FlashcardStats>({ total: 0, due: 0 });
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dueOnly, setDueOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cards, statsData] = await Promise.all([
        api.flashcards({ due_only: dueOnly }),
        api.flashcardStats(),
      ]);
      setQueue(cards);
      setStats(statsData);
      setIndex(0);
      setFlipped(false);
      if (!dueOnly) setAllCards(cards);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [dueOnly, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = queue[index] ?? null;
  const progress = queue.length > 0 ? Math.round((index / queue.length) * 100) : 0;

  async function generate() {
    if (!notebookId) {
      notify("Primero crea un cuaderno con apuntes.");
      return;
    }
    setBusy(true);
    notify(null);
    try {
      const result = await api.generateFlashcards(notebookId);
      notify(
        `${result.created} tarjetas creadas${
          result.source === "heuristic" ? " (modo local, sin IA)" : " con IA"
        }.`,
      );
      await load();
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function review(quality: number) {
    if (!current) return;
    setBusy(true);
    try {
      await api.reviewFlashcard(current.id, quality);
      setFlipped(false);
      if (index + 1 >= queue.length) {
        setIndex(queue.length);
      } else {
        setIndex(index + 1);
      }
      setStats(await api.flashcardStats());
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function addCard() {
    if (!front.trim() || !back.trim()) {
      notify("Escribe la pregunta y la respuesta.");
      return;
    }
    setBusy(true);
    try {
      await api.createFlashcard({
        front: front.trim(),
        back: back.trim(),
        notebook_id: notebookId || null,
      });
      setFront("");
      setBack("");
      notify("Tarjeta añadida.");
      await load();
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeCard(id: string) {
    if (!window.confirm("¿Eliminar esta tarjeta?")) return;
    try {
      await api.deleteFlashcard(id);
      await load();
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="label-caps">Para repasar hoy</p>
          <p className="mt-1 text-3xl font-semibold tabular text-foreground">{stats.due}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="label-caps">Totales</p>
          <p className="mt-1 text-3xl font-semibold tabular text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Repasadas en esta sesión
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-800">
            {Math.min(index, queue.length)}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-600">Cuaderno de origen</span>
            <select
              value={notebookId}
              onChange={(event) => setNotebookId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-300"
            >
              <option value="">Selecciona un cuaderno</option>
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.title}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={generate} disabled={busy || !notebookId}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generar tarjetas
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          La IA crea las tarjetas; si no tienes una configurada, se extraen automáticamente del
          texto del cuaderno.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Sesión de repaso
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setDueOnly(true)}
              className={cn(
                "rounded-full px-3 py-1 font-medium",
                dueOnly ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500",
              )}
            >
              Pendientes
            </button>
            <button
              type="button"
              onClick={() => setDueOnly(false)}
              className={cn(
                "rounded-full px-3 py-1 font-medium",
                !dueOnly ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500",
              )}
            >
              Todas
            </button>
            <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Recargar">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="mt-2 font-semibold">
              {dueOnly ? "No tienes tarjetas pendientes hoy" : "Todavía no hay tarjetas"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Genera flashcards desde un cuaderno o cambia a «Todas» para repasar igualmente.
            </p>
          </div>
        ) : index >= queue.length ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="mt-2 font-semibold">Sesión completada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Has repasado {queue.length} tarjetas. Vuelve mañana para consolidar.
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => void load()}>
              <RotateCcw className="h-4 w-4" /> Empezar otra vez
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Tarjeta {index + 1} de {queue.length}
            </p>
            <button
              type="button"
              onClick={() => setFlipped((value) => !value)}
              className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-foreground/20"
            >
              <span className="label-caps">
                {flipped ? "Respuesta" : "Pregunta"}
              </span>
              <span className="mt-3 whitespace-pre-wrap text-lg font-semibold leading-relaxed text-slate-800">
                {flipped ? current.back : current.front}
              </span>
              {!flipped && (
                <span className="mt-4 text-xs text-slate-400">Pulsa la tarjeta para ver la respuesta</span>
              )}
            </button>

            {flipped && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="secondary" onClick={() => review(1)} disabled={busy}>
                  Otra vez
                </Button>
                <Button variant="secondary" onClick={() => review(3)} disabled={busy}>
                  Difícil
                </Button>
                <Button onClick={() => review(4)} disabled={busy}>
                  Bien
                </Button>
                <Button variant="secondary" onClick={() => review(5)} disabled={busy}>
                  Fácil
                </Button>
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">
              La tarjeta volverá justo cuando estés a punto de olvidarla (repaso espaciado SM-2).
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Plus className="h-4 w-4" /> Añadir tarjeta manual
          </h2>
          <div className="mt-3 space-y-2">
            <input
              value={front}
              onChange={(event) => setFront(event.target.value)}
              placeholder="Pregunta o concepto"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300"
            />
            <textarea
              value={back}
              onChange={(event) => setBack(event.target.value)}
              placeholder="Respuesta o definición"
              className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300"
            />
            <Button onClick={addCard} disabled={busy} className="w-full">
              <Plus className="h-4 w-4" /> Añadir
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Mis tarjetas ({allCards.length || stats.total})
          </h2>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {(allCards.length > 0 ? allCards : queue).map((card) => (
              <div
                key={card.id}
                className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-700">{card.front}</p>
                  <p className="truncate text-xs text-muted-foreground">{card.back}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeCard(card.id)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  aria-label="Eliminar tarjeta"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {(allCards.length > 0 ? allCards : queue).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Aún no hay tarjetas. Genera algunas desde un cuaderno.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Exámenes
// --------------------------------------------------------------------------- //
function ExamsTab({
  notebooks,
  notebookId,
  setNotebookId,
  notify,
  busy,
  setBusy,
}: {
  notebooks: Notebook[];
  notebookId: string;
  setNotebookId: (id: string) => void;
  notify: (message: string | null) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [active, setActive] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  const load = useCallback(async () => {
    try {
      setQuizzes(await api.quizzes());
    } catch (error) {
      notify(errorMessage(error));
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const answered = useMemo(
    () => answers.filter((answer) => typeof answer === "number" && answer >= 0).length,
    [answers],
  );

  async function generate() {
    if (!notebookId) {
      notify("Primero crea un cuaderno con apuntes.");
      return;
    }
    setBusy(true);
    notify(null);
    try {
      const quiz = await api.generateQuiz(notebookId);
      setActive(quiz);
      setAnswers(new Array(quiz.questions.length).fill(-1));
      setResult(null);
      await load();
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!active) return;
    if (answered < active.questions.length) {
      notify("Responde todas las preguntas antes de corregir.");
      return;
    }
    setBusy(true);
    try {
      const graded = await api.submitQuiz(active.id, answers);
      setResult(graded);
      setActive(graded.quiz);
      notify(null);
      await load();
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeQuiz(id: string) {
    if (!window.confirm("¿Eliminar este examen y su resultado?")) return;
    try {
      await api.deleteQuiz(id);
      if (active?.id === id) {
        setActive(null);
        setResult(null);
      }
      await load();
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-600">Cuaderno para el examen</span>
            <select
              value={notebookId}
              onChange={(event) => setNotebookId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300"
            >
              <option value="">Selecciona un cuaderno</option>
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.title}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={generate} disabled={busy || !notebookId}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Crear examen
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Preguntas tipo test con cuatro opciones y explicación de cada respuesta.
        </p>
      </section>

      {active && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{active.title}</h2>
              <p className="text-xs text-muted-foreground">
                {active.questions.length} preguntas
                {result ? ` · Nota: ${result.score}/${result.total}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActive(null);
                setResult(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" /> Salir
            </Button>
          </div>

          <div className="space-y-4">
            {active.questions.map((question, questionIndex) => {
              const detail = result?.details[questionIndex];
              return (
                <div
                  key={questionIndex}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-semibold text-slate-800">
                    {questionIndex + 1}. {question.question}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[questionIndex] === optionIndex;
                      const correct = result && question.answer === optionIndex;
                      const wrong = result && selected && !correct;
                      return (
                        <button
                          key={optionIndex}
                          type="button"
                          disabled={Boolean(result)}
                          onClick={() => {
                            const next = [...answers];
                            next[questionIndex] = optionIndex;
                            setAnswers(next);
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all",
                            correct
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : wrong
                                ? "border-rose-300 bg-rose-50 text-rose-800"
                                : selected
                                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                                  : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50",
                          )}
                        >
                          {correct ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                          ) : wrong ? (
                            <XCircle className="h-4 w-4 shrink-0" />
                          ) : (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                          )}
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                  {result && question.explanation && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {question.explanation}
                    </p>
                  )}
                  {result && detail === false && (
                    <p className="mt-1 text-xs font-medium text-rose-600">
                      Respuesta correcta: {question.options[question.answer]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!result ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {answered} de {active.questions.length} respondidas
              </p>
              <Button onClick={submit} disabled={busy || answered < active.questions.length}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Corregir examen
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-indigo-200 bg-white p-4 text-center">
              <p className="text-sm text-muted-foreground">Resultado</p>
              <p className="text-3xl font-bold text-indigo-700">
                {result.score} / {result.total}
              </p>
              <p className="text-sm text-muted-foreground">
                {Math.round((result.score / Math.max(result.total, 1)) * 100)}% de aciertos
              </p>
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Historial de exámenes
        </h2>
        <div className="mt-3 space-y-2">
          {quizzes.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no has creado ningún examen.
            </p>
          )}
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <GraduationCap className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{quiz.title}</p>
                <p className="text-xs text-muted-foreground">
                  {quiz.completed_at
                    ? `Nota: ${quiz.score}/${quiz.total} · ${new Date(
                        quiz.completed_at,
                      ).toLocaleDateString("es-ES")}`
                    : "Sin completar"}
                </p>
              </div>
              {quiz.completed_at && (
                <span className="hidden items-center gap-1 text-xs font-semibold text-indigo-600 sm:flex">
                  {Math.round(((quiz.score ?? 0) / Math.max(quiz.total, 1)) * 100)}%
                  <ChevronRight className="h-3 w-3" />
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setActive(quiz);
                  setAnswers(new Array(quiz.questions.length).fill(-1));
                  setResult(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Abrir
              </button>
              <button
                type="button"
                onClick={() => removeQuiz(quiz.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                aria-label="Eliminar examen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
