"use client";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { classworkApi as api } from "@/lib/api";
import type { Task, WorkState } from "./classwork-types";
export function PersonalWork({
  task,
  classId,
  onChange,
}: {
  task: Task;
  classId: string;
  onChange: () => Promise<void>;
}) {
  const { user } = useAuth();
  const mine = task.works.find((w) => w.user.id === user?.id);
  const [state, setState] = useState<WorkState>(task.my_state);
  const [note, setNote] = useState(mine?.note ?? "");
  const [shared, setShared] = useState(mine?.shared ?? false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/v1/classes/${classId}/assignments/${task.id}/work`;
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = new FormData(form).get("file") as File;
    setBusy(true);
    setError("");
    try {
      if (file?.size) await api.upload(base + "/files", file);
      await api.mutate(base, "PUT", { state, note, shared });
      form.reset();
      await onChange();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-4 rounded-xl border border-border p-3">
      <h4 className="font-medium">Mi trabajo</h4>
      <p className="my-1 text-xs text-muted-foreground">
        Tus archivos y tu nota personal son privados hasta que decidas
        compartirlos.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <form onSubmit={save} className="space-y-3">
        <select
          aria-label="Mi estado"
          value={state}
          onChange={(e) => setState(e.target.value as WorkState)}
          className="rounded border border-border bg-background p-2"
        >
          <option value="pending">Pendiente</option>
          <option value="in_progress">En progreso</option>
          <option value="done">Hecha</option>
        </select>
        <textarea
          aria-label="Nota personal"
          placeholder="Nota personal (por ejemplo, la nota que sacaste)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={4000}
          className="block w-full rounded border border-border bg-transparent p-2"
        />
        <input name="file" type="file" aria-label="Adjuntar mi trabajo" className="block max-w-full text-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input
            role="switch"
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
          Compartir con la clase
        </label>
        <button
          disabled={busy}
          className="rounded bg-primary px-3 py-2 text-primary-foreground"
        >
          Guardar mi trabajo
        </button>
      </form>
      {task.works.map((w) => (
        <div
          className="mt-3 rounded-lg bg-background/40 p-2 text-sm"
          key={w.user.id}
        >
          <p className="font-medium">
            {w.user.id === user?.id ? "Mi trabajo" : "@" + w.user.username} ·{" "}
            {w.shared ? "Compartido" : "Privado"}
          </p>
          <p className="whitespace-pre-wrap">{w.note}</p>
          {w.files.map((f) => (
            <button
              className="block underline"
              key={f.id}
              onClick={() =>
                void api
                  .download(base + "/files/" + f.id, f.name)
                  .catch((e) => setError(String(e)))
              }
            >
              {f.name} ({f.size} B)
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
