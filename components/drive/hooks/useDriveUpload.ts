/**
 * @file components/drive/hooks/useDriveUpload.ts
 * @purpose Manages file upload processes, including drag-and-drop, progress tracking, and batch uploads.
 * @scope File input handling, XHR upload logic, progress state updates.
 * @out-of-scope File listing, Folder creation (delegates to helper or parent), Auth (handled by session).
 * @failure-behavior Retries uploads 3 times on network failure, reports specific errors via callbacks/alert.
 */
import { useState, useRef } from "react";
import { createFolder } from "@/app/actions/folder";
import { FileRecord, FolderRecord } from "../types";

interface UseDriveUploadProps {
  currentFolder: FolderRecord | null;
  tab: "personal" | "team";
  refreshFiles: () => void;
}

export function useDriveUpload({
  currentFolder,
  tab,
  refreshFiles,
}: UseDriveUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    loaded: number;
    total: number;
    startTime: number;
    count: number;
    totalCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Low-level XHR Upload
  const uploadFileClient = async (
    formData: FormData,
    onProgress: (loaded: number) => void,
  ) => {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/drive/upload", true);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress(e.loaded);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              try {
                const res = JSON.parse(xhr.responseText);
                reject({
                  status: xhr.status,
                  message: res.error || xhr.statusText,
                });
              } catch {
                reject({
                  status: xhr.status,
                  message: xhr.statusText || "Upload failed",
                });
              }
            }
          };

          xhr.onerror = () => reject({ status: 0, message: "Network error" });
          xhr.send(formData);
        });
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestError = err as { status: number; message: string };
        const shouldRetry =
          requestError.status === 0 ||
          requestError.status === 502 ||
          requestError.status === 503 ||
          requestError.status === 504;

        if (shouldRetry && attempt < MAX_RETRIES) {
          const delay = attempt * 2000;
          console.warn(
            `Upload attempt ${attempt} failed (${requestError.message}). Retrying in ${delay / 1000}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(requestError.message || "Upload failed after retries");
      }
    }
  };

  const handleBatchUpload = async (fileList: FileList, folderName?: string) => {
    setIsDragOver(false);
    setUploading(true);

    let totalSize = 0;
    Array.from(fileList).forEach((f) => (totalSize += f.size));

    setUploadProgress({
      loaded: 0,
      total: totalSize,
      startTime: Date.now(),
      count: 0,
      totalCount: fileList.length,
    });

    try {
      let targetFolderId = currentFolder ? currentFolder.id : "root";

      if (folderName) {
        const folderRes = await createFolder(
          folderName,
          targetFolderId === "root" ? undefined : targetFolderId,
          tab === "team" ? "TEAM_MONAD" : undefined,
        );
        if (!folderRes.success)
          throw new Error("Folder creation failed. Aborting upload.");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetFolderId = (folderRes.folder as any).id;
      }

      let uploadedTotalGlobal = 0;
      const CHUNK_SIZE = 50 * 1024 * 1024;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        if (file.size > CHUNK_SIZE) {
          // Chunked Upload
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          let recordId: string | null = null;

          for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
            const start = chunkIdx * CHUNK_SIZE;
            const end = Math.min(file.size, start + CHUNK_SIZE);
            const chunkBlob = file.slice(start, end);
            const chunkName = `${file.name}.part${(chunkIdx + 1).toString().padStart(3, "0")}`;

            const formData = new FormData();
            formData.append("file", chunkBlob, chunkName);
            formData.append("isTeam", tab === "team" ? "true" : "false");
            if (targetFolderId !== "root")
              formData.append("folder", targetFolderId);

            if (chunkIdx === 0) {
              formData.append("name", file.name);
              formData.append("size", file.size.toString());
            } else if (recordId) {
              formData.append("recordId", recordId);
            }

            const result = (await uploadFileClient(formData, (loaded) => {
              const currentTotal = uploadedTotalGlobal + start + loaded;
              setUploadProgress((prev) =>
                prev ? { ...prev, loaded: currentTotal } : null,
              );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            })) as { id: string; record: FileRecord };

            if (chunkIdx === 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              recordId = (result as any).record.id;
            }
          }
          uploadedTotalGlobal += file.size;
        } else {
          // Standard Upload
          const formData = new FormData();
          formData.append("file", file);
          formData.append("isTeam", tab === "team" ? "true" : "false");
          if (targetFolderId !== "root")
            formData.append("folder", targetFolderId);
          formData.append("name", file.name);
          formData.append("size", file.size.toString());

          await uploadFileClient(formData, (loaded) => {
            const currentTotal = uploadedTotalGlobal + loaded;
            setUploadProgress((prev) =>
              prev ? { ...prev, loaded: currentTotal } : null,
            );
          });
          uploadedTotalGlobal += file.size;
        }

        setUploadProgress((prev) =>
          prev ? { ...prev, count: i + 1, loaded: uploadedTotalGlobal } : null,
        );
      }
    } catch (err: unknown) {
      console.error("Upload failed", err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      alert(`업로드 실패: ${(err as any).message || "Unknown error"}`);
    } finally {
      setUploadProgress(null);
      setUploading(false);
      refreshFiles();
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUploadInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleUploadProcess(files);
  };

  const handleUploadProcess = async (files: FileList) => {
    if (files.length > 1) {
      const confirmGroup = confirm(`Create folder for ${files.length} files?`);
      if (confirmGroup) {
        const folderName = prompt("Folder Name:", "New Folder");
        if (folderName) {
          await handleBatchUpload(files, folderName);
          return;
        }
      }
    }
    await handleBatchUpload(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleUploadProcess(e.dataTransfer.files);
  };

  return {
    uploading,
    uploadProgress,
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleUploadInput,
    fileInputRef,
    handleBatchUpload, // Exported in case needed manually
  };
}
