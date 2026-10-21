import { redirect } from "next/navigation";

// La antigua pagina "Academico" se dividio en Asignaturas, Horario y Examenes.
export default function AcademicsRedirect() {
  redirect("/subjects");
}
