"use client";

import { useState } from "react";
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

// Tutorial flotante por sección: solo se abre al pulsar el botón «?» (nunca
// aparece automáticamente encima del contenido).
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
        "Pulsa «Importar» y sube una foto o un PDF del horario para rellenarlo de golpe.",
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
        "Pulsa «Nuevo cuaderno» y elige una plantilla (Cornell, laboratorio, examen...).",
        "Escribe tus apuntes: se guardan solos mientras escribes.",
        "Comparte el cuaderno con una clase en solo lectura o para editar entre todos.",
        "Descarga el cuaderno en Word, o todos juntos en Excel, con un clic.",
      ],
    },
  },
  {
    match: /^\/review/,
    tutorial: {
      title: "Repaso inteligente",
      steps: [
        "Elige un cuaderno y pulsa «Generar tarjetas»: la IA crea preguntas y respuestas.",
        "Repasa: pulsa la tarjeta para ver la respuesta y valora del 1 al 5. El sistema la programará cuando estés a punto de olvidarla.",
        "En «Modo examen», genera un test de 4 opciones desde un cuaderno y se corrige al instante con explicaciones.",
        "Cuanto más repases, más sube tu racha y menos tarjetas tendrás pendientes.",
      ],
    },
  },
  {
    match: /^\/transcribe/,
    tutorial: {
      title: "Transcribir una clase",
      steps: [
        "Sube la grabación (MP3, M4A, WAV...) de hasta 24 MB.",
        "Pulsa «Transcribir audio»: se usa Whisper de OpenAI (configura tu clave en Ajustes).",
        "Revisa el texto, ponle un título y guárdalo como cuaderno.",
        "Después puedes resumirlo en IA Studio o generar flashcards en Repaso.",
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
        "Temporizador Pomodoro: 25 minutos de enfoque y 5 de descanso.",
        "Cada sesión completada suma minutos y mantiene tu racha diaria.",
        "Activa las notificaciones (campana) para que te avise al terminar.",
        "Debajo tienes el plan del día: una cosa después de otra.",
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
        "Activa los recordatorios de Telegram: recibirás cada día tus tareas y exámenes.",
        "En Canva y Word/Excel tienes los botones para descargar tus tareas y cuadernos.",
        "Define tu disponibilidad semanal: el asistente planifica usándola.",
      ],
    },
  },
];

export function HelpWidget() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  const tutorial =
    TUTORIALS.find((entry) => entry.match.test(pathname))?.tutorial ?? DEFAULT_TUTORIAL;

  return (
    <div className="fixed bottom-5 right-24 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="animate-pop w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-white/[0.08] bg-black/75 p-4 text-white/90 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-3xl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white/90">💡 {tutorial.title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar tutorial"
              className="rounded p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-white/60">
            {tutorial.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-white/30">
            Pulsa el botón «?» cuando quieras volver a ver este tutorial.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Ayuda y tutoriales"
        aria-label="Ayuda y tutoriales"
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/30 text-white/70 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-3xl transition-colors hover:bg-black/45 hover:text-white"
      >
        <CircleHelp className="h-5 w-5" />
      </button>
    </div>
  );
}
