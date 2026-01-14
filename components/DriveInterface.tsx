"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import pb from "@/lib/pocketbase";
import {
  Search, Upload, File as FileIcon, Trash2,
  Share2, Grid, List as ListIcon,
  LogOut, User, FolderOpen, Loader2, Folder as FolderIcon, Plus, ChevronRight, Home, ArrowUp, Users, ArrowUpDown, Filter, MoreVertical, Edit2, FolderInput
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { uploadFile, listFiles, deleteFile, createFolder, deleteFolder } from "@/app/actions/cloud";
import { FileDetailModal, ShareModal, MoveModal, RenameModal } from "@/components/FileModals";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

// ... Types (FileRecord, FolderRecord) can be imported or redefined. Keeping inline for single file edit simplicity if not shared.
// Ideally share types. For now redefining locally to match FileModals.
type FileRecord = {
  id: string;
  collectionId: string;
  collectionName: string;
  file: string[];
  owner: string;
  share_type: 'none' | 'view' | 'edit';
  created: string;
  updated: string;
  is_shared: boolean;
  short_id?: string;
  size?: number; // Added size if available from PB info
  name?: string; // Added name
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
};

export default function DriveInterface({ user }: { user: { id: string; email: string; name: string; token: string } }) {
  const router = useRouter();
  const [tab, setTab] = useState<'personal' | 'team'>('personal');
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderRecord | null>(null);
  const [folderPath, setFolderPath] = useState<FolderRecord[]>([]);

  // Initialize PocketBase Auth
  useEffect(() => {
    if (user?.token) {
      pb.authStore.save(user.token, user as any);
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

  // Fetch Files & Folders
  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try {
      const ownerFilter = tab === 'personal'
        ? `owner = "${user.id}"`
        : `owner = "TEAM_MONAD"`;

      let filter = ownerFilter;

      // Search
      if (search) {
        filter += ` && (file ~ "${search}" || name ~ "${search}")`;
      }

      // Category Filter (Applying PB Syntax roughly)
      if (filterType === 'image') {
        filter += ` && (file ~ '.jpg' || file ~ '.jpeg' || file ~ '.png' || file ~ '.gif' || file ~ '.webp' || file ~ '.svg')`;
      } else if (filterType === 'video') {
        filter += ` && (file ~ '.mp4' || file ~ '.mov' || file ~ '.webm')`;
      } else if (filterType === 'doc') {
        filter += ` && (file ~ '.pdf' || file ~ '.doc' || file ~ '.txt' || file ~ '.md' || file ~ '.json')`;
      }

      const result = await listFiles(1, 50, {
        sort: sort,
        filter: filter,
        folderId: currentFolder?.id || "root"
      });

      if (result.success) {
        setFiles(result.items as unknown as FileRecord[]);
        setFolders(result.folders as unknown as FolderRecord[]);
      } else {
        throw new Error(result.error);
      }

    } catch (err) {
      console.error("Failed to fetch files", err);
    } finally {
      setLoading(false);
    }
  }, [tab, search, user, currentFolder, sort, filterType]);

  useEffect(() => {
    refreshFiles();
    setNewFolderName("");
  }, [refreshFiles]);

  // Folder Navigation
  const handleEnterFolder = (folder: FolderRecord) => {
    setFolderPath([...folderPath, folder]);
    setCurrentFolder(folder);
    setSearch("");
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
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const result = await createFolder(
        newFolderName,
        currentFolder?.id || null,
        tab === 'team' ? "TEAM_MONAD" : undefined
      );

      if (!result.success) throw new Error(result.error);

      setIsNewFolderOpen(false);
      setNewFolderName("");
      refreshFiles();
    } catch (e: any) {
      alert("폴더 생성 실패: " + e.message);
    }
  };

  // Handlers
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement> | FileList) => {
    const fileList = e instanceof Event || (e as any).target ? (e as React.ChangeEvent<HTMLInputElement>).target.files : e as FileList;
    if (!fileList?.length) return;

    setUploading(true);
    setIsDragOver(false);

    try {
      const formData = new FormData();
      Array.from(fileList).forEach((file) => {
        formData.append('file', file);
      });

      formData.append('owner', tab === 'personal' ? (user.id || user.email) : "TEAM_MONAD");
      formData.append('is_shared', tab === 'team' ? 'true' : 'false');
      formData.append('share_type', tab === 'team' ? 'view' : 'none');

      if (currentFolder) {
        formData.append('folder', currentFolder.id);
      } else {
        formData.append('folder', 'root');
      }

      formData.append('name', fileList[0].name);
      formData.append('short_id', Math.random().toString(36).substring(7));

      const result = await uploadFile(formData);

      if (!result.success) {
        throw { message: result.error, data: result.details };
      }

      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (err: any) {
      console.error("Upload failed", err);
      alert(`업로드 실패: ${err.message}`);
    } finally {
      setUploading(false);
      refreshFiles();
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

  // Context Actions
  const handleShare = (record: FileRecord) => { setShareFile(record); setIsShareOpen(true); };
  const handleMove = (record: FileRecord) => { setMoveFile(record); setIsMoveOpen(true); };
  const handleRename = (record: FileRecord) => { setRenameFile(record); setIsRenameOpen(true); };

  const handleFileClick = (record: FileRecord) => {
    setSelectedFile(record);
    setIsDetailOpen(true);
  };

  const handleDownload = (file: FileRecord) => {
    if (!file.file[0]) return;
    const url = `/api/proxy/file/${file.collectionId}/${file.id}/${file.file[0]}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = (file.name || file.file[0]).replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); handleUpload(e.dataTransfer.files); };

  return (
    <div
      className="flex flex-col h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6 relative"
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

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <FolderOpen className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Monacle 드라이브</h1>
            <p className="text-slate-500 text-sm font-medium">{user.name}님, 환영합니다</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative group flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="파일 검색..."
              className="w-full bg-white/50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none transition-all shadow-sm"
            />
          </div>
          <button onClick={() => router.push('/')} className="p-2.5 rounded-xl hover:bg-white/50 text-slate-500 hover:text-red-500 transition-colors" aria-label="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Controls & Nav */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex p-1 bg-slate-200/50 rounded-xl">
              <TabButton active={tab === 'personal'} onClick={() => { setTab('personal'); setCurrentFolder(null); setFolderPath([]); }}>
                <User className="w-4 h-4" /> 내 드라이브
              </TabButton>
              <TabButton active={tab === 'team'} onClick={() => { setTab('team'); setCurrentFolder(null); setFolderPath([]); }}>
                <Users className="w-4 h-4" /> 팀 스페이스
              </TabButton>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(['all', 'image', 'video', 'doc'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-colors border",
                    filterType === f
                      ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {f === 'all' ? '전체' : f === 'image' ? '이미지' : f === 'video' ? '동영상' : '문서'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end xl:self-auto">
            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
                  <ArrowUpDown className="w-4 h-4" />
                  {sort === '-created' ? '최신순' : sort === 'name' ? '이름순' : '정렬'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-xl p-1 min-w-[150px]">
                <DropdownMenuItem onClick={() => setSort('-created')} className="rounded-lg text-sm text-slate-600">최신순</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('created')} className="rounded-lg text-sm text-slate-600">오래된순</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSort('name')} className="rounded-lg text-sm text-slate-600">이름순 (A-Z)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('-name')} className="rounded-lg text-sm text-slate-600">이름순 (Z-A)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-8 bg-slate-200 mx-1" />

            <button onClick={() => setIsNewFolderOpen(true)} className="px-4 py-2 bg-white text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 sm:text-sm text-xs whitespace-nowrap">
              <Plus className="w-4 h-4 text-indigo-500" /> 폴더 생성
            </button>

            <div className="flex bg-slate-200/50 rounded-lg p-0.5 shrink-0">
              <button onClick={() => setViewMode('grid')} className={cn("p-2 rounded-md transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500")}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500")}>
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            <label className="cursor-pointer bg-slate-900 hover:bg-black text-white px-4 py-2.5 rounded-xl font-bold custom-shadow flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-slate-900/20 sm:text-sm text-xs whitespace-nowrap ml-2">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>업로드</span>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500 overflow-x-auto pb-2">
          <button
            onClick={() => handleNavigateUp(-1)}
            className={cn("flex items-center gap-1 hover:text-indigo-600 transition-colors", !currentFolder && "font-bold text-indigo-600")}
          >
            <Home className="w-4 h-4" /> {tab === 'personal' ? '내 드라이브' : '팀 스페이스'}
          </button>
          {folderPath.map((folder, index) => (
            <div key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <button
                onClick={() => handleNavigateUp(index)}
                className={cn("hover:text-indigo-600 transition-colors whitespace-nowrap", index === folderPath.length - 1 && "font-bold text-indigo-600")}
              >
                {folder.name}
              </button>
            </div>
          ))}
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
        ) : (
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
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

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

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2", active ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>
      {children}
    </button>
  )
}

function FolderCard({ folder, viewMode, onClick, onDelete }: { folder: FolderRecord, viewMode: 'grid' | 'list', onClick: () => void, onDelete: () => void }) {
  return (
    <div onClick={onClick} className={cn("group relative bg-amber-50/50 border border-amber-100 rounded-2xl overflow-hidden hover:shadow-lg hover:border-amber-300 hover:bg-amber-50 transition-all cursor-pointer select-none", viewMode === 'list' ? "flex items-center p-3 gap-4 h-16" : "flex flex-col aspect-[4/5]")}>
      <div className={cn("flex items-center justify-center text-amber-400 transition-transform group-hover:scale-110", viewMode === 'list' ? "w-10" : "flex-1")}>
        <FolderIcon className={cn("fill-current", viewMode === 'list' ? "w-8 h-8" : "w-16 h-16")} />
      </div>
      <div className={cn("p-3", viewMode === 'list' && "flex-1 flex justify-between items-center")}>
        <div className="min-w-0 text-center md:text-left">
          <h3 className="font-bold text-slate-700 text-sm truncate">{folder.name}</h3>
          {viewMode === 'grid' && <p className="text-[10px] text-slate-400 mt-0.5">{new Date(folder.created).toLocaleDateString()}</p>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function FileCard({ file, viewMode, onDelete, onShare, onMove, onRename, onClick }: { file: FileRecord, viewMode: 'grid' | 'list', onDelete: () => void, onShare: () => void, onMove: () => void, onRename: () => void, onClick: () => void }) {
  const fileUrl = file.file && file.file.length > 0 ? `/api/proxy/file/${file.collectionId}/${file.id}/${file.file[0]}` : null;
  const isImage = file.file && file.file[0]?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
  const displayName = file.name || file.file?.[0]?.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1') || "Untitled";

  return (
    <div className={cn("group relative bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer", viewMode === 'list' ? "flex items-center p-3 gap-4" : "flex flex-col aspect-[4/5]")} onClick={onClick}>
      <div className={cn("bg-slate-50 flex items-center justify-center overflow-hidden relative", viewMode === 'list' ? "w-12 h-12 rounded-lg" : "flex-1")}>
        {isImage && fileUrl ? <img src={fileUrl} alt="preview" className="w-full h-full object-cover" /> : <FileIcon className="text-indigo-300 w-1/3 h-1/3" />}
        {viewMode === 'grid' && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); window.open(fileUrl!, '_blank') }} className="p-2 bg-white/20 hover:bg-white rounded-full text-white hover:text-indigo-600 backdrop-blur-md" aria-label="Open">
              <Search className="w-4 h-4" />
            </button>
            {/* Added More Options Button */}
          </div>
        )}
      </div>
      <div className={cn("p-3", viewMode === 'list' && "flex-1 flex justify-between items-center")}>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-700 text-sm truncate" title={file.file?.[0]}>{displayName}</h3>
          <p className="text-xs text-slate-400 mt-1">{new Date(file.created).toLocaleDateString()}</p>
        </div>
        <div className={cn("flex items-center gap-1", viewMode === 'grid' ? "mt-2 justify-end" : "")}>
          {/* Context Menu Hook */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
                <Share2 className="w-4 h-4 mr-2" /> 공유
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
                <Edit2 className="w-4 h-4 mr-2" /> 이름 변경
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }}>
                <FolderInput className="w-4 h-4 mr-2" /> 이동
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-500 hover:text-red-600">
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
