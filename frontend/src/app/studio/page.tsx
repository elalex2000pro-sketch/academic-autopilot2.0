"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Sparkles, Trash2, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import type { AiOutput, DocumentFile } from "@/lib/types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

type Kind = "summary" | "infographic";

export default function StudioPage() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [outputs, setOutputs] = useState<AiOutput[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, o] = await Promise.all([api.files(), api.studioOutputs()]);
    setFiles(f);
    setOutputs(o);
  }, []);

  useEffect(() => {
    load().catch((e) => setNotice(errorMessage(e)));
  }, [load]);

  useRealtime((event) => {
    if (event.event === "studio" || event.event === "files") {
      load().catch(() => undefined);
    }
  });

  function generate(documentId: string, kind: Kind) {
    setBusyId(`${documentId}:${kind}`);
    setNotice(null);
    api
      .generateStudio(documentId, kind)
      .then((output) => {
        setNotice(`Generado: ${output.title}`);
        return load();
      })
      .catch((e) => setNotice(errorMessage(e)))
      .finally(() => setBusyId(null));
  }

  function removeOutput(id: string) {
    setNotice(null);
    api
      .deleteStudioOutput(id)
      .then(() => load())
      .catch((e) => setNotice(errorMessage(e)));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Wand2 className="h-5 w-5" /> IA Studio
        </h1>
        <p className="text-sm text-muted-foreground">
          Genera resumenes e infografias en PDF a partir de tus documentos (PDF, DOCX o texto).
        </p>
      </header>

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Mis documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="truncate font-medium">{file.filename}</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => generate(file.id, "summary")}
                >
                  <Sparkles className="h-4 w-4" />
                  {busyId === `${file.id}:summary` ? "Generando..." : "Resumen"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId !== null}
                  onClick={() => generate(file.id, "infographic")}
                >
                  <Wand2 className="h-4 w-4" />
                  {busyId === `${file.id}:infographic` ? "Generando..." : "Infografia"}
                </Button>
              </div>
            </div>
          ))}
          {files.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sube documentos en la seccion Archivos para poder resumirlos aqui.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> Resultados generados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {outputs.map((output) => (
            <div
              key={output.id}
              className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant={output.kind === "summary" ? "default" : "secondary"}>
                  {output.kind === "summary" ? "Resumen" : "Infografia"}
                </Badge>
                <span className="font-medium">{output.title}</span>
                {output.source && (
                  <span className="text-xs text-muted-foreground">({output.source})</span>
                )}
              </span>
              <div className="flex gap-2">
                {output.output_document_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      output.output_document_id &&
                      api.downloadFile(output.output_document_id, `${output.title}.pdf`)
                    }
                  >
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => removeOutput(output.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {outputs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavia no has generado ningun resumen ni infografia.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
