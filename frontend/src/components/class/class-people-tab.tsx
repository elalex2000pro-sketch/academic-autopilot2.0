"use client";
import type { ClassDetail } from "@/lib/types";
export function ClassPeopleTab({
  detail,
  userId,
  onLeave,
}: {
  detail: ClassDetail;
  userId: string;
  onLeave: () => Promise<void>;
}) {
  return (
    <section className="app-glass space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-semibold">Personas ({detail.members.length})</h2>
        <button
          className="rounded-xl border border-border px-3 py-2"
          onClick={() => void onLeave()}
        >
          Abandonar la clase
        </button>
      </div>
      {detail.members.map((m) => (
        <div
          key={m.user_id}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3"
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15"
          >
            {(m.full_name ?? m.username ?? "?").slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate">
              {m.full_name ?? m.username}
              {m.user_id === userId ? " (tú)" : ""}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{m.username ?? "usuario"}
            </p>
          </div>
          <span className="text-xs">
            {m.role === "owner" ? "Administrador/a" : "Compañero/a"}
          </span>
        </div>
      ))}
    </section>
  );
}
