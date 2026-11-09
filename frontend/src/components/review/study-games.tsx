"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Gamepad2,
  Layers,
  PenLine,
  RefreshCw,
  Sparkles,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { awardXp } from "@/lib/gamification";
import type { Flashcard } from "@/lib/types";
import { cn } from "@/lib/utils";

type GameMode = "quiz" | "match" | "cloze";
type Feedback = "correct" | "wrong" | null;

interface QuizRound {
  card: Flashcard;
  options: string[];
  answer: number;
}

interface MatchPair {
  id: string;
  front: string;
  back: string;
}

interface ClozeRound {
  card: Flashcard;
  prompt: string;
  answer: string;
}

const GAME_MODES: Array<{
  id: GameMode;
  title: string;
  description: string;
  icon: typeof Zap;
  accent: string;
}> = [
  {
    id: "quiz",
    title: "Quiz relámpago",
    description: "Una pregunta, cuatro opciones y tu memoria a prueba.",
    icon: Zap,
    accent: "#0066FF",
  },
  {
    id: "match",
    title: "Unir conceptos",
    description: "Empareja cada concepto con su definición antes de fallar.",
    icon: Layers,
    accent: "#AF52DE",
  },
  {
    id: "cloze",
    title: "Rellenar huecos",
    description: "Completa la palabra que falta en la respuesta.",
    icon: PenLine,
    accent: "#34C759",
  },
];

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [next[index], next[random]] = [next[random], next[index]];
  }
  return next;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function truncate(value: string, max = 76): string {
  const clean = value.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function buildQuiz(cards: Flashcard[]): QuizRound[] {
  return shuffle(cards)
    .slice(0, 5)
    .flatMap((card) => {
      const distractors = [
        ...new Set(
          cards
            .filter(
              (candidate) =>
                candidate.id !== card.id &&
                normalize(candidate.back) !== normalize(card.back),
            )
            .map((candidate) => candidate.back.trim()),
        ),
      ].filter(Boolean);
      const options = shuffle([
        card.back.trim(),
        ...shuffle(distractors).slice(0, 3),
      ]);
      if (options.length < 2) return [];
      return [
        {
          card,
          options,
          answer: options.indexOf(card.back.trim()),
        },
      ];
    });
}

function buildMatch(cards: Flashcard[]): MatchPair[] {
  const pairs: MatchPair[] = [];
  const usedAnswers = new Set<string>();
  for (const card of shuffle(cards)) {
    const answerKey = normalize(card.back);
    if (!answerKey || usedAnswers.has(answerKey)) continue;
    usedAnswers.add(answerKey);
    pairs.push({ id: card.id, front: card.front.trim(), back: card.back.trim() });
    if (pairs.length >= 5) break;
  }
  return pairs;
}

function buildCloze(cards: Flashcard[]): ClozeRound[] {
  return shuffle(cards)
    .slice(0, 5)
    .flatMap((card) => {
      const words = card.back.trim().split(/\s+/);
      const index = words.findIndex(
        (word) => word.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/g, "").length >= 4,
      );
      if (index < 0) return [];
      const answer = words[index].replace(/[.,;:!?¿¡"'()]/g, "");
      if (!answer) return [];
      const prompt = words
        .map((word, wordIndex) => (wordIndex === index ? "_____" : word))
        .join(" ");
      return [{ card, prompt, answer }];
    });
}

export function StudyGames({ cards }: { cards: Flashcard[] }) {
  const { user } = useAuth();
  const playableCards = useMemo(
    () => cards.filter((card) => card.front.trim() && card.back.trim()),
    [cards],
  );
  const [mode, setMode] = useState<GameMode | null>(null);
  const [quiz, setQuiz] = useState<QuizRound[]>([]);
  const [cloze, setCloze] = useState<ClozeRound[]>([]);
  const [matchPairs, setMatchPairs] = useState<MatchPair[]>([]);
  const [matchAnswers, setMatchAnswers] = useState<MatchPair[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [selected, setSelected] = useState<{
    id: string;
    side: "front" | "back";
  } | null>(null);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awardedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const total =
    mode === "quiz"
      ? quiz.length
      : mode === "match"
        ? matchPairs.length
        : mode === "cloze"
          ? cloze.length
          : 0;
  const currentQuiz = quiz[round] ?? null;
  const currentCloze = cloze[round] ?? null;

  function startGame(nextMode: GameMode) {
    if (playableCards.length < 2) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    awardedRef.current = false;
    setMode(nextMode);
    setFinished(false);
    setEarnedXp(0);
    setRound(0);
    setScore(0);
    setFeedback(null);
    setPicked(null);
    setInput("");
    setMatched([]);
    setSelected(null);

    if (nextMode === "quiz") {
      setQuiz(buildQuiz(playableCards));
    } else if (nextMode === "match") {
      const pairs = buildMatch(playableCards);
      setMatchPairs(pairs);
      setMatchAnswers(shuffle(pairs));
    } else {
      setCloze(buildCloze(playableCards));
    }
  }

  function resetToMenu() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMode(null);
    setFinished(false);
    setFeedback(null);
    setPicked(null);
    setInput("");
    setMatched([]);
    setSelected(null);
    setScore(0);
    setEarnedXp(0);
    awardedRef.current = false;
  }

  function finishGame(finalScore: number, totalCount: number, label: string) {
    if (awardedRef.current) return;
    awardedRef.current = true;
    const xp = Math.max(10, 20 + Math.round((finalScore / Math.max(1, totalCount)) * 50));
    setEarnedXp(finalScore > 0 ? xp : 0);
    setFinished(true);
    if (user?.id && finalScore > 0) {
      awardXp(user.id, xp, `Minijuego: ${label}`);
    }
  }

  function answerQuiz(index: number) {
    if (!currentQuiz || feedback) return;
    const correct = index === currentQuiz.answer;
    setPicked(index);
    setFeedback(correct ? "correct" : "wrong");
    if (correct) setScore((value) => value + 1);
  }

  function nextQuiz() {
    if (!feedback) return;
    if (round + 1 >= quiz.length) {
      finishGame(score, quiz.length, "Quiz relámpago");
      return;
    }
    setRound((value) => value + 1);
    setFeedback(null);
    setPicked(null);
  }

  function checkCloze() {
    if (!currentCloze || feedback || !input.trim()) return;
    const correct = normalize(input) === normalize(currentCloze.answer);
    setFeedback(correct ? "correct" : "wrong");
    if (correct) setScore((value) => value + 1);
  }

  function nextCloze() {
    if (!feedback) return;
    if (round + 1 >= cloze.length) {
      finishGame(score, cloze.length, "Rellenar huecos");
      return;
    }
    setRound((value) => value + 1);
    setFeedback(null);
    setInput("");
  }

  function chooseMatch(pairId: string, side: "front" | "back") {
    if (finished || matched.includes(pairId)) return;
    if (!selected) {
      setSelected({ id: pairId, side });
      return;
    }
    if (selected.id === pairId && selected.side !== side) {
      const nextMatched = [...matched, pairId];
      setMatched(nextMatched);
      setSelected(null);
      setFeedback("correct");
      setScore(nextMatched.length);
      if (nextMatched.length === matchPairs.length) {
        timerRef.current = setTimeout(
          () => finishGame(nextMatched.length, matchPairs.length, "Unir conceptos"),
          450,
        );
      }
      return;
    }
    if (selected.id === pairId) {
      setSelected({ id: pairId, side });
      return;
    }
    setFeedback("wrong");
    timerRef.current = setTimeout(() => {
      setSelected(null);
      setFeedback(null);
    }, 500);
  }

  if (playableCards.length < 2) {
    return (
      <section className="app-glass rounded-3xl p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066FF]/10 text-[#0066FF]">
          <Gamepad2 className="h-7 w-7" />
        </span>
        <h2 className="mt-3 text-[20px] font-semibold text-slate-800 dark:text-white/90">
          Necesitas al menos 2 tarjetas
        </h2>
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-slate-500 dark:text-white/40">
          Crea o genera tarjetas en un mazo y vuelve aquí. Los minijuegos usan tus
          propias preguntas y respuestas.
        </p>
      </section>
    );
  }

  if (finished) {
    return (
      <section className="app-glass rounded-3xl p-6 text-center sm:p-8">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#34C759]/12 text-[#34C759]">
          <Trophy className="h-8 w-8" />
        </span>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
          Ronda completada
        </p>
        <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-slate-800 dark:text-white/90">
          {score} de {total} aciertos
        </h2>
        {earnedXp > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-200">
            <Sparkles className="h-3.5 w-3.5" /> +{earnedXp} EXP
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-white/35">
            Sigue practicando para sumar EXP.
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => startGame(mode ?? "quiz")}>
            <RefreshCw className="h-4 w-4" /> Jugar otra ronda
          </Button>
          <Button variant="secondary" onClick={resetToMenu}>
            <ArrowLeft className="h-4 w-4" /> Elegir otro juego
          </Button>
        </div>
      </section>
    );
  }

  if (mode === "match") {
    return (
      <div className="space-y-4">
        <div className="app-glass flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={resetToMenu} aria-label="Cambiar juego">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-white/30">
                Minijuego
              </p>
              <h2 className="text-[18px] font-semibold text-slate-800 dark:text-white/90">
                Unir conceptos
              </h2>
            </div>
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-white/40">
            {matched.length} / {matchPairs.length} parejas
          </span>
        </div>

        <section className="app-glass rounded-3xl p-4 sm:p-5">
          <p className="text-[11px] text-slate-500 dark:text-white/40">
            Toca un concepto y después su definición. Las parejas correctas se
            quedan en verde.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                Conceptos
              </p>
              {matchPairs.map((pair) => {
                const isMatched = matched.includes(pair.id);
                const isSelected =
                  selected?.id === pair.id && selected.side === "front";
                return (
                  <button
                    key={pair.id}
                    type="button"
                    disabled={isMatched}
                    onClick={() => chooseMatch(pair.id, "front")}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left text-[12px] font-medium leading-4 transition-colors",
                      isMatched
                        ? "border-[#34C759]/35 bg-[#34C759]/10 text-[#1a7f3a] dark:text-[#7ee69a]"
                        : isSelected
                          ? "border-[#0066FF]/45 bg-[#0066FF]/10 text-[#0055d4] dark:text-[#a9ccff]"
                          : "border-slate-300/40 bg-slate-100/55 hover:border-[#0066FF]/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/80",
                    )}
                  >
                    {isMatched ? <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" /> : null}
                    {truncate(pair.front)}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                Definiciones
              </p>
              {matchAnswers.map((pair) => {
                const isMatched = matched.includes(pair.id);
                const isSelected =
                  selected?.id === pair.id && selected.side === "back";
                return (
                  <button
                    key={`answer-${pair.id}`}
                    type="button"
                    disabled={isMatched}
                    onClick={() => chooseMatch(pair.id, "back")}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left text-[12px] leading-4 transition-colors",
                      isMatched
                        ? "border-[#34C759]/35 bg-[#34C759]/10 text-[#1a7f3a] dark:text-[#7ee69a]"
                        : isSelected
                          ? "border-[#0066FF]/45 bg-[#0066FF]/10 text-[#0055d4] dark:text-[#a9ccff]"
                          : "border-slate-300/40 bg-slate-100/55 hover:border-[#0066FF]/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/80",
                    )}
                  >
                    {isMatched ? <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" /> : null}
                    {truncate(pair.back, 96)}
                  </button>
                );
              })}
            </div>
          </div>
          {feedback === "wrong" ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-300">
              <XCircle className="h-3.5 w-3.5" /> Esa definición no corresponde. Prueba otra.
            </p>
          ) : null}
          {feedback === "correct" ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-[#1a7f3a] dark:text-[#7ee69a]">
              <CheckCircle2 className="h-3.5 w-3.5" /> ¡Pareja encontrada!
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  if (mode === "cloze" && currentCloze) {
    return (
      <div className="space-y-4">
        <div className="app-glass flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={resetToMenu} aria-label="Cambiar juego">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-white/30">
                Minijuego
              </p>
              <h2 className="text-[18px] font-semibold text-slate-800 dark:text-white/90">
                Rellenar huecos
              </h2>
            </div>
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-white/40">
            {round + 1} / {cloze.length} · {score} aciertos
          </span>
        </div>

        <section className="app-glass rounded-3xl p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0066FF] dark:text-[#8ab9ff]">
            Concepto
          </p>
          <h3 className="mt-2 text-[19px] font-semibold leading-relaxed tracking-[-0.02em] text-slate-800 dark:text-white/90">
            {currentCloze.card.front}
          </h3>
          <p className="mt-4 text-[13px] leading-6 text-slate-600 dark:text-white/60">
            {currentCloze.prompt}
          </p>
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (feedback) nextCloze();
              else checkCloze();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={Boolean(feedback)}
              placeholder="Escribe la palabra que falta"
              aria-label="Palabra que falta"
              className="h-10 min-w-[200px] flex-1 rounded-xl border border-slate-300/40 bg-slate-100/65 px-3 text-[13px] text-slate-800 shadow-inner backdrop-blur-xl outline-none focus:border-[#0066FF] disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.055] dark:text-white/90"
            />
            <Button type="submit" disabled={!feedback && !input.trim()}>
              {feedback ? "Siguiente" : "Comprobar"}
            </Button>
          </form>
          {feedback ? (
            <div
              className={cn(
                "mt-3 rounded-xl border px-3 py-2 text-[11.5px]",
                feedback === "correct"
                  ? "border-[#34C759]/30 bg-[#34C759]/10 text-[#1a7f3a] dark:text-[#7ee69a]"
                  : "border-amber-300/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
              )}
            >
              {feedback === "correct"
                ? "¡Correcto! La palabra encaja."
                : `La respuesta era «${currentCloze.answer}».`}
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (mode === "quiz" && currentQuiz) {
    return (
      <div className="space-y-4">
        <div className="app-glass flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={resetToMenu} aria-label="Cambiar juego">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-white/30">
                Minijuego
              </p>
              <h2 className="text-[18px] font-semibold text-slate-800 dark:text-white/90">
                Quiz relámpago
              </h2>
            </div>
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-white/40">
            {round + 1} / {quiz.length} · {score} aciertos
          </span>
        </div>

        <section className="app-glass rounded-3xl p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0066FF] dark:text-[#8ab9ff]">
            Pregunta
          </p>
          <h3 className="mt-2 text-[20px] font-semibold leading-relaxed tracking-[-0.02em] text-slate-800 dark:text-white/90">
            {currentQuiz.card.front}
          </h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {currentQuiz.options.map((option, index) => {
              const isCorrect = index === currentQuiz.answer;
              const isPicked = picked === index;
              return (
                <button
                  key={`${option}-${index}`}
                  type="button"
                  disabled={Boolean(feedback)}
                  onClick={() => answerQuiz(index)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left text-[12.5px] leading-5 transition-colors",
                    feedback && isCorrect
                      ? "border-[#34C759]/40 bg-[#34C759]/10 text-[#1a7f3a] dark:text-[#7ee69a]"
                      : feedback && isPicked
                        ? "border-rose-300/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                        : "border-slate-300/40 bg-slate-100/55 text-slate-700 hover:border-[#0066FF]/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/75",
                  )}
                >
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[9px]">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
          {feedback ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/[0.04] px-3 py-2 dark:bg-white/[0.05]">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[11.5px] font-medium",
                  feedback === "correct"
                    ? "text-[#1a7f3a] dark:text-[#7ee69a]"
                    : "text-rose-600 dark:text-rose-300",
                )}
              >
                {feedback === "correct" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {feedback === "correct"
                  ? "¡Correcto!"
                  : `La respuesta era «${currentQuiz.card.back.trim()}».`}
              </span>
              <Button size="sm" onClick={nextQuiz}>
                {round + 1 >= quiz.length ? "Ver resultado" : "Siguiente"}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="app-glass rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#8ab9ff]/10 dark:text-[#8ab9ff]">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
              Aprender jugando
            </p>
            <h2 className="mt-0.5 text-[22px] font-semibold tracking-[-0.035em] text-slate-800 dark:text-white/90">
              Minijuegos de estudio
            </h2>
            <p className="mt-1 max-w-xl text-[12px] leading-5 text-slate-500 dark:text-white/40">
              Tus {playableCards.length} tarjetas se convierten en retos rápidos.
              Cada ronda completada suma EXP y acerca la siguiente recompensa.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        {GAME_MODES.map((game) => {
          const Icon = game.icon;
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => startGame(game.id)}
              className="group app-glass rounded-3xl p-5 text-left transition-transform hover:-translate-y-0.5"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-lg"
                style={{ backgroundColor: game.accent }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-[15px] font-semibold text-slate-800 dark:text-white/90">
                {game.title}
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-white/40">
                {game.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#0066FF] dark:text-[#8ab9ff]">
                Jugar ahora <ArrowLeft className="h-3 w-3 rotate-180 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-[#0066FF]/15 bg-[#0066FF]/[0.04] px-3 py-2 text-[10.5px] text-slate-500 dark:border-[#8ab9ff]/15 dark:bg-[#8ab9ff]/[0.05] dark:text-white/40">
        <Brain className="h-3.5 w-3.5 shrink-0 text-[#0066FF] dark:text-[#8ab9ff]" />
        Las preguntas se generan al momento desde tus tarjetas; no se envían a ningún servicio externo.
      </div>
    </div>
  );
}
