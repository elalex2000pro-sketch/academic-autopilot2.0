import { redirect } from "next/navigation";

// Asignaturas y examenes viven ahora en una sola vista academica.
export default function SubjectsRedirect() {
  redirect("/academics");
}
