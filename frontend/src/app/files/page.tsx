"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRealtime } from "@/components/realtime-provider";
import { api, ApiError } from "@/lib/api";
import { uploadFileInChunks, type UploadProgress } from "@/lib/upload";
import type { Course, DocumentFile } from "@/lib/types";

const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.gif";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function FilesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // null = General
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [cs, fs] = await Promise.all([api.courses(), api.files()]);
    setCourses(cs);
    setFiles(fs);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [load]);

  useRealtime((event) => {
    if (event.event === "files" || event.event === "courses") {
      load().catch(() => undefined);
    }
  });

  const countFor = useCallback(
    (courseId: string | null) =>
      files.filter((f) => (f.course_id ?? null) === courseId).length,
    [files],
  );

  const visibleFiles = useMemo(
    () => files.filter((f) => (f.course_id ?? null) === selected),
    [files, selected],
  );

  const selectedCourse = courses.find((c) => c.id === selected) ?? null;

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setProgress({ uploadedBytes: 0, totalBytes: file.size, percent: 0 });
    setError(null);
    try {
      // Subida por trozos: vale para archivos pequenos y de hasta 20 GB.
      await uploadFileInChunks(file, {
        courseId: selected,
        onProgress: setProgress,
      });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function remove(file: DocumentFile) {
    try {
      await api.deleteFile(file.id);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function download(file: DocumentFile) {
    try {
      await api.downloadFile(file.id, file.filename);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Archivos</h1>
        <p className="text-sm text-muted-foreground">
          Sube PDFs y apuntes (hasta 20 GB por archivo, con subida reanudable). Cada asignatura
          tiene su propia carpeta; lo que no asignes va a &quot;General&quot;.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Carpetas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Carpetas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <FolderButton
              active={selected === null}
              icon={<FolderOpen className="h-4 w-4" />}
              label="General"
              count={countFor(null)}
              onClick={() => setSelected(null)}
            />
            {courses.map((course) => (
              <FolderButton
                key={course.id}
                active={selected === course.id}
                icon={
                  <Folder className="h-4 w-4" style={{ color: course.color ?? undefined }} />
                }
                label={course.name}
                count={countFor(course.id)}
                onClick={() => setSelected(course.id)}
              />
            ))}
            {courses.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">
                 Crea asignaturas en &quot;Asignaturas&quot; para tener carpetas.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Archivos de la carpeta seleccionada */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">
              {selectedCourse ? selectedCourse.name : "General"}
            </CardTitle>
            <div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onFileChange}
              />
              <Button
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Subir archivo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploading && progress && (
              <div className="space-y-1 rounded-md border border-border/60 px-3 py-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Subiendo... {progress.percent}%</span>
                  <span>
                    {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
                  </span>
                </div>
                <Progress value={progress.percent} />
              </div>
            )}

            {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}

            {!loading &&
              visibleFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{file.filename}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(file.size_bytes)}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => download(file)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(file)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

            {!loading && visibleFiles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Esta carpeta esta vacia. Sube un PDF o apunte con el boton de arriba.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FolderButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="text-xs">{count}</span>
    </button>
  );
}
