"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ClassMessage, ClassAssignment, ClassEvent } from "@/lib/types";
export function ClassNewsTab({
  classId,
  messages,
  isOwner,
  userId,
  onRefresh,
  onPin,
  onDelete,
  assignments,
  events,
}: {
  classId: string;
  messages: ClassMessage[];
  isOwner: boolean;
  userId: string;
  onRefresh: () => Promise<void>;
  onPin: (m: ClassMessage) => Promise<void>;
  onDelete: (m: ClassMessage) => Promise<void>;
  assignments: ClassAssignment[];
  events: ClassEvent[];
}) {
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState(false);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(parent?: string) {
    const content = (parent ? replies[parent] : draft)?.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      await api.sendClassMessage(classId, {
        content,
        kind: !parent && announcement ? "announcement" : "message",
        ...(parent ? { parent_id: parent } : {}),
      });
      if (parent) setReplies((v) => ({ ...v, [parent]: "" }));
      else setDraft("");
      await onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const posts = messages
    .filter((m) => !m.parent_id)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  const now = Date.now(),
    end = now + 7 * 86400000;
  const upcoming = [
    ...assignments
      .filter((a) => !a.my_completed && a.due_at)
      .map((a) => ({ id: a.id, title: a.title, date: a.due_at! })),
    ...events.map((e) => ({
      id: e.id,
      title: (e.is_exam ? "Examen: " : "") + e.title,
      date: e.start_at,
    })),
  ]
    .filter((a) => Date.parse(a.date) >= now && Date.parse(a.date) <= end)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <section className="min-w-0 space-y-4" aria-label="Publicaciones">
        <form
          className="app-glass space-y-3 rounded-2xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="block text-sm font-medium" htmlFor="class-post">
            Compartir algo con tu clase
          </label>
          <textarea
            id="class-post"
            className="w-full rounded-xl border border-border bg-background/40 p-3"
            value={draft}
            maxLength={4000}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex flex-wrap justify-between gap-3">
            {isOwner && (
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={announcement}
                  onChange={(e) => setAnnouncement(e.target.checked)}
                />{" "}
                Publicar como anuncio fijado
              </label>
            )}
            <button
              disabled={busy || !draft.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-primary-foreground"
            >
              Publicar
            </button>
          </div>
        </form>
        {error && <p role="alert">{error}</p>}
        {!posts.length && (
          <p className="app-glass rounded-2xl p-5">
            Comparte la primera publicación con tus compañeros.
          </p>
        )}
        {posts.map((m) => (
          <article
            data-post-id={m.id}
            data-pinned={m.pinned}
            key={m.id}
            className="app-glass space-y-3 rounded-2xl p-4"
          >
            <header className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {m.author_name} ·{" "}
                {new Date(m.created_at).toLocaleString("es-ES")}
                {m.pinned && " · Fijada"}
              </span>
              <span>
                {isOwner && (
                  <button
                    onClick={() =>
                      void onPin(m).catch((e) => setError(String(e)))
                    }
                    className="mr-3"
                  >
                    {m.pinned ? "Desfijar" : "Fijar"}
                  </button>
                )}
                {(isOwner || m.user_id === userId) && (
                  <button
                    onClick={() =>
                      void onDelete(m).catch((e) => setError(String(e)))
                    }
                  >
                    Borrar mensaje
                  </button>
                )}
              </span>
            </header>
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
            <div className="space-y-2 border-t border-border pt-3">
              {messages
                .filter((r) => r.parent_id === m.id)
                .sort(
                  (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
                )
                .map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg bg-background/40 p-2 text-sm"
                  >
                    <p className="text-xs text-muted-foreground">
                      {r.author_name} ·{" "}
                      {new Date(r.created_at).toLocaleString("es-ES")}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      {r.content}
                    </p>
                    {(isOwner || r.user_id === userId) && (
                      <button
                        className="text-xs"
                        onClick={() =>
                          void onDelete(r).catch((e) => setError(String(e)))
                        }
                      >
                        Borrar respuesta
                      </button>
                    )}
                  </div>
                ))}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(m.id);
                }}
              >
                <input
                  aria-label={`Responder a ${m.author_name}`}
                  maxLength={4000}
                  value={replies[m.id] ?? ""}
                  onChange={(e) =>
                    setReplies((v) => ({ ...v, [m.id]: e.target.value }))
                  }
                  placeholder="Responder a tus compañeros"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-transparent p-2"
                />
                <button disabled={busy || !replies[m.id]?.trim()}>
                  Responder
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
      <aside className="app-glass h-fit rounded-2xl p-4">
        <h2 className="font-semibold">Próximas entregas</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Los próximos siete días
        </p>
        {upcoming.length ? (
          upcoming.map((a) => (
            <div key={a.id} className="border-t border-border py-2 text-sm">
              <p>{a.title}</p>
              <time className="text-xs text-muted-foreground">
                {new Date(a.date).toLocaleString("es-ES")}
              </time>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay entregas ni eventos próximos.
          </p>
        )}
      </aside>
    </div>
  );
}
