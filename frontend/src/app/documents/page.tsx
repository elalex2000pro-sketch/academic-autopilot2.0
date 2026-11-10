import { DocumentsView } from "@/components/documents-view";

// El layout ya añade "· Academic Autopilot"; repetirlo duplicaba el título.
export const metadata = { title: "Documentos" };

export default function DocumentsPage() {
  return <DocumentsView />;
}
