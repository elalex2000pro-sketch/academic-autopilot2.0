"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Brain,
  CalendarClock,
  CalendarRange,
  BellRing,
  Headphones,
  ListTodo,
  NotebookPen,
  Sparkles,
  Target,
  Timer,
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
import { formatMinutes } from "@/lib/utils";

const FEATURES = [
  {
    href: "/library",
    icon: BookOpen,
    tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    title: "Biblioteca de libros completos",
    description:
      "Sube libros enteros, continúa donde lo dejaste, pregunta con citas y escucha un resumen en voz alta.",
  },
  {
    href: "/studio",
    icon: Wand2,
    tone: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
    title: "Resúmenes, infografías y mapas mentales",
    description:
      "Sube un PDF, Word o Excel y conviértelo en un resumen, una infografía o un mapa mental listo para estudiar.",
  },
  {
    href: "/notebooks",
    icon: NotebookPen,
    tone: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
    title: "Cuadernos con autoguardado",
    description:
      "Elige plantilla, escribe apuntes y comparte el cuaderno con tu clase en solo lectura o para editar entre todos.",
  },
  {
    href: "/classes",
    icon: Users,
    tone: "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400",
    title: "Clases compartidas",
    description:
      "Únete con un código permanente: chat, archivos y un calendario común donde los exámenes se ven en rojo para todos.",
  },
  {
    href: "/calendar",
    icon: CalendarRange,
    tone: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    title: "Calendario y entregas",
    description:
      "Ve tus tareas en el calendario, marca exámenes en tus clases y exporta todo a Excel cuando lo necesites.",
  },
  {
    href: "/assistant",
    icon: Sparkles,
    tone: "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400",
    title: "Asistente IA multi-modelo",
    description:
      "Conecta Gemini, ChatGPT, Claude u OpenRouter, pídele que organice tus tareas y transporta tus chats entre dispositivos.",
  },
  {
    href: "/focus",
    icon: Target,
    tone: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
    title: "Modo Enfoque",
    description:
      "Pomodoro de 25/5 con estadísticas, rachas de estudio y el plan del día en una sola pantalla.",
  },
  {
    href: "/review",
    icon: Brain,
    tone: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
    title: "Flashcards y exámenes",
    description:
      "Genera tarjetas desde tus cuadernos con repaso espaciado SM-2 y exámenes tipo test corregidos al instante.",
  },
  {
    href: "/transcribe",
    icon: AudioLines,
    tone: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
    title: "Transcribir clases",
    description:
      "Sube la grabación de una clase y guarda el texto como cuaderno para resumirlo o repasarlo.",
  },
  {
    href: "/settings",
    icon: BellRing,
    tone: "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400",
    title: "Recordatorios por Telegram",
    description:
      "Recibe cada día tus tareas próximas y los exámenes de tus clases directamente en el móvil.",
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

  const name = user?.full_name?.trim() || user?.email.split("@")[0] || "estudiante";
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

  const stats = [
    {
      icon: ListTodo,
      label: "Pendientes",
      value: String(tasks.length),
      tone: "text-[#007AFF] dark:text-[#0A84FF]",
    },
    {
      icon: CalendarClock,
      label: "Bloques hoy",
      value: String(agenda?.items.length ?? 0),
      tone: "text-[#AF52DE] dark:text-[#BF5AF2]",
    },
    {
      icon: Timer,
      label: "Planificado",
      value: formatMinutes(agenda?.total_minutes ?? 0),
      tone: "text-[#34C759] dark:text-[#30D158]",
    },
    {
      icon: BookOpen,
      label: "Leyendo",
      value: String(readingBooks),
      tone: "text-[#FF9500] dark:text-[#FF9F0A]",
    },
  ];

  return (
    <div className="relative isolate mx-auto max-w-[1680px] px-5 pb-16 pt-6 sm:px-8 lg:pb-20 lg:pt-8">
      {/* ---- Barra superior ---- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-muted-foreground">{today}</p>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/calendar">
            <CalendarRange className="h-4 w-4" /> Calendario
          </Link>
        </Button>
      </div>

      {/* ---- Hero de cristal ---- */}
      <section
        data-spotlight
        className="glass-strong lift relative overflow-hidden p-6 sm:p-8"
      >
        <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/45 px-2.5 py-1 text-[11px] font-medium text-foreground/80 dark:border-white/10 dark:bg-white/[0.06]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  tasks.length > 0 ? "bg-[#34C759]" : "bg-[#8E8E93]"
                }`}
              />
              {loading
                ? "Preparando tu plan…"
                : tasks.length > 0
                  ? "Plan al día"
                  : "Sin tareas urgentes"}
            </span>

            <h1 className="mt-3 text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[38px]">
              Hola, {name}
            </h1>
            <p className="mt-2 max-w-lg text-[13.5px] leading-6 text-muted-foreground">
              {tasks.length > 0
                ? `Tienes ${tasks.length} tarea${tasks.length === 1 ? "" : "s"} pendiente${
                    tasks.length === 1 ? "" : "s"
                  }. Tu plan de hoy ya está repartido en huecos.`
                : "No tienes tareas pendientes. Buen momento para adelantar apuntes o crear un cuaderno nuevo."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/focus">
                  <Target className="h-4 w-4" /> Empezar a estudiar
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/studio">
                  <Wand2 className="h-4 w-4" /> Crear con IA
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid w-full shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4 xl:w-[500px]">
            {stats.map(({ icon: Icon, label, value, tone }) => (
              <div key={label} className="glass-inset rounded-xl px-3 py-3">
                <Icon className={`h-3.5 w-3.5 ${tone}`} strokeWidth={2} />
                <p className="mt-2 truncate text-[16px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[18px]">
                  {value}
                </p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Continuar leyendo + impulso ---- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {continueBook ? (
          <div
            data-spotlight
            className="glass-card flex h-full flex-col justify-center p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
                <p className="label-caps">Continuar leyendo</p>
                <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.02em]">
                  {continueBook.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {continueBook.current_section_title ||
                    `Sección ${continueBook.current_section_index + 1}`}{" "}
                  · {Math.round(continueBook.progress_percent)}% leído
                  {readingBooks > 1 ? ` · ${readingBooks} libros en curso` : ""}
                </p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#007AFF] dark:bg-[#0A84FF]"
                    style={{ width: `${Math.max(2, continueBook.progress_percent)}%` }}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/library/${continueBook.id}`}>
                      Seguir leyendo <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/library">
                      <BookOpen className="h-4 w-4" /> Biblioteca
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div data-spotlight className="glass-card flex h-full flex-col p-5 sm:p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <BookOpen className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <h2 className="mt-3 text-[15px] font-semibold tracking-[-0.01em]">
              {books.length > 0 ? "Elige tu próximo libro" : "Tu biblioteca te está esperando"}
            </h2>
            <p className="mt-1 max-w-lg text-[13px] leading-5 text-muted-foreground">
              {books.length > 0
                ? "Tienes libros preparados. Abre uno y el progreso quedará guardado para la próxima vez."
                : "Sube un PDF, EPUB, DOCX, TXT o Markdown. Guardaremos el texto completo para que puedas leerlo, preguntar y escuchar un resumen."}
            </p>
            <div className="mt-auto pt-4">
              <Button asChild size="sm">
                <Link href="/library">
                  <BookOpen className="h-4 w-4" />
                  {books.length > 0 ? "Abrir mi biblioteca" : "Subir mi primer libro"}
                </Link>
              </Button>
            </div>
          </div>
        )}

        <div data-spotlight className="glass-card p-5 sm:p-6">
          <p className="label-caps flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#007AFF] dark:text-[#0A84FF]" /> Impulso de hoy
          </p>
          <p className="mt-2 text-[13px] leading-6 text-foreground/85">{impulse}</p>
          <div className="mt-4 space-y-1 border-t border-white/50 pt-3 dark:border-white/10">
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
                className="group flex items-start gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-foreground/[0.04]"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-foreground/[0.05] text-muted-foreground transition-colors group-hover:bg-[#007AFF]/10 group-hover:text-[#007AFF] dark:group-hover:bg-[#0A84FF]/15 dark:group-hover:text-[#0A84FF]">
                  <item.icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold">{item.title}</span>
                  <span className="block text-[11px] leading-4 text-muted-foreground">
                    {item.text}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Plan de hoy ---- */}
      <section className="mt-9">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Tu plan de hoy</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Bloques repartidos en tus huecos reales.
            </p>
          </div>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            {agenda?.items.length ?? 0} bloques · {formatMinutes(agenda?.total_minutes ?? 0)}
          </span>
        </div>
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-3">
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

          <div className="space-y-4 xl:col-span-2">
            <div className="animate-fade-up">
              <TaskList tasks={tasks} loading={loading} onComplete={handleComplete} />
            </div>
            <div className="animate-fade-up">
              <SyncStatus onSynced={load} />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Herramientas ---- */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Herramientas</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Todo lo que hace el planificador, en un clic.
            </p>
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 min-[1700px]:grid-cols-5">
          {FEATURES.slice(0, -1).map(({ href, icon: Icon, tone, title, description }) => (
            <Link
              key={href}
              href={href}
              data-spotlight
              className="lift glass-card group flex items-start gap-3 p-3.5"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${tone}`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[13px] font-semibold tracking-[-0.01em]">
                  {title}
                  <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-60" />
                </span>
                <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-muted-foreground">
                  {description}
                </span>
              </span>
            </Link>
          ))}

          {FEATURES.slice(-1).map(({ href, icon: Icon, tone, title, description }) => (
            <Link
              key={href}
              href={href}
              data-spotlight
              className="lift glass-card group flex items-center gap-3.5 p-4 sm:col-span-2 lg:col-span-3 min-[1700px]:hidden"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${tone}`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold tracking-[-0.01em]">{title}</span>
                <span className="mt-0.5 line-clamp-1 text-[11.5px] leading-4 text-muted-foreground">
                  {description}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary">
                Abrir
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}

          {/* En pantallas anchas la décima tarjeta completa la fila de cinco. */}
          {FEATURES.slice(-1).map(({ href, icon: Icon, tone, title, description }) => (
            <Link
              key={`${href}-wide`}
              href={href}
              data-spotlight
              className="lift glass-card group hidden items-start gap-3 p-3.5 min-[1700px]:flex"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${tone}`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[13px] font-semibold tracking-[-0.01em]">
                  {title}
                  <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-60" />
                </span>
                <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-muted-foreground">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
