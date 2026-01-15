"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import pb from "@/lib/pocketbase";
import {
  Search, Upload, File as FileIcon, Trash2,
  Share2, Grid, List as ListIcon,
  User, FolderOpen, Loader2, Folder as FolderIcon, ChevronRight, Home, ArrowUp, Users, ArrowUpDown, MoreVertical, Edit2, FolderInput, HardDrive, RefreshCw, DatabaseBackup
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { listFiles, deleteFile, createFolder, deleteFolder, getStorageUsage } from "@/app/actions/cloud";
import { FileDetailModal, ShareModal, MoveModal, RenameModal } from "@/components/FileModals";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu";

import { localDrive } from "@/lib/local-drive";
import { getDeltaUpdates, getSchemaVersion } from "@/app/actions/sync";

// ... Types (FileRecord, FolderRecord) can be imported or redefined. Keeping inline for single file edit simplicity if not shared.
// Ideally share types. For now redefining locally to match FileModals.
type FileRecord = {
  id: string;
  collectionId: string;
  collectionName: string;
  file: string[] | string; // Can be string (single) or array (multiple/chunked)
  owner: string;
  share_type: 'none' | 'view' | 'edit';
  created: string;
  updated: string;
  is_shared: boolean;
  short_id?: string;
  size?: number;
  name?: string;
  folder?: string; // Added folder field
  tVersion?: number; // Added tVersion
  expand?: {
    owner?: {
      name?: string;
      email?: string;
    }
  };
};

type FolderRecord = {
  id: string;
  name: string;
  owner: string;
  parent: string;
  created: string;
  updated: string;
  tVersion?: number; // Added tVersion
};

export default function DriveInterface({ user }: { user: { id: string; email: string; name: string; token: string } }) {

  const [tab, setTab] = useState<'personal' | 'team'>('personal');
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderRecord | null>(null);
  const [folderPath, setFolderPath] = useState<FolderRecord[]>([]);

  // Storage Usage
  const [storageUsed, setStorageUsed] = useState(0);

  // Upload Progress State
  const [uploadProgress, setUploadProgress] = useState<{
    loaded: number;
    total: number;
    startTime: number;
    count: number;
    totalCount: number;
  } | null>(null);

  // Initialize PocketBase Auth
  useEffect(() => {
    if (user?.token) {
      // @ts-expect-error - User object has partial overlap with RecordModel
      pb.authStore.save(user.token, user);
    }
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Advanced Sort & Filter
  const [sort, setSort] = useState<'-created' | 'created' | 'name' | '-name'>('-created');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'doc'>('all');

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Modals
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [shareFile, setShareFile] = useState<FileRecord | null>(null);
  const [moveFile, setMoveFile] = useState<FileRecord | null>(null);
  const [renameFile, setRenameFile] = useState<FileRecord | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PER_PAGE = 24; // ~20 items

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return '계산 중...';
    if (seconds < 60) return `${Math.ceil(seconds)}초`;
    const mins = Math.floor(seconds / 60);
    return `${mins}분 ${Math.ceil(seconds % 60)}초`;
  };

  // Fetch Storage Usage
  const refreshStorage = useCallback(async () => {
    const res = await getStorageUsage(tab === 'team');
    if (res.success) {
      setStorageUsed(res.totalBytes || 0);
    }
  }, [tab]);

  // --- Sync & Load Logic ---
  const loadFromLocal = useCallback(async () => {
    if (!user?.id) return;

    let allFiles = await localDrive.getAllFiles();
    let allFolders = await localDrive.getAllFolders();

    // Owner Filter
    if (tab === 'personal') {
      allFiles = allFiles.filter((f: any) => f.owner === user.id);
      allFolders = allFolders.filter((f: any) => f.owner === user.id);
    } else {
      // Team: Assume anything not me is shared/team. 
      // Ideally should check team ID, but for now this matches "Team Space" concept roughly?
      // Actually user.id owned files can also be in team folders?
      // Let's stick to simple: Personal = My ID, Team = Not My ID.
      allFiles = allFiles.filter((f: any) => f.owner !== user.id);
      allFolders = allFolders.filter((f: any) => f.owner !== user.id);
    }

    // Folder Filter
    const currentId = currentFolder ? currentFolder.id : "";
    const filteredFiles = allFiles.filter((f: any) => (f.folder || "") === currentId);
    const filteredFolders = allFolders.filter((f: any) => (f.parent || "") === currentId);

    // Search & Type Filter
    let finalFiles = filteredFiles;
    let finalFolders = filteredFolders;

    if (search) {
      finalFiles = allFiles.filter((f: any) => f.name.toLowerCase().includes(search.toLowerCase()));
      // Search across all folders usually? Or current?
      // Standard behavior: Search usually searches globally or recursively.
      // Let's search ALL files matching owner.
      finalFiles = allFiles.filter((f: any) => f.name.toLowerCase().includes(search.toLowerCase()));
      finalFolders = allFolders.filter((f: any) => f.name.toLowerCase().includes(search.toLowerCase()));
    } else if (filterType !== 'all') {
      finalFiles = finalFiles.filter((f: any) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (filterType === 'image') return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
        if (filterType === 'video') return ['mp4', 'mov', 'webm'].includes(ext || '');
        if (filterType === 'doc') return ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '');
        return true;
      });
      finalFolders = []; // Don't show folders in type filter
    }

    // Sort
    const sortFn = (a: any, b: any) => {
      if (sort === '-created') return new Date(b.created).getTime() - new Date(a.created).getTime();
      if (sort === 'created') return new Date(a.created).getTime() - new Date(b.created).getTime();
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === '-name') return b.name.localeCompare(a.name);
      return 0;
    };

    setFiles(finalFiles.sort(sortFn));
    setFolders(finalFolders.sort(sortFn));
    setLoading(false);
  }, [tab, currentFolder, search, filterType, sort, user]);

  const syncFiles = useCallback(async (retryCount = 0) => {
    try {
      // Don't set loading true here to avoid flickering if we have local data?
      // Maybe only on first load?
      // setLoading(true); 

      const localVer = await localDrive.getSyncVersion();
      const localSchemaVer = await localDrive.getSchemaVersion();
      const filterMode = tab === 'team' ? 'team' : 'personal';

      // 1. Check Schema Version
      const schemaRes = await getSchemaVersion();
      if (schemaRes.success && schemaRes.version !== localSchemaVer) {
        console.log(`Schema version mismatch (Local: ${localSchemaVer}, Server: ${schemaRes.version}). Resetting...`);
        await localDrive.clearAll();
        await localDrive.setSchemaVersion(schemaRes.version);
        // Recurse to start sync from version 0
        return syncFiles(retryCount + 1);
      }

      const { success, hasUpdates, version, changes, error, resetRequired } = await getDeltaUpdates(localVer, filterMode);

      if (success) {
        if (resetRequired) {
          console.log("Local version too old or invalid. Resetting...");
          await localDrive.clearAll();
          // Pass retryCount check? No, resetRequired is explicit instruction. But we can limit loops just in case.
          if (retryCount > 2) {
            console.error("Too many resets. Aborting.");
            return;
          }
          return syncFiles(retryCount + 1);
        }

        if (hasUpdates && changes) {
          // 1. Delete
          const deletedIds = changes.deleted.map((d: any) => d.targetId);
          if (deletedIds.length > 0) {
            await localDrive.deleteFiles(deletedIds);
            await localDrive.deleteFolders(deletedIds);
          }

          // 2. Upsert
          await localDrive.saveFiles(changes.files);
          await localDrive.saveFolders(changes.folders);

          // 3. Update Version
          if (version) await localDrive.setSyncVersion(version);

          // Refresh View
          loadFromLocal();
          refreshStorage();
        }
      } else {
        throw new Error(error || "Sync returned unsuccess");
      }
    } catch (e) {
      console.error("Sync Exception:", e);
      // Silent Fallback: If partial sync failed, try full reset once
      if (retryCount === 0) {
        console.log("Partial sync failed. Attempting full reset fallback...", e);
        try {
          await localDrive.clearAll();
          return syncFiles(1);
        } catch (resetError) {
          console.error("Fallback reset also failed:", resetError);
        }
      }
    }
  }, [tab, loadFromLocal]);

  // Initial Load & Query Effects
  useEffect(() => {
    loadFromLocal();
  }, [loadFromLocal]);

  // Trigger Sync on mount/tab change
  useEffect(() => {
    syncFiles();
  }, [syncFiles]);

  // Wrapper for manual refresh calls
  // Wrapper for manual refresh calls
  const refreshFiles = () => {
    syncFiles();
  };

  const handleSyncNow = async () => {
    setLoading(true);
    await syncFiles();
    setLoading(false);
  };

  const handleHardReset = async () => {
    if (!confirm("주의: 로컬 데이터를 모두 지우고 서버에서 새로 받아옵니다.\n이 작업은 서버 부하를 유발할 수 있습니다.\n계속하시겠습니까?")) return;

    setLoading(true);
    try {
      await localDrive.clearAll();
      await syncFiles(); // Will fetch from version 0
      alert("데이터를 새로 받아왔습니다.");
    } catch (e) {
      console.error(e);
      alert("초기화 실패");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    setPage(1);
    setNewFolderName("");
  }, [tab, search, currentFolder, sort, filterType]);

  // Re-fetch when page changes (controlled by pagination UI)



  // ... navigation ...
  const handleEnterFolder = (folder: FolderRecord) => {
    setFolderPath([...folderPath, folder]);
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

  // Create Folder


  const handleReloadFile = async (file: FileRecord) => {
    setLoading(true); // Maybe use a separate loading state for card? But global is safer to prevent interaction.
    try {
      // Fetch fresh record from PB
      const freshRecord = await pb.collection(file.collectionName || "cloud").getOne(file.id);
      // Update local DB
      await localDrive.saveFiles([freshRecord]);
      // Recalculate view
      loadFromLocal();
    } catch (e: any) {
      // If 404, it means file is deleted on server. Remove from local.
      if (e?.status === 404) {
        await localDrive.deleteFiles([file.id]);
        loadFromLocal();
        alert("서버에서 삭제된 파일입니다. 로컬 목록에서 제거했습니다.");
      } else {
        console.error("Reload file failed:", e);
        alert("파일 정보를 갱신하지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const result = await createFolder(
        newFolderName,
        currentFolder?.id || undefined,
        tab === 'team' ? "TEAM_MONAD" : undefined
      );

      if (!result.success) throw new Error(result.error);

      setIsNewFolderOpen(false);
      setNewFolderName("");
      refreshFiles();
    } catch (e: unknown) {
      alert("폴더 생성 실패: " + (e as Error).message);
    }
  };

  // Handlers
  // Client-side uploader with retries
  const uploadFileClient = async (formData: FormData, onProgress: (loaded: number) => void) => {
    const MAX_RETRIES = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/drive/upload', true);

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
                reject({ status: xhr.status, message: res.error || xhr.statusText });
              } catch {
                reject({ status: xhr.status, message: xhr.statusText || 'Upload failed' });
              }
            }
          };

          xhr.onerror = () => reject({ status: 0, message: 'Network error' });
          xhr.send(formData);
        });
      } catch (err: any) {
        lastError = err;
        // Retry only on specific server/gateway errors (0 is network error, 502, 503, 504 are temporary)
        const shouldRetry = err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;

        if (shouldRetry && attempt < MAX_RETRIES) {
          const delay = attempt * 2000; // 2s, 4s... backoff
          console.warn(`Upload attempt ${attempt} failed (${err.message}). Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(err.message || "Upload failed after retries");
      }
    }
  };

  const handleBatchUpload = async (fileList: FileList, folderName?: string) => {
    setIsDragOver(false);
    setUploading(true);

    // Calculate total size
    let totalSize = 0;
    Array.from(fileList).forEach(f => totalSize += f.size);

    setUploadProgress({
      loaded: 0,
      total: totalSize,
      startTime: Date.now(),
      count: 0,
      totalCount: fileList.length
    });

    try {
      let targetFolderId = currentFolder ? currentFolder.id : "root";

      // If creating a new folder for these files
      if (folderName) {
        const folderRes = await createFolder(
          folderName,
          targetFolderId === "root" ? undefined : targetFolderId,
          tab === 'team' ? "TEAM_MONAD" : undefined
        );
        if (!folderRes.success) throw new Error("폴더 생성 실패. 업로드를 중단합니다.");
        targetFolderId = folderRes.folder!.id;
      }

      let uploadedTotalGlobal = 0;

      // Sequential upload to track accurate total progress
      // CHUNK SIZE: 50MB (Safe for 100MB Cloudflare limit)
      const CHUNK_SIZE = 50 * 1024 * 1024;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        // Check if splitting is needed
        if (file.size > CHUNK_SIZE) {
          // Split Upload
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          let recordId: string | null = null;

          for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
            const start = chunkIdx * CHUNK_SIZE;
            const end = Math.min(file.size, start + CHUNK_SIZE);
            const chunkBlob = file.slice(start, end);
            const chunkName = `${file.name}.part${(chunkIdx + 1).toString().padStart(3, '0')}`;

            const formData = new FormData();
            formData.append('file', chunkBlob, chunkName);
            formData.append('isTeam', tab === 'team' ? 'true' : 'false');
            if (targetFolderId !== "root") formData.append('folder', targetFolderId);
            // Also pass original name logic if needed? 
            // But simplified: First chunk creates record with Name. Subsequent updates it? 
            // PB doesn't let us easily rename the "record" name via API upload unless we pass 'name' field.
            // Pass 'name' field only on first chunk?
            if (chunkIdx === 0) {
              formData.append('name', file.name);
              formData.append('size', file.size.toString());
            } else if (recordId) {
              formData.append('recordId', recordId);
            }

            const result: any = await uploadFileClient(formData, (loaded) => {
              // Progress for this chunk
              // Global loaded = uploadedTotalGlobal + start + loaded
              const currentTotal = uploadedTotalGlobal + start + loaded;
              setUploadProgress(prev => prev ? { ...prev, loaded: currentTotal } : null);
            });

            if (chunkIdx === 0) {
              recordId = result.record.id;
            }
          }
          uploadedTotalGlobal += file.size;
        } else {
          // Standard Single Upload
          const formData = new FormData();
          formData.append('file', file);
          formData.append('isTeam', tab === 'team' ? 'true' : 'false');
          if (targetFolderId !== "root") formData.append('folder', targetFolderId);
          formData.append('name', file.name);
          formData.append('size', file.size.toString());

          await uploadFileClient(formData, (loaded) => {
            const currentTotal = uploadedTotalGlobal + loaded;
            setUploadProgress(prev => prev ? { ...prev, loaded: currentTotal } : null);
          });
          uploadedTotalGlobal += file.size;
        }

        setUploadProgress(prev => prev ? { ...prev, count: i + 1, loaded: uploadedTotalGlobal } : null);
      }

    } catch (err: unknown) {
      console.error("Upload failed", err);
      // @ts-expect-error - Error type is unknown
      alert(`업로드 실패: ${err.message || "Unknown error"}`);
    } finally {
      setUploadProgress(null);
      setUploading(false);
      refreshFiles();
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  const handleUploadInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleUploadProcess(files);
  };

  const handleUploadProcess = async (files: FileList) => {
    // 1. Folder Upload (detected via webkitRelativePath usually, but here we trigger via button)
    // If we just want "Folder Upload" logic, the input (directory) gives us nested files.
    // If user dragged a folder, files[0] might have path. 

    // Check if it's a batch upload of loose files ( > 1)
    if (files.length > 1) {
      // Check if likely a folder upload (webkitRelativePath present and has slashes)
      // Actually browser flattens folder structure into FileList.
      // The user request: "Ask user: individual or create folder?"
      const confirmGroup = confirm(`선택된 ${files.length}개의 파일을 위해 새 폴더를 만드시겠습니까?\n\n[확인] = 새 폴더에 묶어서 업로드\n[취소] = 현재 위치에 개별 업로드`);

      if (confirmGroup) {
        const folderName = prompt("새 폴더 이름을 입력하세요:", "새 폴더");
        if (folderName) {
          await handleBatchUpload(files, folderName);
          return;
        }
      }
    }

    // Fallback: Individual upload (or cancelled folder creation -> individual)
    await handleBatchUpload(files);
  };

  // Handlers for inputs
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Delete Handler
  const handleDelete = async (id: string, type: 'file' | 'folder') => {
    if (!confirm(`정말 이 ${type === 'file' ? '파일' : '폴더'}을 삭제하시겠습니까?`)) return;
    try {
      const result = type === 'file' ? await deleteFile(id) : await deleteFolder(id);
      if (!result.success) throw new Error(result.error);
      refreshFiles();
    } catch (err) {
      console.error("Delete failed", err);
      alert("삭제 실패");
    }
  };

  // Context Actions follow ...
  const handleShare = (record: FileRecord) => { setShareFile(record); setIsShareOpen(true); };
  const handleMove = (record: FileRecord) => { setMoveFile(record); setIsMoveOpen(true); };
  const handleRename = (record: FileRecord) => { setRenameFile(record); setIsRenameOpen(true); };

  const handleFileClick = (record: FileRecord) => {
    setSelectedFile(record);
    setIsDetailOpen(true);
  };
  const handleDownload = (file: FileRecord) => {
    let rawFile = file.file;
    if (Array.isArray(rawFile)) rawFile = rawFile[0];
    if (!rawFile) return;

    const url = `/api/proxy/file/${file.collectionId}/${file.id}/${rawFile}?filename=${encodeURIComponent(file.name || rawFile.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1'))}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || rawFile.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); handleUploadProcess(e.dataTransfer.files); };

  return (
    <div
      className="flex h-screen w-full bg-slate-50 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop Zone Overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-indigo-500/10 backdrop-blur-sm border-4 border-dashed border-indigo-500 rounded-3xl flex flex-col items-center justify-center pointer-events-none"
          >
            <Upload className="w-20 h-20 text-indigo-600 animate-bounce" />
            <p className="text-2xl font-bold text-indigo-700 mt-4">여기에 파일을 놓으세요</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 hidden md:flex">
        <div className="p-6">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-indigo-600" />
            Monacle Drive
          </h2>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button
            onClick={() => { setTab('personal'); setCurrentFolder(null); setFolderPath([]); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              tab === 'personal' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <User className="w-4 h-4" />
            내 드라이브
          </button>

          <button
            onClick={() => { setTab('team'); setCurrentFolder(null); setFolderPath([]); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              tab === 'team' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Users className="w-4 h-4" />
            팀 스페이스
          </button>

          <div className="pt-6 mt-4 border-t border-slate-100">
            <div className="px-3 text-xs font-bold text-slate-400 mb-2 uppercase">Storage</div>
            <div className="px-3 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">사용 용량</div>
                <div className="text-sm font-bold text-slate-700">{formatBytes(storageUsed)}</div>
              </div>
            </div>
          </div>
        </nav>


      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 h-full">
        {/* Header / Top Bar */}
        <header className="h-16 px-6 border-b border-slate-200/50 bg-white/50 backdrop-blur-xl flex items-center justify-between shrink-0 z-10">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-slate-500 overflow-hidden">
            <button
              onClick={() => handleNavigateUp(-1)}
              className={cn("flex items-center gap-1 hover:text-indigo-600 transition-colors shrink-0", !currentFolder && "font-bold text-indigo-600")}
            >
              <Home className="w-4 h-4" /> {tab === 'personal' ? '내 드라이브' : '팀 스페이스'}
            </button>
            {folderPath.map((folder, index) => (
              <div key={folder.id} className="flex items-center gap-2 shrink-0">
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <button
                  onClick={() => handleNavigateUp(index)}
                  className={cn("hover:text-indigo-600 transition-colors whitespace-nowrap max-w-[150px] truncate", index === folderPath.length - 1 && "font-bold text-indigo-600")}
                >
                  {folder.name}
                </button>
              </div>
            ))}
          </div>

          {/* Search & Global Actions */}
          <div className="flex items-center gap-3">
            <div className="relative group w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="파일 검색..."
                className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 border rounded-xl pl-10 pr-4 py-2 text-sm outline-none transition-all"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl p-1">
                <DropdownMenuItem onClick={handleSyncNow} disabled={loading} className="gap-2 p-2.5 rounded-lg text-slate-600 focus:text-indigo-600 focus:bg-indigo-50">
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                  <span className="font-medium">지금 동기화</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleHardReset} disabled={loading} className="gap-2 p-2.5 rounded-lg text-red-500 focus:text-red-600 focus:bg-red-50">
                  <DatabaseBackup className="w-4 h-4" />
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">데이터 새로 받아오기</span>
                    <span className="text-[10px] text-red-400/80">로컬 데이터를 초기화합니다</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Toolbar (Filter & Actions) */}
        <div className="px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0">
          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(['all', 'image', 'video', 'doc'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-colors border",
                  filterType === f
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
              >
                {f === 'all' ? '전체' : f === 'image' ? '이미지' : f === 'video' ? '동영상' : '문서'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
                  <ArrowUpDown className="w-4 h-4" />
                  {sort === '-created' ? '최신순' : sort === 'name' ? '이름순' : '정렬'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-xl p-1 min-w-[150px]" sideOffset={5} align="end">
                <DropdownMenuItem onClick={() => setSort('-created')} className="rounded-lg text-sm text-slate-600">최신순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('created')} className="rounded-lg text-sm text-slate-600">오래된순</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSort('name')} className="rounded-lg text-sm text-slate-600">이름순 (A-Z)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('-name')} className="rounded-lg text-sm text-slate-600">이름순 (Z-A)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode('grid')} className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-slate-900" : "text-slate-400")}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow-sm text-slate-900" : "text-slate-400")}>
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 ml-2">
              <button onClick={() => setIsNewFolderOpen(true)} className="p-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors" title="새 폴더">
                <FolderInput className="w-5 h-5 text-indigo-500" />
              </button>

              <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-indigo-500/20 sm:text-sm text-xs whitespace-nowrap">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>업로드</span>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUploadInput} disabled={uploading} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 glass-panel rounded-3xl p-6 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-3xl">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          )}

          {files.length === 0 && folders.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <FolderOpen className="w-16 h-16 opacity-20" />
              <p>이 폴더는 비어있습니다</p>
            </div>
          ) : (<>
            <div className={cn(
              "grid gap-4 pb-20",
              viewMode === 'grid' ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1"
            )}>
              {/* Go Up Button */}
              {currentFolder && (
                <div
                  onClick={() => handleNavigateUp(folderPath.length - 2)}
                  className={cn(
                    "group bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors",
                    viewMode === 'list' && "p-3 justify-start gap-4 h-16"
                  )}
                >
                  <ArrowUp className="w-6 h-6" />
                  {viewMode === 'list' && <span className="font-semibold">.. (상위 폴더)</span>}
                </div>
              )}

              <AnimatePresence>
                {folders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    viewMode={viewMode}
                    onClick={() => handleEnterFolder(folder)}
                    onDelete={() => handleDelete(folder.id, 'folder')}
                    onRename={() => handleRename(folder as unknown as FileRecord)}
                  />
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {files.map(file => (
                  <FileCard
                    key={file.id}
                    file={file}
                    viewMode={viewMode}
                    onDelete={() => handleDelete(file.id, 'file')}
                    onShare={() => handleShare(file)}
                    onMove={() => handleMove(file)}
                    onRename={() => handleRename(file)}
                    onClick={() => handleFileClick(file)}
                    onReload={() => handleReloadFile(file)}
                  />
                ))}
              </AnimatePresence>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 py-4 border-t border-slate-100">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  이전
                </button>
                <span className="text-sm font-bold text-slate-600 px-2">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </>)}
        </div>
      </div>

      {/* Upload Progress Toast */}
      <AnimatePresence>
        {uploadProgress && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 w-80 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl z-[100] border border-slate-700"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm flex items-center gap-2">
                {uploadProgress.loaded === uploadProgress.total ? <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> : <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
                {uploadProgress.loaded === uploadProgress.total ? "업로드 완료" : "업로드 중..."}
              </span>
              <span className="text-xs text-slate-400">{uploadProgress.count} / {uploadProgress.totalCount}</span>
            </div>

            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>{formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}</span>
              <span>
                {(() => {
                  const elapsed = (Date.now() - uploadProgress.startTime) / 1000;
                  if (elapsed < 1 || uploadProgress.loaded === 0) return '계산 중...';
                  const rate = uploadProgress.loaded / elapsed; // bytes per second
                  const remainingBytes = uploadProgress.total - uploadProgress.loaded;
                  const remainingSeconds = remainingBytes / rate;
                  return remainingSeconds < 0 ? '완료' : formatDuration(remainingSeconds) + ' 남음';
                })()}
              </span>
            </div>

            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
              <motion.div
                className="h-full bg-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (uploadProgress.loaded / uploadProgress.total) * 100)}%` }}
                transition={{ type: 'tween', ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <FileDetailModal
        file={selectedFile}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onDownload={() => selectedFile && handleDownload(selectedFile)}
        onDelete={() => { if (selectedFile) handleDelete(selectedFile.id, 'file'); setIsDetailOpen(false); }}
      />
      <ShareModal file={shareFile} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} onUpdate={refreshFiles} />
      <MoveModal file={moveFile} isOpen={isMoveOpen} onClose={() => setIsMoveOpen(false)} onUpdate={refreshFiles} />
      <RenameModal file={renameFile} isOpen={isRenameOpen} onClose={() => setIsRenameOpen(false)} onUpdate={refreshFiles} />

      {/* New Folder Modal */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="sm:max-w-xs bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>새 폴더</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="폴더 이름"
              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') handleCreateFolder();
              }}
            />
            <button onClick={handleCreateFolder} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors">
              생성하기
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



function FolderCard({ folder, viewMode, onClick, onDelete, onRename }: { folder: FolderRecord, viewMode: 'grid' | 'list', onClick: () => void, onDelete: () => void, onRename: () => void }) {
  return (
    <div onClick={onClick} className={cn("group relative bg-amber-50/50 border border-amber-100 rounded-2xl hover:shadow-lg hover:border-amber-300 hover:bg-amber-50 transition-all cursor-pointer select-none z-0 hover:z-10", viewMode === 'list' ? "flex items-center p-3 gap-4 h-16" : "flex flex-col aspect-[4/5]")}>
      <div className={cn("flex items-center justify-center text-amber-400 transition-transform group-hover:scale-110", viewMode === 'list' ? "w-10" : "flex-1")}>
        <FolderIcon className={cn("fill-current", viewMode === 'list' ? "w-8 h-8" : "w-16 h-16")} />
      </div>
      <div className={cn("p-3", viewMode === 'list' && "flex-1 flex justify-between items-center")}>
        <div className="min-w-0 md:text-left">
          <h3 className="font-bold text-slate-700 text-sm truncate">{folder.name}</h3>
          {viewMode === 'grid' && <p className="text-[10px] text-slate-400 mt-0.5">{new Date(folder.created).toLocaleDateString()}</p>}
        </div>

        {/* Folder Context Menu */}
        <div onClick={(e) => e.stopPropagation()} className={cn("flex items-center gap-1", viewMode === 'grid' ? "mt-2 justify-end" : "")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 opacity-0 group-hover:opacity-100 hover:bg-amber-100 rounded-lg text-amber-500/70 hover:text-amber-600 transition-all" aria-label="Folder options">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={5}>
              <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRename(); }}>
                <Edit2 className="w-4 h-4 mr-2" /> 이름 변경
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }} className="text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4 mr-2" /> 삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

function FileCard({ file, viewMode, onDelete, onShare, onMove, onRename, onClick, onReload }: { file: FileRecord, viewMode: 'grid' | 'list', onDelete: () => void, onShare: () => void, onMove: () => void, onRename: () => void, onClick: () => void, onReload: () => void }) {
  // Use lazy loading and thumbnail size for grid view optimization
  // PocketBase supports ?thumb=100x100 etc. passed to proxy
  // Proxy passes all params to PB.
  // We use 300x300 for grid cards (actually 400x500 to be safe for retina)

  const rawFile = Array.isArray(file.file) ? file.file[0] : file.file;

  const timestamp = new Date(file.updated).getTime();
  const fileUrl = rawFile ? `/api/proxy/file/${file.collectionId}/${file.id}/${rawFile}?thumb=400x500&v=${timestamp}` : null;
  const isImage = rawFile?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
  const displayName = file.name || rawFile?.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1') || "Untitled";

  return (
    <div className={cn("group relative bg-white border border-slate-100 rounded-2xl hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer z-0 hover:z-10", viewMode === 'list' ? "flex items-center p-3 gap-4" : "flex flex-col aspect-[4/5]")} onClick={onClick}>
      <div className={cn("bg-slate-50 flex items-center justify-center overflow-hidden relative", viewMode === 'list' ? "w-12 h-12 rounded-lg" : "flex-1 rounded-t-2xl")}>
        {isImage && fileUrl ? (
          <img
            src={fileUrl}
            alt="preview"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <FileIcon className="text-indigo-300 w-1/3 h-1/3" />
        )}
        {viewMode === 'grid' && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); if (fileUrl) window.open(fileUrl.split('?')[0], '_blank') }} className="p-2 bg-white/20 hover:bg-white rounded-full text-white hover:text-indigo-600 backdrop-blur-md" aria-label="Open">
              <Search className="w-4 h-4" />
            </button>
            {/* Added More Options Button in hover overlay if needed, but context menu is better */}
          </div>
        )}
      </div>
      <div className={cn("p-3", viewMode === 'list' && "flex-1 flex justify-between items-center")}>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-700 text-sm truncate" title={rawFile || ""}>{displayName}</h3>
          <p className="text-xs text-slate-400 mt-1">{new Date(file.created).toLocaleDateString()}</p>
        </div>
        <div className={cn("flex items-center gap-1", viewMode === 'grid' ? "mt-2 justify-end" : "")}>
          {/* Context Menu Hook */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-400" aria-label="File options">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={5}>
              <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onShare(); }}>
                <Share2 className="w-4 h-4 mr-2" /> 공유
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRename(); }}>
                <Edit2 className="w-4 h-4 mr-2" /> 이름 변경
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onMove(); }}>
                <FolderInput className="w-4 h-4 mr-2" /> 이동
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onReload(); }}>
                <RefreshCw className="w-4 h-4 mr-2" /> 새로고침
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }} className="text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4 mr-2" /> 삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {file.share_type !== 'none' && <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold backdrop-blur-sm shadow-lg">{file.share_type.toUpperCase()}</div>}
    </div>
  )
}
