"use client";

import localforage from "localforage";
import type { Edge, Node } from "@xyflow/react";

const INDEX_KEY = "autopilot:canvas:index";
const BOARD_PREFIX = "autopilot:canvas:board:";

const store = localforage.createInstance({
  name: "academic-autopilot",
  storeName: "infinite_canvas",
});

export type CanvasNode = Node<Record<string, unknown>>;

export interface CanvasBoardMeta {
  id: string;
  name: string;
  updatedAt: number;
  nodeCount: number;
}

export interface CanvasBoard {
  id: string;
  name: string;
  updatedAt: number;
  nodes: CanvasNode[];
  edges: Edge[];
}

function boardKey(id: string): string {
  return `${BOARD_PREFIX}${id}`;
}

async function readIndex(): Promise<CanvasBoardMeta[]> {
  const stored = await store.getItem<CanvasBoardMeta[]>(INDEX_KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((item) => item && typeof item.id === "string")
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function writeIndex(meta: CanvasBoardMeta): Promise<void> {
  const current = await readIndex();
  const next = [meta, ...current.filter((item) => item.id !== meta.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 120);
  await store.setItem(INDEX_KEY, next);
}

function starterBoard(name: string): CanvasBoard {
  return {
    id: crypto.randomUUID(),
    name,
    updatedAt: Date.now(),
    nodes: [
      {
        id: crypto.randomUUID(),
        type: "note",
        position: { x: 120, y: 120 },
        data: {
          label:
            "Pizarra infinita\n\nArrastra para mover · rueda para zoom\nAñade notas e imágenes y conecta las ideas.",
        },
        style: { width: 270 },
      },
    ],
    edges: [],
  };
}

export async function listCanvasBoards(): Promise<CanvasBoardMeta[]> {
  return readIndex();
}

export async function createCanvasBoard(name = "Pizarra sin título"): Promise<CanvasBoard> {
  const board = starterBoard(name);
  await store.setItem(boardKey(board.id), board);
  await writeIndex({
    id: board.id,
    name: board.name,
    updatedAt: board.updatedAt,
    nodeCount: board.nodes.length,
  });
  return board;
}

export async function loadCanvasBoard(id: string): Promise<CanvasBoard | null> {
  const board = await store.getItem<CanvasBoard>(boardKey(id));
  if (!board || typeof board.id !== "string") return null;
  return {
    ...board,
    nodes: Array.isArray(board.nodes) ? board.nodes : [],
    edges: Array.isArray(board.edges) ? board.edges : [],
  };
}

export async function saveCanvasBoard(board: CanvasBoard): Promise<void> {
  const snapshot: CanvasBoard = {
    ...board,
    name: board.name.trim() || "Pizarra sin título",
    updatedAt: Date.now(),
  };
  await store.setItem(boardKey(snapshot.id), snapshot);
  await writeIndex({
    id: snapshot.id,
    name: snapshot.name,
    updatedAt: snapshot.updatedAt,
    nodeCount: snapshot.nodes.length,
  });
}

export async function deleteCanvasBoard(id: string): Promise<void> {
  await store.removeItem(boardKey(id));
  const current = await readIndex();
  await store.setItem(
    INDEX_KEY,
    current.filter((item) => item.id !== id),
  );
}
