"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Maximize2,
  Save,
  StickyNote,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { saveCanvasBoard, type CanvasBoard, type CanvasNode } from "@/lib/canvas-store";
import { cn } from "@/lib/utils";

function NoteNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { updateNodeData } = useReactFlow();
  const label = typeof data.label === "string" ? data.label : "";

  return (
    <div
      className={cn(
        "min-w-[190px] max-w-[280px] rounded-2xl border bg-[#fffdf4]/95 p-3 shadow-[0_16px_36px_-22px_rgba(20,24,38,0.5)] backdrop-blur-sm dark:bg-[#161a2b]/95",
        selected
          ? "border-[#0066FF] ring-2 ring-[#0066FF]/20 dark:border-[#8ab9ff]"
          : "border-amber-200/80 dark:border-white/10",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-[#0066FF] dark:!bg-[#8ab9ff]"
      />
      <textarea
        value={label}
        onChange={(event) => updateNodeData(id, { label: event.target.value })}
        placeholder="Escribe una idea…"
        rows={4}
        className="nodrag nowheel w-full resize-none bg-transparent text-[11.5px] leading-5 text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/25"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-[#0066FF] dark:!bg-[#8ab9ff]"
      />
    </div>
  );
}

function ImageNode({ data, selected }: NodeProps<CanvasNode>) {
  const src = typeof data.src === "string" ? data.src : "";

  return (
    <div
      className={cn(
        "w-[220px] overflow-hidden rounded-2xl border bg-white/85 p-1.5 shadow-[0_16px_36px_-22px_rgba(20,24,38,0.5)] backdrop-blur-sm dark:bg-[#161a2b]/90",
        selected
          ? "border-[#0066FF] ring-2 ring-[#0066FF]/20 dark:border-[#8ab9ff]"
          : "border-white/60 dark:border-white/10",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-[#0066FF] dark:!bg-[#8ab9ff]"
      />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-auto w-full rounded-xl object-cover"
        />
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-[#0066FF] dark:!bg-[#8ab9ff]"
      />
    </div>
  );
}

const nodeTypes = { note: NoteNode, image: ImageNode } as NodeTypes;

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

export function CanvasWorkspace({
  board,
  onBack,
  onChanged,
}: {
  board: CanvasBoard;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(board.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(board.edges);
  const [instance, setInstance] = useState<ReactFlowInstance<CanvasNode, Edge> | null>(
    null,
  );
  const [name, setName] = useState(board.name);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  async function persist(
    nextName: string,
    nextNodes: CanvasNode[],
    nextEdges: Edge[],
  ): Promise<void> {
    setStatus("saving");
    try {
      await saveCanvasBoard({
        ...board,
        name: nextName,
        nodes: nextNodes,
        edges: nextEdges,
        updatedAt: Date.now(),
      });
      setStatus("saved");
      onChangedRef.current();
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setStatus("saving");
    const timeout = window.setTimeout(() => {
      void persist(name, nodes, edges);
    }, 900);
    return () => window.clearTimeout(timeout);
    // `persist` se recrea en cada render; el guardado depende de los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, name]);

  function centerPoint() {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function addNote() {
    const position = instance?.screenToFlowPosition(centerPoint()) ?? {
      x: 120 + Math.random() * 80,
      y: 120 + Math.random() * 80,
    };
    setNodes((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "note",
        position,
        data: { label: "" },
        style: { width: 240 },
      },
    ]);
  }

  function addImage(src: string, position: { x: number; y: number }) {
    setNodes((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "image",
        position,
        data: { src },
        style: { width: 220 },
      },
    ]);
  }

  async function handleFile(file: File, position?: { x: number; y: number }) {
    if (!file.type.startsWith("image/")) return;
    try {
      const src = await readImage(file);
      const point =
        position ?? instance?.screenToFlowPosition(centerPoint()) ?? { x: 160, y: 160 };
      addImage(src, point);
    } catch {
      setStatus("error");
    }
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const position = instance?.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    await handleFile(file, position);
  }

  function deleteSelected() {
    setNodes((current) => current.filter((node) => !node.selected));
    setEdges((current) => current.filter((edge) => !edge.selected));
  }

  async function saveNow() {
    await persist(name, nodes, edges);
  }

  async function goBack() {
    await persist(name, nodes, edges);
    onBack();
  }

  const onConnect = (connection: Connection) =>
    setEdges((current) =>
      addEdge(
        { ...connection, markerEnd: { type: MarkerType.ArrowClosed } },
        current,
      ),
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void goBack()}
          className="h-8 rounded-xl px-2.5 text-[11px]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Pizarras
        </Button>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Nombre de la pizarra"
          className="min-w-[140px] flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-semibold tracking-[-0.02em] text-slate-800 outline-none transition-colors hover:border-slate-300/50 focus:border-[#0066FF]/40 dark:text-white/85 dark:hover:border-white/10"
        />

        <span
          className={cn(
            "flex items-center gap-1 text-[10px] font-medium",
            status === "saved"
              ? "text-slate-400 dark:text-white/30"
              : status === "saving"
                ? "text-[#0066FF] dark:text-[#8ab9ff]"
                : "text-rose-500",
          )}
        >
          {status === "saving" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "saved" ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
          )}
          {status === "saved" ? "Guardado" : status === "saving" ? "Guardando…" : "Error al guardar"}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addNote}
          className="h-8 rounded-xl px-2.5 text-[11px]"
        >
          <StickyNote className="h-3.5 w-3.5" /> Nota
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="h-8 rounded-xl px-2.5 text-[11px]"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Imagen
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => instance?.fitView({ padding: 0.2 })}
          aria-label="Centrar la pizarra"
          title="Centrar"
          className="h-8 w-8 rounded-xl p-0"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={deleteSelected}
          aria-label="Eliminar lo seleccionado"
          title="Eliminar selección"
          className="h-8 w-8 rounded-xl p-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void saveNow()}
          className="h-8 rounded-xl px-2.5 text-[11px]"
        >
          <Save className="h-3.5 w-3.5" /> Guardar
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>

      <div
        ref={wrapperRef}
        onDrop={(event) => void onDrop(event)}
        onDragOver={(event) => event.preventDefault()}
        className="h-[calc(100dvh-19rem)] min-h-[520px] overflow-hidden rounded-[26px] border border-slate-300/45 bg-slate-50/60 shadow-lg shadow-slate-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-[#0b0f18]/45"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(flow) => setInstance(flow)}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
          deleteKeyCode={["Backspace", "Delete"]}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 1.6 },
          }}
          connectionLineStyle={{ strokeWidth: 1.6 }}
          className="bg-transparent"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.2}
            color="#94a3b8"
          />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor="#8ab9ff"
            maskColor="rgba(15,23,42,0.12)"
          />
        </ReactFlow>
      </div>

      <p className="text-[10.5px] text-slate-400 dark:text-white/30">
        Arrastra las notas para moverlas · rueda para zoom · conecta los puntos para crear
        flechas · suelta una imagen desde tu equipo. Se guarda en este dispositivo.
      </p>
    </div>
  );
}
