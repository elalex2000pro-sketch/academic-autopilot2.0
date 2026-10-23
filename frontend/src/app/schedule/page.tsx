import { PlannerView } from "@/components/planner-view";

// Ruta heredada: abre el planificador con las herramientas de horario visibles.
export default function SchedulePage() {
  return <PlannerView defaultOpenTools />;
}
