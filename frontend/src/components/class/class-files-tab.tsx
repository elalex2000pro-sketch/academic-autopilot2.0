"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DocumentFile } from "@/lib/types";
import { type UploadProgress } from "@/lib/upload";
import { Loader2, Upload } from "lucide-react";
export function ClassFilesTab({
  fileInputRef,
  ACCEPT,
  onFileChange,
  uploading,
  progress,
  formatBytes,
  files,
  SharedFileRow,
  canDeleteFile,
  downloadFile,
  removeFile,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  ACCEPT: ".pdf,.epub,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.gif";
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  uploading: boolean;
  progress: UploadProgress | null;
  formatBytes: (bytes: number) => string;
  files: DocumentFile[];
  SharedFileRow: React.NamedExoticComponent<{
    file: DocumentFile;
    canDelete: boolean;
    onDownload: (file: DocumentFile) => void;
    onRemove: (file: DocumentFile) => void;
  }>;
  canDeleteFile: (file: DocumentFile) => boolean;
  downloadFile: (file: DocumentFile) => Promise<void>;
  removeFile: (file: DocumentFile) => Promise<void>;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Archivos de la clase</CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={onFileChange}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
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
                {formatBytes(progress.uploadedBytes)} /{" "}
                {formatBytes(progress.totalBytes)}
              </span>
            </div>
            <Progress value={progress.percent} />
          </div>
        )}

        {files.length === 0 && !uploading && (
          <p className="text-sm text-muted-foreground">
            No hay archivos compartidos todavia (hasta 20 GB por archivo).
          </p>
        )}

        {files.map((file) => (
          <SharedFileRow
            key={file.id}
            file={file}
            canDelete={canDeleteFile(file)}
            onDownload={downloadFile}
            onRemove={removeFile}
          />
        ))}
      </CardContent>
    </Card>
  );
}
