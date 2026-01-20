/**
 * @file components/DriveInterface.tsx
 * @purpose Controller component for the Drive page.
 * @scope Coordinating state, layout, upload, and file actions.
 * @out-of-scope Detailed UI rendering (cards/layout), Data fetching internals (hooks).
 * @failure-behavior Displays error toasts/alerts via action handlers.
 */
"use client";

import { useState } from "react";
import { FolderOpen, ArrowUp, Loader2 } from "lucide-react"; // Remaining icons used in main view
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Hooks & Types
import { useDriveData } from "./drive/hooks/useDriveData";
import { useDriveUpload } from "./drive/hooks/useDriveUpload";
import { FileRecord } from "./drive/types";

// UI Components
import DriveLayout from "./drive/DriveLayout";
import DriveToolbar from "./drive/DriveToolbar";
import FileCard from "./drive/FileCard";
import FolderCard from "./drive/FolderCard";
import DriveShell from "./drive/DriveShell";

// Modals & Actions
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDetailModal, ShareModal, MoveModal, RenameModal } from "@/components/FileModals";
import { deleteFile } from "@/app/actions/file";
import { createFolder, deleteFolder } from "@/app/actions/folder";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { RefreshCw, DatabaseBackup, Terminal } from "lucide-react";
import { localDrive } from "@/lib/local-drive";

export default function DriveInterface({ user }: { user: { id: string; email: string; name: string; token: string } }) {
  // 1. Data Hook
  const {
    tab, setTab,
    files, folders, rawFolders,
    currentFolder,
    folderPath,
    storageUsed,
    loading, setLoading,
    search, setSearch,
    viewMode, setViewMode,
    sort, setSort,
    filterType, setFilterType,
    page, setPage, totalPages,
    handleEnterFolder,
    handleNavigateUp,
    refreshFiles,
    reloadFile
  } = useDriveData(user);

  // 2. Upload Hook
  const {
    uploading,
    uploadProgress,
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleUploadInput,
    fileInputRef
  } = useDriveUpload({ currentFolder, tab, refreshFiles });

  // 3. Local UI State (Modals)
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
  const [isShellEnabled, setIsShellEnabled] = useState(false);

  // 4. Action Handlers
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

  const handleDownload = (file: FileRecord) => {
    let rawFile = file.file;
    if (Array.isArray(rawFile)) rawFile = rawFile[0];
    if (!rawFile) return;

    const collectionKey = file.collectionName || file.collectionId || "cloud";
    const url = `/api/proxy/file/${collectionKey}/${file.id}/${rawFile}?filename=${encodeURIComponent(file.name || rawFile.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1'))}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || rawFile.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Header Actions (MoreVertical Menu)
  const handleSyncNow = async () => {
    setLoading(true);
    await refreshFiles();
    setLoading(false);
  };

  const handleHardReset = async () => {
    if (!confirm("주의: 로컬 데이터를 모두 지우고 서버에서 새로 받아옵니다.\n이 작업은 서버 부하를 유발할 수 있습니다.\n계속하시겠습니까?")) return;
    setLoading(true);
    try {
      await localDrive.clearAll();
      await refreshFiles();
      alert("데이터를 새로 받아왔습니다.");
    } catch (e) {
      console.error(e);
      alert("초기화 실패");
    } finally {
      setLoading(false);
    }
  };


  const headerContent = (
    <header className="h-16 px-6 border-b border-slate-200/50 bg-white/50 backdrop-blur-xl flex items-center justify-between shrink-0 z-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-slate-500 overflow-hidden">
        <button
          onClick={() => handleNavigateUp(-1)}
          className={cn("flex items-center gap-1 hover:text-indigo-600 transition-colors shrink-0", !currentFolder && "font-bold text-indigo-600")}
        >
          {tab === 'personal' ? '내 드라이브' : '팀 스페이스'}
        </button>
        {folderPath.map((folder, index) => (
          <div key={folder.id} className="flex items-center gap-2 shrink-0">
            {/* Using text char instead of ChevronRight for simplicity or import it */}
            <span className="text-slate-400">/</span>
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="파일 검색..."
            className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 border rounded-xl px-4 py-2 text-sm outline-none transition-all"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <span className="sr-only">Menu</span>
              <div className="flex flex-col gap-0.5">
                <div className="w-1 h-1 bg-current rounded-full" />
                <div className="w-1 h-1 bg-current rounded-full" />
                <div className="w-1 h-1 bg-current rounded-full" />
              </div>
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
            <DropdownMenuItem onClick={() => setIsShellEnabled(!isShellEnabled)} className="gap-2 p-2.5 rounded-lg text-slate-600 focus:text-indigo-600 focus:bg-indigo-50">
              <Terminal className="w-4 h-4" />
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-medium">드라이브 쉘 (실험적)</span>
                <span className="text-[10px] text-slate-400">객체 파이프라인 인터페이스 {isShellEnabled ? '(ON)' : '(OFF)'}</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );

  return (
    <DriveLayout
      tab={tab}
      setTab={setTab}
      storageUsed={storageUsed}
      header={headerContent}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      isDragging={isDragOver}
    >
      <DriveToolbar
        search={search} setSearch={setSearch}
        filterType={filterType} setFilterType={setFilterType}
        sort={sort} setSort={setSort}
        viewMode={viewMode} setViewMode={setViewMode}
        setIsNewFolderOpen={setIsNewFolderOpen}
        uploading={uploading}
        fileInputRef={fileInputRef}
        handleUploadInput={handleUploadInput}
      />

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
        ) : (
          <>
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
                    onRename={() => { setRenameFile(folder as unknown as FileRecord); setIsRenameOpen(true); }}
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
                    onShare={() => { setShareFile(file); setIsShareOpen(true); }}
                    onMove={() => { setMoveFile(file); setIsMoveOpen(true); }}
                    onRename={() => { setRenameFile(file); setIsRenameOpen(true); }}
                    onClick={() => { setSelectedFile(file); setIsDetailOpen(true); }}
                    onReload={() => reloadFile(file)}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
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
          </>
        )}
      </div>

      {/* Upload Toast */}
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

      <DriveShell
        isOpen={isShellEnabled}
        onClose={() => setIsShellEnabled(false)}
        files={files}
        viewFolders={folders}
        allFolders={rawFolders}
        currentFolder={currentFolder}
        onRefresh={refreshFiles}
      />
    </DriveLayout>
  );
}
