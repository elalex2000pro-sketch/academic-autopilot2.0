import { PlannerPageView } from "@/components/planner-page-view";

// Ruta heredada: abre el planificador con las herramientas de horario visibles.
export default function SchedulePage() {
  return <PlannerPageView defaultOpenTools />;
}
