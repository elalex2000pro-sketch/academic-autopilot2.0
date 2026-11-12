"use client";

import type * as React from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import { Avatar } from "@/components/chat/chat-message-content";
import { AtSign, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";

type Props = {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  user: User | null;
  editingUsername: boolean;
  savingName: boolean;
  setUsernameDraft: Dispatch<SetStateAction<string>>;
  setNameMessage: Dispatch<SetStateAction<string | null>>;
  setEditingUsername: Dispatch<SetStateAction<boolean>>;
  setDialogOpen: Dispatch<SetStateAction<boolean>>;
  claimUsername: () => Promise<void>;
  usernameRef: RefObject<HTMLInputElement>;
  usernameDraft: string;
  nameMessage: string | null;
};

export function ChatProfilePanel({
  query,
  setQuery,
  user,
  editingUsername,
  savingName,
  setUsernameDraft,
  setNameMessage,
  setEditingUsername,
  setDialogOpen,
  claimUsername,
  usernameRef,
  usernameDraft,
  nameMessage,
}: Props) {
  return (
<>
<div className="chat-profile">
          <Avatar name={user?.full_name || user?.username || "Tú"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {user?.full_name || "Tu perfil"}
            </p>
            <button
              type="button"
              aria-label="Cambiar tu @usuario"
              aria-expanded={editingUsername}
              aria-controls="chat-username-form"
              disabled={savingName}
              title="Cambiar tu @usuario"
              className="flex max-w-full items-center gap-1 truncate rounded text-left text-xs text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
              onClick={() => {
                setUsernameDraft(user?.username ?? "");
                setNameMessage(null);
                setEditingUsername((value) => !value);
              }}
            >
              {user?.username ? `@${user.username}` : "Configura tu @usuario"}
              <AtSign className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          </div>
          <button
            className="chat-icon-button"
            onClick={() => setDialogOpen(true)}
            aria-label="Nuevo chat / Añadir contacto"
            title="Nuevo chat"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 pb-3 pt-4">
          <h1 className="mb-3 text-[23px] font-semibold tracking-[-0.04em]">
            Chats
          </h1>
          <label className="chat-search">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar chats o @usuario"
              aria-label="Buscar chats abiertos"
            />
            {query ? (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
        </div>
        {!user?.username || editingUsername ? (
          <form
            id="chat-username-form"
            className="mx-4 mb-3 rounded-xl border border-border bg-background/40 p-3"
            onSubmit={(event) => { event.preventDefault(); void claimUsername(); }}
          >
            <p className="mb-2 text-xs">
              Elige tu @usuario para que puedan encontrarte.
            </p>
            <div className="flex gap-2">
              <input
                ref={usernameRef}
                aria-label="Tu nuevo @usuario"
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                placeholder="@tu_usuario"
                maxLength={25}
                disabled={savingName}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={savingName || !usernameDraft.trim()}
              >
                Guardar
              </Button>
            </div>
            {user?.username ? (
              <button
                type="button"
                className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
                disabled={savingName}
                onClick={() => { setEditingUsername(false); setNameMessage(null); }}
              >
                Cancelar
              </button>
            ) : null}
            {nameMessage ? (
              <p className="mt-2 text-xs text-destructive">{nameMessage}</p>
            ) : null}
          </form>
        ) : null}
</>
  );
}
