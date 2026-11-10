"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Notebook } from "@/lib/types";
import { NotebookPen } from "lucide-react";
import Link from "next/link";
export function ClassNotebooksTab({
  notebooks,
  user,
  openSharedNotebook,
}: {
  notebooks: Notebook[];
  user: import("@/lib/types").User | null;
  openSharedNotebook: (notebook: Notebook) => void;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Cuadernos compartidos</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Apuntes que los miembros han compartido con la clase.
          </p>
        </div>
        <Link href="/notebooks">
          <Button size="sm" variant="secondary">
            <NotebookPen className="h-4 w-4" /> Mis cuadernos
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {notebooks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nadie ha compartido cuadernos todavía. En Cuadernos, elige uno y
            pulsa «Compartir con una clase».
          </p>
        )}
        {notebooks.map((notebook) => (
          <div
            key={notebook.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-sm"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: notebook.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{notebook.title}</p>
              <p className="text-xs text-muted-foreground">
                {notebook.user_id === user?.id
                  ? "Tu cuaderno"
                  : "Compartido por un compañero"}{" "}
                ·{" "}
                {notebook.share_permission === "edit"
                  ? "Se puede editar"
                  : "Solo lectura"}{" "}
                · Actualizado{" "}
                {new Date(notebook.updated_at).toLocaleDateString("es-ES")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openSharedNotebook(notebook)}
            >
              Abrir
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
