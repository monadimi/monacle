/**
 * @file components/drive/hooks/useDriveData.ts
 * @purpose Manages the state and synchronization of files and folders in the Drive.
 * @scope State (files, folders, current path), Fetching (local DB + Sync), Filtering, Sorting, Pagination.
 * @out-of-scope UI rendering, File Uploads, Modal state.
 * @failure-behavior Retries sync on failure, falls back to local data, alerts on critical refresh failures.
 */
import { useState, useEffect, useCallback } from "react";
import pb from "@/lib/pocketbase";
import { localDrive } from "@/lib/local-drive";
import { getDeltaUpdates, getSchemaVersion } from "@/app/actions/sync";
import { getStorageUsage } from "@/app/actions/cloud";
import { FileRecord, FolderRecord } from "../types";

export type DriveTab = "personal" | "team";
export type FilterType = "all" | "image" | "video" | "doc";
export type SortType = "-created" | "created" | "name" | "-name";

export function useDriveData(user: {
  id: string;
  email: string;
  token: string;
}) {
  const [tab, setTab] = useState<DriveTab>("personal");
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [rawFolders, setRawFolders] = useState<FolderRecord[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderRecord | null>(null);
  const [folderPath, setFolderPath] = useState<FolderRecord[]>([]);

  const [storageUsed, setStorageUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [sort, setSort] = useState<SortType>("-created");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Initialize Auth
  useEffect(() => {
    if (user?.token) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      pb.authStore.save(user.token, user);
    }
  }, [user]);

  // Fetch Storage Usage
  const refreshStorage = useCallback(async () => {
    const res = await getStorageUsage(tab === "team");
    if (res.success) {
      setStorageUsed(res.totalBytes || 0);
    }
  }, [tab]);

  // Load from Local DB
  const loadFromLocal = useCallback(async () => {
    if (!user?.id) return;

    let allFiles = await localDrive.getAllFiles();
    let allFolders = await localDrive.getAllFolders();
    setRawFolders(allFolders);

    if (tab === "personal") {
      allFiles = allFiles.filter((f: FileRecord) => f.owner === user.id);
      allFolders = allFolders.filter((f: FolderRecord) => f.owner === user.id);
    } else {
      allFiles = allFiles.filter((f: FileRecord) => f.owner !== user.id);
      allFolders = allFolders.filter((f: FolderRecord) => f.owner !== user.id);
    }

    const currentId = currentFolder ? currentFolder.id : "";
    const filteredFiles = allFiles.filter(
      (f) => (f.folder || "") === currentId,
    );
    const filteredFolders = allFolders.filter(
      (f) => (f.parent || "") === currentId,
    );

    let finalFiles = filteredFiles;
    let finalFolders = filteredFolders;

    if (search) {
      // Global search within scope
      finalFiles = allFiles.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase()),
      );
      finalFolders = allFolders.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase()),
      );
    } else if (filterType !== "all") {
      finalFiles = finalFiles.filter((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase();
        if (filterType === "image")
          return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
            ext || "",
          );
        if (filterType === "video")
          return ["mp4", "mov", "webm"].includes(ext || "");
        if (filterType === "doc")
          return ["pdf", "doc", "docx", "txt", "md"].includes(ext || "");
        return true;
      });
      finalFolders = [];
    }

    const sortFn = (
      a: FileRecord | FolderRecord,
      b: FileRecord | FolderRecord,
    ) => {
      if (sort === "-created")
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      if (sort === "created")
        return new Date(a.created).getTime() - new Date(b.created).getTime();
      const aName = a.name || "";
      const bName = b.name || "";
      if (sort === "name") return aName.localeCompare(bName);
      if (sort === "-name") return bName.localeCompare(aName);
      return 0;
    };

    setFiles(finalFiles.sort(sortFn));
    setFolders(finalFolders.sort(sortFn));
    setLoading(false); // Initial load done
  }, [tab, currentFolder, search, filterType, sort, user]);

  useEffect(() => {
    setTotalPages(Math.max(1, Math.ceil(files.length / 50)));
  }, [files]);

  // Sync Logic
  const syncFiles = useCallback(
    async (retryCount = 0) => {
      try {
        const localVer = await localDrive.getSyncVersion();
        const localSchemaVer = await localDrive.getSchemaVersion();
        const filterMode = tab === "team" ? "team" : "personal";

        const schemaRes = await getSchemaVersion();
        if (schemaRes.success && schemaRes.version !== localSchemaVer) {
          console.log(`Schema mismatch. Resetting...`);
          await localDrive.clearAll();
          await localDrive.setSchemaVersion(schemaRes.version);
          return syncFiles(retryCount + 1);
        }

        const { success, hasUpdates, version, changes, error, resetRequired } =
          await getDeltaUpdates(localVer, filterMode);

        if (success) {
          if (resetRequired) {
            if (retryCount > 2) return;
            await localDrive.clearAll();
            return syncFiles(retryCount + 1);
          }

          if (hasUpdates && changes) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const deletedIds = changes.deleted.map((d: any) => d.targetId);
            if (deletedIds.length > 0) {
              await localDrive.deleteFiles(deletedIds);
              await localDrive.deleteFolders(deletedIds);
            }
            await localDrive.saveFiles(changes.files);
            await localDrive.saveFolders(changes.folders);
            if (version) await localDrive.setSyncVersion(version);

            loadFromLocal();
            refreshStorage();
          }
        } else {
          throw new Error(error || "Sync unsuccess");
        }
      } catch (e) {
        console.error("Sync Exception:", e);
        if (retryCount === 0) {
          try {
            await localDrive.clearAll();
            return syncFiles(1);
          } catch {}
        }
      }
    },
    [tab, loadFromLocal, refreshStorage],
  );

  // Effects
  useEffect(() => {
    loadFromLocal();
  }, [loadFromLocal]);
  useEffect(() => {
    syncFiles();
  }, [syncFiles]);
  useEffect(() => {
    setPage(1);
  }, [tab, search, currentFolder, sort, filterType]);

  // Navigation
  const handleEnterFolder = (folder: FolderRecord) => {
    setFolderPath((prev) => [...prev, folder]);
    setCurrentFolder(folder);
    setSearch("");
    setPage(1);
  };

  const handleNavigateUp = (index: number) => {
    if (index === -1) {
      setFolderPath([]);
      setCurrentFolder(null);
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setCurrentFolder(newPath[newPath.length - 1]);
    }
    setPage(1);
  };

  const reloadFile = async (file: FileRecord) => {
    setLoading(true);
    try {
      const freshRecord = await pb
        .collection(file.collectionName || "cloud")
        .getOne(file.id);
      await localDrive.saveFiles([freshRecord]);
      loadFromLocal();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.status === 404) {
        await localDrive.deleteFiles([file.id]);
        loadFromLocal();
        alert("Server deleted this file.");
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    // State
    tab,
    setTab,
    files,
    folders,
    rawFolders,
    currentFolder,
    setCurrentFolder,
    folderPath,
    setFolderPath,
    storageUsed,
    loading,
    setLoading,
    search,
    setSearch,
    viewMode,
    setViewMode,
    sort,
    setSort,
    filterType,
    setFilterType,
    page,
    setPage,
    totalPages,

    // Actions
    handleEnterFolder,
    handleNavigateUp,
    refreshFiles: syncFiles,
    refreshStorage,
    reloadFile,
  };
}
