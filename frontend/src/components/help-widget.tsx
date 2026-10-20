"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, X } from "lucide-react";

interface Tutorial {
  title: string;
  steps: string[];
}

const DEFAULT_TUTORIAL: Tutorial = {
  title: "Guía rápida",
  steps: [
    "Usa el menú de la izquierda para moverte entre secciones.",
    "La burbuja ✨ de abajo a la derecha es el asistente IA: pídele que te organice.",
    "Pulsa este botón «?» en cualquier sección para ver su tutorial paso a paso.",
  ],
};

// Tutorial flotante por sección: se abre solo la primera vez que se visita cada una.
const TUTORIALS: { match: RegExp; tutorial: Tutorial }[] = [
  {
    match: /^\/classes\/.+/,
    tutorial: {
      title: "Tu clase compartida",
      steps: [
        "El chat es para todos los miembros; el propietario puede publicar anuncios fijados.",
        "En «Calendario» añade eventos y exámenes: marca «Es un examen» para resaltarlo en rojo y lo verá toda la clase al instante.",
        "En «Archivos» compartís apuntes (hasta 20 GB por archivo).",
        "El código de la clase es permanente: quien lo tenga se une para siempre.",
      ],
    },
  },
  {
    match: /^\/classes/,
    tutorial: {
      title: "Clases compartidas",
      steps: [
        "Crea una clase y comparte su código con tus compañeros.",
        "Quien tenga el código pulsa «Unirse» y entra para siempre.",
        "Dentro de la clase tenéis chat, calendario de exámenes y archivos compartidos.",
      ],
    },
  },
  {
    match: /^\/login/,
    tutorial: {
      title: "Entrar o crear tu cuenta",
      steps: [
        "Escribe tu nombre, tu email y una contraseña de 8 caracteres o más, y pulsa «Crear cuenta».",
        "La próxima vez entra con «Inicia sesión» usando el mismo email y contraseña.",
        "Si te dice que ya existe una cuenta con ese email, prueba a iniciar sesión.",
      ],
    },
  },
  {
    match: /^\/($|\?)/,
    tutorial: {
      title: "Tu panel principal",
      steps: [
        "Aquí ves el resumen del día: tareas que vencen, tu plan de estudio y tu progreso.",
        "Empieza creando tus asignaturas y subiendo tus apuntes en «Archivos».",
        "Pregunta al asistente (burbuja ✨ abajo a la derecha): te organiza la semana.",
        "Conecta Moodle o Google Classroom en «Ajustes» para importar tareas solas.",
      ],
    },
  },
  {
    match: /^\/subjects/,
    tutorial: {
      title: "Asignaturas",
      steps: [
        "Crea una asignatura por cada materia: aparecerá en tareas, archivos y notas.",
        "Si conectas Moodle o Classroom en Ajustes, se importan automáticamente.",
        "Pulsa una asignatura para ver sus tareas, apuntes y notas.",
      ],
    },
  },
  {
    match: /^\/schedule/,
    tutorial: {
      title: "Horario",
      steps: [
        "Añade tus clases de la semana: día, hora, asignatura y aula.",
        "El asistente IA usa tu horario para decirte cuándo estudiar.",
        "Define también tu disponibilidad (tardes, fines de semana) en «Ajustes».",
      ],
    },
  },
  {
    match: /^\/calendar/,
    tutorial: {
      title: "Calendario",
      steps: [
        "Vista mensual de todas tus entregas, tareas y exámenes.",
        "Pulsa un día para ver los detalles; cambia de mes con las flechas.",
        "Los exámenes de tus clases compartidas aparecen destacados.",
      ],
    },
  },
  {
    match: /^\/exams/,
    tutorial: {
      title: "Exámenes",
      steps: [
        "Añade tus exámenes con fecha, asignatura y temario.",
        "Aparecen en el calendario y el asistente los tiene en cuenta al planificar.",
        "Después puedes registrar la nota para llevar tu seguimiento.",
      ],
    },
  },
  {
    match: /^\/studio/,
    tutorial: {
      title: "IA Studio",
      steps: [
        "Sube tus apuntes (PDF, Word, Excel, PowerPoint o fotos) y elige el documento.",
        "Pulsa «Resumen», «Infografía» o «Mapa mental»: se genera un PDF en segundos.",
        "Descarga el PDF, pásalo a Word o pulsa «Canva» para editarlo con tus colores.",
      ],
    },
  },
  {
    match: /^\/notebooks/,
    tutorial: {
      title: "Cuadernos",
      steps: [
        "Pulsa «Nuevo cuaderno» y ponle un título y un color.",
        "Escribe tus apuntes: se guardan solos mientras escribes.",
        "Descarga el cuaderno en Word, o todos juntos en Excel, con un clic.",
      ],
    },
  },
  {
    match: /^\/assistant/,
    tutorial: {
      title: "Asistente IA",
      steps: [
        "Pídele lo que necesites: «organiza mi semana», «¿qué priorizo hoy?».",
        "Puede crear y editar tareas, notas, horario y asignaturas por ti.",
        "Con «Exportar» e «Importar» llevas tu conversación a otro dispositivo.",
        "Cambia la IA que responde (Gemini, ChatGPT, Claude...) en «Ajustes».",
      ],
    },
  },
  {
    match: /^\/files/,
    tutorial: {
      title: "Archivos",
      steps: [
        "Sube tus apuntes (PDF, Word, Excel, PowerPoint o imágenes) y organízalos por asignatura.",
        "Los archivos grandes se suben por trozos y se reanudan solos si se corta la conexión.",
        "Usa tus apuntes en «IA Studio» para generar resúmenes, infografías y mapas mentales.",
      ],
    },
  },
  {
    match: /^\/focus/,
    tutorial: {
      title: "Modo Enfoque",
      steps: [
        "Temporizador de estudio tipo Pomodoro: elige los minutos y dale a empezar.",
        "Al terminar, la sesión queda registrada en tu progreso.",
      ],
    },
  },
  {
    match: /^\/academics/,
    tutorial: {
      title: "Notas",
      steps: [
        "Consulta tus notas y promedios por asignatura.",
        "Añade calificaciones para llevar el seguimiento del curso.",
      ],
    },
  },
  {
    match: /^\/settings/,
    tutorial: {
      title: "Ajustes",
      steps: [
        "Conecta Moodle o Google Classroom para importar tareas automáticamente.",
        "Elige tu IA: Gemini, ChatGPT, Claude, OpenRouter o cualquier otra compatible con OpenAI.",
        "En Canva y Word/Excel tienes los botones para descargar tus tareas y cuadernos.",
        "Define tu disponibilidad semanal: el asistente planifica usándola.",
      ],
    },
  },
];

export function HelpWidget() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Se abre automáticamente la primera vez que se visita cada sección.
  useEffect(() => {
    const key = `autopilot_tutorial_${pathname}`;
    let seen = true;
    try {
      seen = window.localStorage.getItem(key) === "1";
    } catch {
      seen = true;
    }
    if (!seen) {
      setOpen(true);
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        /* sin almacenamiento disponible */
      }
    }
  }, [pathname]);

  const tutorial =
    TUTORIALS.find((entry) => entry.match.test(pathname))?.tutorial ?? DEFAULT_TUTORIAL;

  return (
    <div className="fixed bottom-5 right-24 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="animate-pop w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-indigo-500/10 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">💡 {tutorial.title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar tutorial"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
            {tutorial.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            Pulsa el botón «?» cuando quieras volver a ver este tutorial.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Ayuda y tutoriales"
        aria-label="Ayuda y tutoriales"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-110"
      >
        <CircleHelp className="h-5 w-5" />
      </button>
    </div>
  );
}
