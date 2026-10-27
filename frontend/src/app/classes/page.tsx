"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import type { SharedClass } from "@/lib/types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<SharedClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setClasses(await api.classes());
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [load]);

  useRealtime((event) => {
    if (event.event === "classes") {
      load().catch(() => undefined);
    }
  });

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.createClass({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      router.push(`/classes/${created.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setCreating(false);
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (code.trim().length < 4 || joining) return;
    setJoining(true);
    setError(null);
    try {
      const joined = await api.joinClass(code.trim().toUpperCase());
      router.push(`/classes/${joined.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setJoining(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Clases compartidas</h1>
        <p className="text-sm text-muted-foreground">
          Crea una clase y comparte su codigo: quien se una entra de forma permanente y tiene
          chat, calendario y archivos en comun con el resto.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" /> Crear una clase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="class-name">Nombre</Label>
                <Input
                  id="class-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Grupo de estudio - Calculo"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-description">Descripcion (opcional)</Label>
                <Input
                  id="class-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Para que usareis la clase..."
                  maxLength={2000}
                />
              </div>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear clase
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Unirse con codigo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={join} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="class-code">Codigo de la clase</Label>
                <Input
                  id="class-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD2345"
                  maxLength={12}
                  className="font-mono tracking-widest"
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                disabled={joining || code.trim().length < 4}
              >
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Unirme a la clase
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mis clases</h2>
        {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!loading && classes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aun no perteneces a ninguna clase. Crea una y comparte el codigo, o unete con el
            codigo que te hayan pasado.
          </p>
        )}
        {!loading && classes.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {classes.map((item) => (
              <Link
                key={item.id}
                href={`/classes/${item.id}`}
                className="rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{item.name}</p>
                  {item.my_role === "owner" && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Propietario
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {item.member_count} {item.member_count === 1 ? "miembro" : "miembros"}
                  </span>
                  <span className="font-mono">{item.code}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
