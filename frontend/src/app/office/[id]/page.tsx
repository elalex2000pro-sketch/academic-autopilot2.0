import { AcademicOfficeView } from "@/components/academic-office-view";
export default function OfficeDocumentPage({ params }: { params: { id: string } }) { return <AcademicOfficeView key={params.id} documentId={params.id} />; }
