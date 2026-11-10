"use client";
import { useCallback, useEffect, useState } from "react";
import { classworkApi as api } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useRealtime } from "@/components/realtime-provider";
import { AssignmentCard } from "./assignment-card";
import type { Task, Topic } from "./classwork-types";

export function ClassworkBoard({
  classId,
  isOwner,
}: {
  classId: string;
  isOwner: boolean;
}) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/v1/classes/${classId}`;
  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api.get<Task[]>(base + "/assignments"),
        api.get<Topic[]>(base + "/topics"),
      ]);
      setTasks(a);
      setTopics(b);
    } catch (e) {
      setError(String(e));
    }
  }, [base]);
  useEffect(() => {
    void load();
  }, [load]);
  useRealtime((e) => {
    if (e.event === "classes" && e.data?.class_id === classId) void load();
  });
  async function topic(t?: Topic) {
    const title = window.prompt("Título del tema", t?.title ?? "");
    if (!title?.trim()) return;
    const orderText = window.prompt(
      "Orden del tema",
      String(t?.order ?? topics.length),
    );
    if (orderText === null) return;
    const order = Number(orderText);
    if (!Number.isInteger(order)) {
      setError("El orden debe ser un número entero");
      return;
    }
    setBusy(true);
    try {
      await api.mutate(
        base + "/topics" + (t ? "/" + t.id : ""),
        t ? "PATCH" : "POST",
        { title, order },
      );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(t: Topic) {
    if (!confirm("¿Eliminar el tema? Sus tareas quedarán sin tema.")) return;
    try {
      await api.mutate(base + "/topics/" + t.id, "DELETE");
      await load();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <section aria-label="Trabajo de clase" className="app-glass order-4 min-w-0 space-y-4 rounded-2xl p-5 xl:col-span-full xl:row-start-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Trabajo de clase</h2>
        <button
          disabled={busy}
          className="rounded-xl border border-border px-3 py-2"
          onClick={() => void topic()}
        >
          Nuevo tema
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Organiza tareas y comparte lo que quieras con tus compañeros.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <AssignmentCard
        classId={classId}
        topics={topics}
        isOwner={isOwner}
        onChange={load}
      />
      {[...topics, { id: "", title: "Sin tema", order: 0, created_by: "" }].map(
        (t) => (
          <details
            key={t.id}
            open
            className="rounded-xl border border-border bg-background/30 p-3"
          >
            <summary className="cursor-pointer font-medium">
              {t.title} (
              {tasks.filter((a) => (a.topic_id ?? "") === t.id).length})
            </summary>
            {t.id && (isOwner || t.created_by === user?.id) && (
              <div className="my-2 flex gap-3 text-xs">
                <button onClick={() => void topic(t)}>Editar tema</button>
                <button onClick={() => void remove(t)}>Eliminar tema</button>
              </div>
            )}
            <div className="mt-3 space-y-3">
              {tasks
                .filter((a) => (a.topic_id ?? "") === t.id)
                .map((task) => (
                  <AssignmentCard
                    key={task.id}
                    task={task}
                    classId={classId}
                    topics={topics}
                    isOwner={isOwner}
                    onChange={load}
                  />
                ))}
            </div>
          </details>
        ),
      )}
    </section>
  );
}
