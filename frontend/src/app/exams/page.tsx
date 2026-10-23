import { redirect } from "next/navigation";

// Las notas y examenes se gestionan desde /academics.
export default function ExamsRedirect() {
  redirect("/academics");
}
