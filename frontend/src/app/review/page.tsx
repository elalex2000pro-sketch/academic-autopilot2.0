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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Flashcard, FlashcardStats, Notebook, Quiz, QuizResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "decks" | "exams";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function isDue(card: Flashcard, now = Date.now()): boolean {
  const due = new Date(card.due_at).getTime();
  return !Number.isFinite(due) || due <= now;
}

function learnedCount(cards: Flashcard[]): number {
  return cards.filter((card) => !isDue(card)).length;
}

function ReviewRing({
  value,
  total,
  label,
  color,
  size = 82,
}: {
  value: number;
  total: number;
  label: string;
  color: string;
  size?: number;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="text-slate-900/[0.07] dark:text-white/10"
            stroke="currentColor"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (percent / 100) * circumference}
            style={{ transition: "stroke-dashoffset 500ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[18px] font-semibold tabular-nums tracking-[-0.04em] text-slate-800 dark:text-white/90">
          {value}
        </span>
      </div>
      <div>
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
          {label}
        </p>
        <p className="mt-0.5 text-[12px] font-medium text-slate-600 dark:text-white/55">
          {total > 0 ? `${Math.round(percent)}% del total` : "Sin tarjetas"}
        </p>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>("decks");
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<FlashcardStats>({ total: 0, due: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [notebookList, cardList, statsData] = await Promise.all([
        api.notebooks(),
        api.flashcards(),
        api.flashcardStats(),
      ]);
      setNotebooks(notebookList);
      setCards(cardList);
      setStats(statsData);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <header className="app-glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0066FF] dark:text-[#8ab9ff]">
              Memoria a largo plazo
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-[28px] font-semibold tracking-[-0.045em] text-slate-900 dark:text-white/95">
              <Brain className="h-7 w-7 text-[#0066FF]" />
              Repaso
            </h1>
            <p className="mt-1 max-w-xl text-[12px] leading-5 text-slate-500 dark:text-white/40">
              Mazos de tarjetas con repaso espaciado. Abre un mazo, gira la tarjeta y decide cuándo
              quieres volver a verla.
            </p>
          </div>
          <div className="flex rounded-full border border-slate-300/40 bg-slate-100/60 p-0.5 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
            <button
              type="button"
              onClick={() => setTab("decks")}
              aria-pressed={tab === "decks"}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                tab === "decks"
                  ? "bg-slate-100/90 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80",
              )}
            >
              <Layers className="h-3.5 w-3.5" /> Mazos
            </button>
            <button
              type="button"
              onClick={() => setTab("exams")}
              aria-pressed={tab === "exams"}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                tab === "exams"
                  ? "bg-slate-100/90 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80",
              )}
            >
              <GraduationCap className="h-3.5 w-3.5" /> Modo examen
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-800 backdrop-blur-2xl dark:text-amber-200">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            <XCircle className="h-3.5 w-3.5 opacity-60" />
          </button>
        </div>
      )}

      {tab === "decks" ? (
        <DecksView
          notebooks={notebooks}
          cards={cards}
          stats={stats}
          loading={loading}
          busy={busy}
          setBusy={setBusy}
          notify={setNotice}
          reload={load}
        />
      ) : (
        <ExamsTab
          notebooks={notebooks}
          notify={setNotice}
          busy={busy}
          setBusy={setBusy}
        />
      )}
    </div>
  );
}

function DecksView({
  notebooks,
  cards,
  stats,
  loading,
  busy,
  setBusy,
  notify,
  reload,
}: {
  notebooks: Notebook[];
  cards: Flashcard[];
  stats: FlashcardStats;
  loading: boolean;
  busy: boolean;
  setBusy: (value: boolean) => void;
  notify: (message: string | null) => void;
  reload: (silent?: boolean) => Promise<void>;
}) {
  const [activeDeck, setActiveDeck] = useState<string | null>(null);
  const [dueOnly, setDueOnly] = useState(true);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [generateNotebook, setGenerateNotebook] = useState(notebooks[0]?.id ?? "");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!generateNotebook && notebooks[0]) setGenerateNotebook(notebooks[0].id);
  }, [generateNotebook, notebooks]);

  const decks = useMemo(() => {
    const list = [
      {
        id: "all",
        name: "Todos los mazos",
        color: "#0066FF",
        cards,
      },
      ...notebooks.map((notebook) => ({
        id: notebook.id,
        name: notebook.title,
        color: notebook.color || "#AF52DE",
        cards: cards.filter((card) => card.notebook_id === notebook.id),
      })),
    ];
    const withoutNotebook = cards.filter((card) => !card.notebook_id);
    if (withoutNotebook.length > 0) {
      list.push({
        id: "none",
        name: "Sin cuaderno",
        color: "#8E8E93",
        cards: withoutNotebook,
      });
    }
    return list;
  }, [cards, notebooks]);

  const activeDeckData = decks.find((deck) => deck.id === activeDeck) ?? null;

  const learned = Math.max(0, stats.total - stats.due);
  const duePercent = stats.total > 0 ? (stats.due / stats.total) * 100 : 0;

  function openDeck(deckId: string, onlyDue = dueOnly) {
    const deck = decks.find((item) => item.id === deckId);
    if (!deck) return;
    const source = onlyDue ? deck.cards.filter((card) => isDue(card)) : deck.cards;
    setActiveDeck(deckId);
    setDueOnly(onlyDue);
    setQueue(source);
    setIndex(0);
    setFlipped(false);
  }

  function changeDueOnly(value: boolean) {
    if (!activeDeck) return;
    openDeck(activeDeck, value);
  }

  async function review(quality: number) {
    const current = queue[index];
    if (!current || sessionBusy) return;
    setSessionBusy(true);
    try {
      const result = await api.reviewFlashcard(current.id, quality);
      setQueue((previous) => {
        const next = previous.map((card) => (card.id === current.id ? result.card : card));
        return quality < 3 ? [...next, result.card] : next;
      });
      setFlipped(false);
      setIndex((value) => value + 1);
      const updatedStats = await api.flashcardStats();
      notify(null);
      await reload(true);
      if (updatedStats.total === 0) setActiveDeck(null);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setSessionBusy(false);
    }
  }

  async function removeCard(id: string) {
    if (!window.confirm("¿Eliminar esta tarjeta?")) return;
    try {
      await api.deleteFlashcard(id);
      setQueue((previous) => previous.filter((card) => card.id !== id));
      await reload(true);
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  async function generate() {
    if (!generateNotebook) {
      notify("Primero crea un cuaderno con apuntes.");
      return;
    }
    setBusy(true);
    notify(null);
    try {
      const result = await api.generateFlashcards(generateNotebook);
      notify(
        `${result.created} tarjetas creadas${
          result.source === "heuristic" ? " (modo local, sin IA)" : " con IA"
        }.`,
      );
      await reload(true);
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
    setAdding(true);
    try {
      await api.createFlashcard({
        front: front.trim(),
        back: back.trim(),
        notebook_id: generateNotebook || null,
      });
      setFront("");
      setBack("");
      notify("Tarjeta añadida.");
      await reload(true);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  if (activeDeckData) {
    const current = queue[index] ?? null;
    const progress = queue.length > 0 ? Math.round((index / queue.length) * 100) : 0;
    return (
      <div className="space-y-4">
        <section className="app-glass rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveDeck(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100/70 dark:text-white/50 dark:hover:bg-white/10"
                aria-label="Volver a los mazos"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                  Sesión de repaso
                </p>
                <h2 className="truncate text-[19px] font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/90">
                  {activeDeckData.name}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-slate-300/40 bg-slate-100/60 p-0.5 dark:border-white/10 dark:bg-white/[0.06]">
                <button
                  type="button"
                  onClick={() => changeDueOnly(true)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    dueOnly
                      ? "bg-slate-100/90 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                      : "text-slate-500 dark:text-white/45",
                  )}
                >
                  Pendientes
                </button>
                <button
                  type="button"
                  onClick={() => changeDueOnly(false)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    !dueOnly
                      ? "bg-slate-100/90 text-slate-800 shadow-sm dark:bg-white/15 dark:text-white"
                      : "text-slate-500 dark:text-white/45",
                  )}
                >
                  Todas
                </button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openDeck(activeDeckData.id)} aria-label="Reiniciar sesión">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0066FF] to-[#AF52DE] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-slate-400 dark:text-white/30">
              {Math.min(index, queue.length)} / {queue.length}
            </span>
          </div>
        </section>

        {queue.length === 0 ? (
          <section className="app-glass rounded-3xl p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#34C759]" />
            <h3 className="mt-3 text-[18px] font-semibold text-slate-800 dark:text-white/90">
              {dueOnly ? "No quedan tarjetas pendientes" : "Este mazo está vacío"}
            </h3>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-white/40">
              {dueOnly
                ? "Cambia a «Todas» para repasar también las que ya están aprendidas."
                : "Genera tarjetas desde un cuaderno o añade una manualmente."}
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => setActiveDeck(null)}>
              <ArrowLeft className="h-4 w-4" /> Volver a los mazos
            </Button>
          </section>
        ) : index >= queue.length ? (
          <section className="app-glass rounded-3xl p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#34C759]/12 text-[#34C759]">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-slate-800 dark:text-white/90">
              Sesión completada
            </h3>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-white/40">
              Has repasado {queue.length} tarjeta{queue.length === 1 ? "" : "s"}. El repaso espaciado
              volverá a traerlas en el momento adecuado.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => openDeck(activeDeckData.id)}>
                <RotateCcw className="h-4 w-4" /> Repetir
              </Button>
              <Button onClick={() => setActiveDeck(null)}>Volver a los mazos</Button>
            </div>
          </section>
        ) : current ? (
          <section className="app-glass rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary" className="rounded-full text-[10px]">
                Tarjeta {index + 1} de {queue.length}
              </Badge>
              <button
                type="button"
                onClick={() => void removeCard(current.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 dark:text-white/30"
                aria-label="Eliminar tarjeta actual"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mx-auto mt-4 max-w-2xl [perspective:1400px]">
              <button
                type="button"
                onClick={() => setFlipped((value) => !value)}
                className="group relative min-h-[250px] w-full rounded-3xl text-left transition-transform duration-500 [transform-style:preserve-3d] sm:min-h-[290px]"
                style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                aria-label={flipped ? "Ver pregunta" : "Ver respuesta"}
              >
                <span className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-slate-300/40 bg-slate-100/70 p-6 text-center shadow-[0_28px_70px_-35px_rgba(32,39,48,0.35)] backdrop-blur-3xl [backface-visibility:hidden] dark:border-white/10 dark:bg-white/[0.08]">
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                    Pregunta
                  </span>
                  <span className="mt-4 whitespace-pre-wrap text-[20px] font-semibold leading-relaxed tracking-[-0.02em] text-slate-800 dark:text-white/90 sm:text-[24px]">
                    {current.front}
                  </span>
                  <span className="mt-5 text-[10.5px] text-slate-400 dark:text-white/30">
                    Toca para girar la tarjeta
                  </span>
                </span>
                <span className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-[#0066FF]/25 bg-[#0066FF]/[0.08] p-6 text-center shadow-[0_28px_70px_-35px_rgba(0,102,255,0.7)] backdrop-blur-3xl [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-[#0066FF]/30 dark:bg-[#0066FF]/15">
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#0066FF] dark:text-[#8ab9ff]">
                    Respuesta
                  </span>
                  <span className="mt-4 whitespace-pre-wrap text-[18px] font-medium leading-relaxed text-slate-800 dark:text-white/90 sm:text-[22px]">
                    {current.back}
                  </span>
                  <span className="mt-5 text-[10.5px] text-slate-500 dark:text-white/35">
                    ¿La recordabas?
                  </span>
                </span>
              </button>
            </div>

            {flipped && (
              <div className="mx-auto mt-5 grid max-w-2xl grid-cols-2 gap-2 md:grid-cols-4">
                <Button variant="secondary" onClick={() => void review(1)} disabled={sessionBusy}>
                  Otra vez
                </Button>
                <Button variant="secondary" onClick={() => void review(3)} disabled={sessionBusy}>
                  Difícil
                </Button>
                <Button onClick={() => void review(4)} disabled={sessionBusy}>
                  Bien
                </Button>
                <Button variant="secondary" onClick={() => void review(5)} disabled={sessionBusy}>
                  Fácil
                </Button>
              </div>
            )}
            <p className="mt-4 text-center text-[10.5px] text-slate-400 dark:text-white/30">
              SM-2 calcula la próxima fecha según tu respuesta. No hay que memorizar el calendario.
            </p>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="app-glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
              Tu progreso
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-slate-900 dark:text-white/90">
              {stats.total} tarjeta{stats.total === 1 ? "" : "s"} en total
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <ReviewRing value={learned} total={stats.total} label="Aprendidas" color="#34C759" />
            <ReviewRing value={stats.due} total={stats.total} label="Para repasar" color="#FF9500" />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#34C759] to-[#0066FF] transition-all duration-500"
            style={{ width: `${100 - duePercent}%` }}
          />
        </div>
      </section>

      <section className="app-glass rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
              Mazos
            </p>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-800 dark:text-white/90">
              Elige un mazo para empezar
            </h2>
          </div>
          <span className="text-[10.5px] text-slate-400 dark:text-white/30">
            {decks.length} mazo{decks.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-3xl border border-slate-300/40 bg-slate-200/45 dark:border-white/5 dark:bg-white/[0.03]" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => {
              const deckDue = deck.cards.filter((card) => isDue(card)).length;
              const deckLearned = learnedCount(deck.cards);
              const percent = deck.cards.length > 0 ? (deckLearned / deck.cards.length) * 100 : 0;
              return (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => openDeck(deck.id)}
                  className="group relative overflow-hidden rounded-3xl border border-slate-300/40 bg-slate-100/60 p-4 text-left shadow-[0_18px_45px_-32px_rgba(32,39,48,0.3)] backdrop-blur-3xl transition-all duration-200 ease-mac hover:-translate-y-0.5 hover:border-white/80 hover:bg-white/45 dark:border-white/10 dark:bg-black/25 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                >
                  <span
                    className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl"
                    style={{ backgroundColor: deck.color }}
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-lg"
                      style={{ background: `linear-gradient(145deg, ${deck.color}, ${deck.color}aa)` }}
                    >
                      <Layers className="h-4 w-4" />
                    </span>
                    <span className="rounded-full border border-slate-300/40 bg-slate-100/60 px-2 py-1 text-[9.5px] font-medium text-slate-500 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white/45">
                      {deck.cards.length} tarjeta{deck.cards.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="relative mt-4 line-clamp-2 text-[15px] font-semibold leading-tight tracking-[-0.02em] text-slate-900 dark:text-white/90">
                    {deck.name}
                  </p>
                  <div className="relative mt-3 flex items-center justify-between gap-2 text-[10.5px]">
                    <span className="text-[#1a9e3a] dark:text-[#7ee69a]">
                      {deckLearned} aprendida{deckLearned === 1 ? "" : "s"}
                    </span>
                    <span className="text-[#c27400] dark:text-[#ffc266]">
                      {deckDue} pendiente{deckDue === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/[0.07] dark:bg-white/10">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${percent}%`, backgroundColor: deck.color }}
                    />
                  </div>
                  <span className="relative mt-3 flex items-center justify-end text-[10px] font-semibold text-[#0066FF] dark:text-[#8ab9ff]">
                    Abrir mazo
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="app-glass rounded-3xl p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-white/85">
            <Sparkles className="h-4 w-4 text-[#AF52DE]" /> Generar desde un cuaderno
          </h2>
          <p className="mt-1 text-[10.5px] leading-4 text-slate-500 dark:text-white/35">
            La IA crea las tarjetas; si no hay modelo configurado, se extraen del texto del cuaderno.
          </p>
          <div className="mt-3 flex gap-2">
            <select
              value={generateNotebook}
              onChange={(event) => setGenerateNotebook(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-xl border border-slate-300/40 bg-slate-100/65 px-3 text-[12px] text-slate-800 shadow-inner backdrop-blur-xl outline-none focus:border-[#0066FF] dark:border-white/10 dark:bg-white/[0.055] dark:text-white/90"
              aria-label="Cuaderno de origen"
            >
              <option value="">Selecciona un cuaderno</option>
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.title}
                </option>
              ))}
            </select>
            <Button onClick={() => void generate()} disabled={busy || !generateNotebook} className="shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generar
            </Button>
          </div>
        </div>

        <div className="app-glass rounded-3xl p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-white/85">
            <Plus className="h-4 w-4 text-[#0066FF]" /> Añadir tarjeta manual
          </h2>
          <div className="mt-3 space-y-2">
            <Input
              value={front}
              onChange={(event) => setFront(event.target.value)}
              placeholder="Pregunta o concepto"
              aria-label="Pregunta de la tarjeta"
            />
            <textarea
              value={back}
              onChange={(event) => setBack(event.target.value)}
              placeholder="Respuesta o definición"
              className="min-h-[70px] w-full rounded-xl border border-slate-300/40 bg-slate-100/65 px-3 py-2 text-[12px] text-slate-800 shadow-inner backdrop-blur-xl outline-none placeholder:text-slate-400 focus:border-[#0066FF] dark:border-white/10 dark:bg-white/[0.055] dark:text-white/90 dark:placeholder:text-white/25"
              aria-label="Respuesta de la tarjeta"
            />
            <Button onClick={() => void addCard()} disabled={adding} className="w-full">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Añadir al mazo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Modo examen
// --------------------------------------------------------------------------- //
function ExamsTab({
  notebooks,
  notify,
  busy,
  setBusy,
}: {
  notebooks: Notebook[];
  notify: (message: string | null) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const [notebookId, setNotebookId] = useState(notebooks[0]?.id ?? "");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [active, setActive] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    if (!notebookId && notebooks[0]) setNotebookId(notebooks[0].id);
  }, [notebookId, notebooks]);

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
    <div className="space-y-4">
      <section className="app-glass rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-[12px]">
            <span className="mb-1 block font-medium text-slate-500 dark:text-white/40">
              Cuaderno para el examen
            </span>
            <select
              value={notebookId}
              onChange={(event) => setNotebookId(event.target.value)}
              className="h-9 w-full rounded-xl border border-slate-300/40 bg-slate-100/65 px-3 text-[12px] text-slate-800 shadow-inner backdrop-blur-xl outline-none focus:border-[#0066FF] dark:border-white/10 dark:bg-white/[0.055] dark:text-white/90"
            >
              <option value="">Selecciona un cuaderno</option>
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.title}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => void generate()} disabled={busy || !notebookId}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Crear examen
          </Button>
        </div>
        <p className="mt-2 text-[10.5px] text-slate-500 dark:text-white/35">
          Preguntas tipo test con cuatro opciones y explicación de cada respuesta.
        </p>
      </section>

      {active && (
        <section className="app-glass space-y-4 rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white/90">
                {active.title}
              </h2>
              <p className="text-[10.5px] text-slate-500 dark:text-white/35">
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

          <div className="space-y-3">
            {active.questions.map((question, questionIndex) => {
              const detail = result?.details[questionIndex];
              return (
                <div
                  key={questionIndex}
                  className="rounded-2xl border border-slate-300/40 bg-slate-100/60 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">
                    {questionIndex + 1}. {question.question}
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
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
                            "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12px] transition-all",
                            correct
                              ? "border-[#34C759]/40 bg-[#34C759]/10 text-[#1a7f3a] dark:text-[#7ee69a]"
                              : wrong
                                ? "border-rose-300/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                                : selected
                                  ? "border-[#0066FF]/35 bg-[#0066FF]/10 text-[#004fcc] dark:text-[#9cc4ff]"
                                  : "border-slate-300/40 bg-slate-100/50 hover:border-[#0066FF]/25 hover:bg-slate-100/70 dark:border-white/10 dark:bg-white/[0.03]",
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
                    <p className="mt-2 rounded-lg bg-slate-900/[0.04] px-3 py-2 text-[10.5px] text-slate-600 dark:bg-white/[0.05] dark:text-white/45">
                      {question.explanation}
                    </p>
                  )}
                  {result && detail === false && (
                    <p className="mt-1 text-[10.5px] font-medium text-rose-600 dark:text-rose-300">
                      Respuesta correcta: {question.options[question.answer]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!result ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10.5px] text-slate-500 dark:text-white/35">
                {answered} de {active.questions.length} respondidas
              </p>
              <Button onClick={() => void submit()} disabled={busy || answered < active.questions.length}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Corregir examen
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#0066FF]/20 bg-[#0066FF]/[0.06] p-4 text-center">
              <p className="text-[10.5px] text-slate-500 dark:text-white/35">Resultado</p>
              <p className="text-[28px] font-semibold tracking-[-0.05em] text-[#0066FF] dark:text-[#8ab9ff]">
                {result.score} / {result.total}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-white/35">
                {Math.round((result.score / Math.max(result.total, 1)) * 100)}% de aciertos
              </p>
            </div>
          )}
        </section>
      )}

      <section className="app-glass rounded-3xl p-4 sm:p-5">
        <h2 className="text-[13px] font-semibold text-slate-800 dark:text-white/85">
          Historial de exámenes
        </h2>
        <div className="mt-3 space-y-2">
          {quizzes.length === 0 && (
            <p className="py-6 text-center text-[12px] text-slate-500 dark:text-white/35">
              Todavía no has creado ningún examen.
            </p>
          )}
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-300/40 bg-slate-100/55 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#0066FF]/15 dark:text-[#8ab9ff]">
                <GraduationCap className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/80">
                  {quiz.title}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-white/35">
                  {quiz.completed_at
                    ? `Nota: ${quiz.score}/${quiz.total} · ${new Date(
                        quiz.completed_at,
                      ).toLocaleDateString("es-ES")}`
                    : "Sin completar"}
                </p>
              </div>
              {quiz.completed_at && (
                <span className="hidden items-center gap-1 text-[10.5px] font-semibold text-[#0066FF] dark:text-[#8ab9ff] sm:flex">
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
                className="rounded-lg px-2 py-1 text-[10.5px] font-medium text-[#0066FF] hover:bg-[#0066FF]/10 dark:text-[#8ab9ff]"
              >
                Abrir
              </button>
              <button
                type="button"
                onClick={() => void removeQuiz(quiz.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 dark:text-white/30"
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
