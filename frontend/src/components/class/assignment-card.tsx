"use client";

import { useCallback, useEffect, useState } from "react";

import { classworkApi as api, api as mainApi } from "@/lib/api";

import { useAuth } from "@/components/auth-provider";

import { PersonalWork } from "./personal-work";

import type { Task, Topic, Comment } from "./classwork-types";

export function AssignmentCard({
  task,
  classId,
  topics,
  isOwner,
  onChange,
}: {
  task?: Task;
  classId: string;
  topics: Topic[];
  isOwner: boolean;
  onChange: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ id: string; filename: string }[]>([]);

  const base = `/api/v1/classes/${classId}/assignments`;
  const path = base + (task ? "/" + task.id : "");

  const loadComments = useCallback(
    () =>
      task
        ? api
            .get<Comment[]>(path + "/comments")
            .then(setComments)
            .catch((e) => setError(String(e)))
        : Promise.resolve(),
    [path, task],
  );

  useEffect(() => {
    void loadComments();
  }, [loadComments, task]);

  useEffect(() => {
    if (editing)
      void mainApi
        .classFiles(classId)
        .then(setFiles)
        .catch((e) => setError(String(e)));
  }, [editing, classId]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api.mutate(path, task ? "PATCH" : "POST", {
        title: form.get("title"),
        description: form.get("description"),
        due_at: form.get("due_at")
          ? new Date(String(form.get("due_at"))).toISOString()
          : null,
        topic_id: form.get("topic_id") || null,
        attachment_ids: form.getAll("attachments"),
      });
      setEditing(false);
      await onChange();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar esta tarea?")) return;
    try {
      await api.mutate(path, "DELETE");
      await onChange();
    } catch (e) {
      setError(String(e));
    }
  }

  async function comment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.mutate(path + "/comments", "POST", { content: text });
      setText("");
      await loadComments();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const overdue =
    task?.due_at &&
    new Date(task.due_at) < new Date() &&
    task.my_state !== "done";

  return (
    <article className="rounded-xl border border-border bg-background/40 p-4">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!task && !editing && (
        <button onClick={() => setEditing(true)}>+ Nueva tarea</button>
      )}
      {task && (
        <details>
          <summary className="cursor-pointer font-semibold">
            {task.title}{" "}
            {overdue && (
              <span className="ml-2 rounded bg-rose-500/15 px-2 text-xs text-rose-600">
                Con retraso
              </span>
            )}
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-sm">{task.description}</p>
          <p className="my-2 text-xs text-muted-foreground">
            {task.due_at
              ? new Date(task.due_at).toLocaleString("es-ES")
              : "Sin fecha límite"}
          </p>
          <div className="space-y-2">
            {task.attachments.map((f) => (
              <button
                className="block underline"
                key={f.id}
                onClick={() =>
                  void api
                    .download(`/api/v1/files/${f.id}/download`, f.name)
                    .catch((e) => setError(String(e)))
                }
              >
                {f.name}
              </button>
            ))}
          </div>
          <p className="my-3 text-sm">
            {task.completed_count} de {task.total_members} han terminado
          </p>
          <div className="flex flex-wrap gap-2">
            {task.finished.map((p) => (
              <span
                key={p.id}
                title={p.name}
                className="rounded-full border border-border px-2 py-1 text-xs"
              >
                <span
                  aria-hidden="true"
                  className="mr-1 inline-block rounded-full bg-primary/15 px-1"
                >
                  {p.name.slice(0, 1)}
                </span>
                @{p.username}
              </span>
            ))}
          </div>
          {(isOwner || task.created_by === user?.id) && (
            <div className="my-3 flex gap-3 text-sm">
              <button onClick={() => setEditing(true)}>Editar tarea</button>
              <button onClick={() => void remove()}>Eliminar tarea</button>
            </div>
          )}
          <PersonalWork task={task} classId={classId} onChange={onChange} />
          <h4 className="mt-5 font-medium">Comentarios</h4>
          {comments.map((c) => (
            <div
              key={c.id}
              className="mt-2 rounded-lg bg-background/40 p-2 text-sm"
            >
              <p className="text-xs text-muted-foreground">
                @{c.author.username} ·{" "}
                {new Date(c.created_at).toLocaleString("es-ES")}
              </p>
              <p className="whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
          <form onSubmit={comment} className="mt-2 flex gap-2">
            <input
              aria-label="Comentario"
              required
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-w-0 flex-1 rounded border border-border bg-transparent p-2"
            />
            <button disabled={busy || !text.trim()}>Comentar</button>
          </form>
        </details>
      )}
      {editing && (
        <form onSubmit={save} className="mt-3 space-y-3">
          <input
            name="title"
            aria-label="Título de la tarea"
            defaultValue={task?.title}
            required
            maxLength={300}
            className="w-full rounded border border-border bg-transparent p-2"
          />
          <textarea
            name="description"
            aria-label="Descripción"
            defaultValue={task?.description ?? ""}
            maxLength={4000}
            className="w-full rounded border border-border bg-transparent p-2"
          />
          <input
            type="datetime-local"
            name="due_at"
            aria-label="Fecha límite"
            defaultValue={
              task?.due_at
                ? new Date(
                    new Date(task.due_at).getTime() -
                      new Date(task.due_at).getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : ""
            }
          />
          <select
            name="topic_id"
            aria-label="Tema"
            defaultValue={task?.topic_id ?? ""}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">Sin tema</option>
            {topics.map((t) => (
              <option value={t.id} key={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <fieldset>
            <legend className="text-sm">
              Adjuntos de los archivos de la clase
            </legend>
            {files.map((f) => (
              <label className="block text-sm" key={f.id}>
                <input
                  type="checkbox"
                  name="attachments"
                  value={f.id}
                  defaultChecked={task?.attachments.some((a) => a.id === f.id)}
                />
                {f.filename}
              </label>
            ))}
          </fieldset>
          <button
            disabled={busy}
            className="mr-3 rounded bg-primary px-3 py-2 text-primary-foreground"
          >
            Guardar tarea
          </button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </form>
      )}
    </article>
  );
}
