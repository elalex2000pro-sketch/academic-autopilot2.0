"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Brain,
  CalendarRange,
  BellRing,
  Headphones,
  NotebookPen,
  Sparkles,
  Target,
  Users,
  Wand2,
} from "lucide-react";

import { DailyFocus } from "@/components/daily-focus";
import { SchedulePlanner } from "@/components/schedule-planner";
import { SyncStatus } from "@/components/sync-status";
import { TaskList } from "@/components/task-list";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/components/realtime-provider";
import { api } from "@/lib/api";
import type { Book, DailyAgenda, OptimizedPlan, Task } from "@/lib/types";

const FEATURES = [
  {
    href: "/library",
    icon: BookOpen,
    title: "Biblioteca de libros completos",
    description:
      "Sube libros enteros, continúa donde lo dejaste, pregunta con citas y escucha un resumen en voz alta.",
    tint: "from-blue-500 to-indigo-500",
  },
  {
    href: "/studio",
    icon: Wand2,
    title: "Resúmenes, infografías y mapas mentales",
    description:
      "Sube un PDF, Word o Excel y conviértelo en un resumen, una infografía o un mapa mental listo para estudiar.",
    tint: "from-indigo-500 to-violet-500",
  },
  {
    href: "/notebooks",
    icon: NotebookPen,
    title: "Cuadernos con autoguardado",
    description:
      "Elige plantilla, escribe apuntes y comparte el cuaderno con tu clase en solo lectura o para editar entre todos.",
    tint: "from-sky-500 to-cyan-500",
  },
  {
    href: "/classes",
    icon: Users,
    title: "Clases compartidas",
    description:
      "Únete con un código permanente: chat, archivos y un calendario común donde los exámenes se ven en rojo para todos.",
    tint: "from-emerald-500 to-teal-500",
  },
  {
    href: "/calendar",
    icon: CalendarRange,
    title: "Calendario y entregas",
    description:
      "Ve tus tareas en el calendario, marca exámenes en tus clases y exporta todo a Excel cuando lo necesites.",
    tint: "from-amber-500 to-orange-500",
  },
  {
    href: "/assistant",
    icon: Sparkles,
    title: "Asistente IA multi-modelo",
    description:
      "Conecta Gemini, ChatGPT, Claude u OpenRouter, pídele que organice tus tareas y transporta tus chats entre dispositivos.",
    tint: "from-fuchsia-500 to-pink-500",
  },
  {
    href: "/focus",
    icon: Target,
    title: "Modo Enfoque",
    description:
      "Pomodoro de 25/5 con estadísticas, rachas de estudio y el plan del día en una sola pantalla.",
    tint: "from-rose-500 to-red-500",
  },
  {
    href: "/review",
    icon: Brain,
    title: "Flashcards y exámenes",
    description:
      "Genera tarjetas desde tus cuadernos con repaso espaciado SM-2 y exámenes tipo test corregidos al instante.",
    tint: "from-violet-500 to-purple-500",
  },
  {
    href: "/transcribe",
    icon: AudioLines,
    title: "Transcribir clases",
    description:
      "Sube la grabación de una clase y guarda el texto como cuaderno para resumirlo o repasarlo.",
    tint: "from-cyan-500 to-blue-500",
  },
  {
    href: "/settings",
    icon: BellRing,
    title: "Recordatorios por Telegram",
    description:
      "Recibe cada día tus tareas próximas y los exámenes de tus clases directamente en el móvil.",
    tint: "from-teal-500 to-emerald-500",
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<OptimizedPlan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agenda, setAgenda] = useState<DailyAgenda | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [optimized, pending, today, library] = await Promise.all([
        api.optimizedPlan(),
        api.tasks({ status: "pending" }),
        api.today(),
        api.books().catch(() => []),
      ]);
      setPlan(optimized);
      setTasks(pending);
      setAgenda(today);
      setBooks(library);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime((event) => {
    if (event.event === "tasks" || event.event === "schedule") {
      load();
    }
  });

  const handleComplete = useCallback(
    async (id: string) => {
      await api.completeTask(id);
      await load();
    },
    [load],
  );

  const name = user?.full_name?.trim() || user?.email.split("@")[0] || "";
  const rawDate = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const today = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const continueBook =
    books
      .filter((book) => book.status === "ready" && book.last_opened_at)
      .sort((a, b) => {
        const aTime = a.last_opened_at ? Date.parse(a.last_opened_at) : 0;
        const bTime = b.last_opened_at ? Date.parse(b.last_opened_at) : 0;
        return bTime - aTime;
      })[0] ?? null;
  const readingBooks = books.filter(
    (book) => book.status === "ready" && book.progress_percent > 0 && book.progress_percent < 99,
  ).length;
  const impulse = continueBook
    ? `Dedica 15 minutos a “${continueBook.title}”. El lector te devolverá a ${
        continueBook.current_section_title || `la sección ${continueBook.current_section_index + 1}`
      }.`
    : tasks.length > 0
      ? "Empieza por la tarea más pequeña: reducir la lista también es avanzar. Después, abre un libro quince minutos."
      : "No hay tareas urgentes. Buen momento para subir ese libro que llevas tiempo queriendo leer o repasar un cuaderno.";

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-6">
      {/* ---- Bienvenida ---- */}
      <section className="animate-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-indigo-500/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
        <p className="text-sm text-white/75">{today}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Hola, {name} 👋
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          {tasks.length > 0
            ? `Tienes ${tasks.length} tarea${tasks.length === 1 ? "" : "s"} pendiente${tasks.length === 1 ? "" : "s"}. Tu copiloto ya preparó el plan de hoy.`
            : "No tienes tareas pendientes. Buen momento para adelantar apuntes o crear un cuaderno nuevo."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/focus"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition-transform hover:scale-[1.03]"
          >
            <Target className="h-4 w-4" /> Empezar a estudiar
          </Link>
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40 transition-colors hover:bg-white/25"
          >
            <Wand2 className="h-4 w-4" /> Crear con IA
          </Link>
        </div>
      </section>

      {/* ---- Continuar leyendo + impulso diario ---- */}
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {continueBook ? (
          <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-indigo-100/70 blur-2xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                className="flex h-32 w-24 shrink-0 flex-col justify-between rounded-xl p-3 text-white shadow-md"
                style={{
                  background: `linear-gradient(150deg, ${continueBook.cover_color}, #0f172a)`,
                }}
              >
                <BookOpen className="h-5 w-5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                  {continueBook.format}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600">
                  Continuar leyendo
                </p>
                <h2 className="mt-1 truncate text-xl font-bold">{continueBook.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {continueBook.current_section_title ||
                    `Sección ${continueBook.current_section_index + 1}`}{" "}
                  · {Math.round(continueBook.progress_percent)}% leído
                  {readingBooks > 1 ? ` · ${readingBooks} libros en curso` : ""}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.max(2, continueBook.progress_percent)}%` }}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/library/${continueBook.id}`}>
                    <Button size="sm">
                      Seguir leyendo <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/library">
                    <Button size="sm" variant="secondary">
                      <BookOpen className="h-4 w-4" /> Biblioteca
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-indigo-200 bg-gradient-to-br from-white to-indigo-50/60 p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
              <BookOpen className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-lg font-bold">
              {books.length > 0 ? "Elige tu próximo libro" : "Tu biblioteca te está esperando"}
            </h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              {books.length > 0
                ? "Tienes libros preparados. Abre uno y el progreso quedará guardado para la próxima vez."
                : "Sube un PDF, EPUB, DOCX, TXT o Markdown. Guardaremos el texto completo para que puedas leerlo, preguntar y escuchar un resumen."}
            </p>
            <Link href="/library" className="mt-4 inline-block">
              <Button size="sm">
                <BookOpen className="h-4 w-4" />
                {books.length > 0 ? "Abrir mi biblioteca" : "Subir mi primer libro"}
              </Button>
            </Link>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">
            <Sparkles className="h-3.5 w-3.5" /> Impulso de hoy
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{impulse}</p>
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            {[
              {
                href: "/library",
                icon: BookOpen,
                title: "Leer 15 minutos",
                text: "Abre un libro y continúa donde lo dejaste.",
              },
              {
                href: "/notebooks",
                icon: NotebookPen,
                title: "Preguntar a tus fuentes",
                text: "Añade un libro o archivo a un cuaderno.",
              },
              {
                href: "/library",
                icon: Headphones,
                title: "Escuchar un resumen",
                text: "Repasa con la voz de tu navegador.",
              },
            ].map((item) => (
              <Link
                key={`${item.href}-${item.title}`}
                href={item.href}
                className="group flex items-start gap-2 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-50"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                  <item.icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{item.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{item.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Qué puedes hacer ---- */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">¿Qué puedes hacer aquí?</h2>
            <p className="text-sm text-muted-foreground">
              Todo lo que tu copiloto académico hace por ti, en un clic.
            </p>
          </div>
        </div>
        <div className="stagger-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ href, icon: Icon, title, description, tint }) => (
            <Link
              key={href}
              href={href}
              className="hover-lift group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${tint} text-white shadow-md`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 flex items-center gap-1.5 text-sm font-bold">
                {title}
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Plan de hoy ---- */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold tracking-tight">Tu plan de hoy</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="animate-fade-up">
              <DailyFocus
                agenda={agenda}
                loading={loading}
                onComplete={handleComplete}
                onReplan={load}
              />
            </div>
            <div className="animate-fade-up">
              <SchedulePlanner plan={plan} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="animate-fade-up">
              <SyncStatus onSynced={load} />
            </div>
            <div className="animate-fade-up">
              <TaskList tasks={tasks} loading={loading} onComplete={handleComplete} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
