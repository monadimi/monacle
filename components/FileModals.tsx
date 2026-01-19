"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Download, Trash2, Globe, Lock, Share2, X, Music, FileText, FolderInput } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { updateFileShare, updateFile, listFiles, updateFolder } from "@/app/actions/cloud";

import { FileRecord, FolderRecord } from "./drive/types";

export function FileDetailModal({
  file,
  isOpen,
  onClose,
  onDownload,
  onDelete
}: {
  file: FileRecord | null,
  isOpen: boolean,
  onClose: () => void,
  onDownload?: () => void,
  onDelete?: () => void
}) {
  // derive variables safely
  // Add cache buster to prevent sticky Content-Disposition headers from previous requests
  // Use file.created/updated as stable cache key
  const timestamp = file && 'updated' in file ? new Date(file.updated).getTime() : 0;

  const rawFile = file && 'file' in file ? (Array.isArray(file.file) ? file.file[0] : file.file) : null;

  const fileUrl = rawFile
    ? `/api/proxy/file/${file?.collectionId}/${file?.id}/${rawFile}?v=${timestamp}`
    : null;

  const ext = rawFile?.split('.').pop()?.toLowerCase();
  const isImage = ext?.match(/^(jpg|jpeg|png|gif|webp|svg)$/);

  const isVideo = ext?.match(/^(mp4|webm|ogg|mov)$/);
  const isAudio = ext?.match(/^(mp3|wav|ogg)$/);
  const isPDF = ext === 'pdf';
  const isText = ext?.match(/^(txt|md|json|js|ts|tsx|css|html)$/);

  const [textContent, setTextContent] = useState<string>("");

  useEffect(() => {
    if (isOpen && isText && fileUrl) {
      fetch(fileUrl).then(res => res.text()).then(setTextContent).catch(() => setTextContent("Failed to load content"));
    }
  }, [isOpen, isText, fileUrl]);

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl p-0 overflow-hidden gap-0 rounded-3xl h-[80vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>File Details</DialogTitle>
        </DialogHeader>

        {/* Preview Area (Expanded) */}
        <div className="bg-slate-900/90 relative flex-1 flex items-center justify-center p-0 overflow-hidden">
          {isImage && fileUrl ? (
            <img src={fileUrl} alt="preview" className="max-w-full max-h-full object-contain" />
          ) : isVideo && fileUrl ? (
            <video src={fileUrl} controls className="max-w-full max-h-full" />
          ) : isAudio && fileUrl ? (
            <div className="flex flex-col items-center gap-4 p-10 bg-black/50 rounded-3xl backdrop-blur-md">
              <Music className="w-16 h-16 text-indigo-400 animate-pulse" />
              <audio src={fileUrl} controls />
            </div>
          ) : isPDF && fileUrl ? (
            <iframe src={fileUrl} className="w-full h-full" title="PDF Preview" />
          ) : isText ? (
            <pre className="w-full h-full overflow-auto p-8 text-sm font-mono text-slate-300 bg-black/50">
              {textContent || "Loading..."}
            </pre>
          ) : (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center shadow-sm backdrop-blur-sm">
                <FileText className="w-10 h-10 opacity-50" />
              </div>
              <p>미리보기를 지원하지 않는 형식입니다</p>
            </div>
          )}

          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white/70 hover:text-white transition-colors z-10" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Area (Compact Footer) */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase shrink-0">
              {ext || "?"}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-800 truncate max-w-md" title={file.name || rawFile || ""}>
                {file.name || rawFile}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{new Date(file.created).toLocaleDateString()}</span>
                <span>•</span>
                <span>{file.expand?.owner?.name || file.owner}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {onDownload && (
              <button onClick={onDownload} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors">
                <Download className="w-4 h-4" /> Download
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="p-2.5 hover:bg-red-50 rounded-xl text-red-500 transition-colors" title="Delete">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RenameModal({
  isOpen,
  onClose,
  file,
  onUpdate
}: {
  isOpen: boolean,
  onClose: () => void,
  file: FileRecord | FolderRecord | null,
  onUpdate: () => void
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper to determine if it is a folder (check for 'file' property or specific folder props)
  // Folder has no 'file' array usually in this schema, or we rely on duck typing
  const isFolder = file && !('file' in file) && !file.collectionId?.includes('cloud');

  useEffect(() => {
    if (file) {
      if (isFolder) {
        setName(file.name || "");
      } else {
        // File logic
        const f = file as FileRecord;
        const rawF = Array.isArray(f.file) ? f.file[0] : f.file;
        const initialName = f.name || (rawF ? rawF.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1') : "");
        setName(initialName);
      }
    }
  }, [file, isFolder]);

  const handleSubmit = async () => {
    if (!file || !name.trim()) return;
    setLoading(true);
    try {
      let result;
      if (isFolder) {
        result = await updateFolder(file.id, { name: name });
      } else {
        result = await updateFile(file.id, { name: name });
      }

      if (!result.success) throw new Error(result.error);
      onUpdate();
      onClose();
    } catch (e: unknown) {
      alert("이름 변경 실패: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm bg-white rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>이름 변경</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter') handleSubmit();
            }}
            aria-label="New name"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? "변경 중..." : "확인"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MoveModal({
  isOpen,
  onClose,
  file,
  onUpdate
}: {
  isOpen: boolean,
  onClose: () => void,
  file: FileRecord | null,
  onUpdate: () => void
}) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderRecord[]>([]); // Changed from any[]
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [history, setHistory] = useState<string[]>([]); // To track back navigation

  const fetchFolders = useCallback(async (parentId: string | null) => {
    setLoading(true);
    try {
      // Reuse listFiles but we only care about folders. 
      const ownerFilter = file?.owner === "TEAM_MONAD" || file?.owner?.includes("team") ? "TEAM_MONAD" : undefined;

      const result = await listFiles(1, 100, {
        folderId: parentId || "root",
        filter: ownerFilter ? `owner = "${ownerFilter}"` : undefined
      });

      if (result.success) {
        setFolders((result.folders || []) as unknown as FolderRecord[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [file]);

  useEffect(() => {
    if (currentFolderId || currentFolderId === "") {
      fetchFolders(currentFolderId === "" ? "root" : currentFolderId);
    }
  }, [currentFolderId, fetchFolders]);

  useEffect(() => {
    if (isOpen) {
      setCurrentFolderId(null);
      setHistory([]);
      fetchFolders(null);
    }
  }, [isOpen]);



  const handleEnterFolder = (folder: FolderRecord) => { // Changed folder type
    setHistory([...history, currentFolderId || "root"]);
    setCurrentFolderId(folder.id);
    fetchFolders(folder.id);
  };

  const handleGoUp = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prev = newHistory.pop();
    setHistory(newHistory);
    const prevId = prev === "root" ? null : prev;
    setCurrentFolderId(prevId || null);
    fetchFolders(prevId || null);
  };

  const handleMove = async () => {
    if (!file) return;
    if (!currentFolderId && currentFolderId !== null) {
      // check only if strictly undefined or empty string if that was the semantic, 
      // but currentFolderId initializes to null usually?
      // In component: const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
      // Wait, if it is null, it means Root.
      // So !currentFolderId is true for null.
      // We want to allow null.

      // Actually the previous validation was:
      // if (!currentFolderId && currentFolderId !== "") { alert... }
      // This implies explicit "" was allowed?

      // Let's rely on explicit UI selection.
      // If the user clicked "Move Here", and currentFolderId is null, it means Root.
      // So this validation might be blocking root moves if not careful.
      // Let's remove it if it blocks null.

    }
    // Logic: 
    // If currentFolderId is null -> Root.
    // We pass "" to server for Root.

    // So the check should be: are we 'ready'?
    // Defaults to null (Ready at root).
    // So we don't need to force selection if we default to root.

    // But if we want to force user to 'select' something?
    // With the new UI, "Root" is selected by default or explicitly.
    // So let's allow it.

    if (file.id === currentFolderId) return; // Can't move into self (if it was a folder)

    setMoving(true);
    try {
      const result = await updateFile(file.id, { folder: currentFolderId || "" }); // Empty string for root
      if (!result.success) throw new Error(result.error);
      onUpdate();
      onClose();
    } catch (e: unknown) {
      alert("이동 실패: " + (e as Error).message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 h-[500px] flex flex-col">
        <DialogHeader>
          <DialogTitle>이동할 위치 선택</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 border rounded-xl mt-4 bg-slate-50">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <div className="mb-2 pb-2 border-b border-slate-100">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className={`w-full text-left px-4 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors ${currentFolderId === null
                    ? "bg-slate-200 text-slate-900 border-2 border-slate-300"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  <FolderInput className="w-4 h-4 text-slate-400 fill-current" />
                  최상위 경로 (Root)
                </button>
              </div>

              {currentFolderId && (
                <button
                  onClick={handleGoUp}
                  className="w-full text-left px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors mb-1"
                >
                  <FolderInput className="w-4 h-4 ml-1 rotate-180" /> .. (상위 폴더)
                </button>
              )}

              {folders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  하위 폴더가 없습니다
                </div>
              ) : (
                folders.map((folder: FolderRecord) => (
                  <button
                    key={folder.id}
                    onClick={() => handleEnterFolder(folder)}
                    disabled={folder.id === file?.id}
                    className="w-full text-left px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
                  >
                    <FolderInput className="w-4 h-4 text-amber-400 fill-current" />
                    <span className="truncate flex-1">{folder.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            취소
          </button>
          <button
            onClick={handleMove}
            disabled={moving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:bg-slate-300"
          >
            {moving ? "이동 중..." : "여기로 이동"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export function ShareModal({
  file,
  isOpen,
  onClose,
  onUpdate
}: {
  file: FileRecord | null,
  isOpen: boolean,
  onClose: () => void,
  onUpdate: () => void // trigger refresh
}) {
  const [shortId, setShortId] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [shareType, setShareType] = useState("view");

  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [originalShortId, setOriginalShortId] = useState("");

  useEffect(() => {
    if (file) {
      const sid = file.short_id || Math.random().toString(36).substring(7);
      setShortId(sid);
      setOriginalShortId(sid);
      setIsShared(file.is_shared || file.share_type !== 'none');
      setShareType(file.share_type === 'none' ? 'view' : file.share_type);
    }
  }, [file]);

  if (!file) return null;

  // Use requested domain
  const shareUrl = `https://cloud.monad.io.kr/share/${shortId}`;

  const handleToggleShare = async () => {
    const newSharedState = !isShared;
    setIsShared(newSharedState); // Optimistic update

    try {
      // Don't change other fields, just toggle
      const result = await updateFileShare(file.id, {
        is_shared: newSharedState,
        share_type: newSharedState ? shareType : 'none',
        short_id: shortId // Keep current slug
      });

      if (!result.success) {
        setIsShared(!newSharedState); // Revert
        alert(result.error);
      } else {
        onUpdate();
      }
    } catch { // removed unused 'e'
      alert("공유 설정 변경 실패");
    }
  };

  const handleSaveSlug = async () => {
    if (shortId === originalShortId) return;

    setIsSavingSlug(true);
    try {
      const result = await updateFileShare(file.id, {
        is_shared: isShared,
        share_type: isShared ? shareType : 'none',
        short_id: shortId
      });

      if (!result.success) {
        alert(result.error);
      } else {
        setOriginalShortId(shortId);
        onUpdate();
      }
    } catch {
      alert("링크 주소 저장 실패");
    } finally {
      setIsSavingSlug(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("링크가 복사되었습니다!");
    } catch {
      alert("링크 복사 실패");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 min-w-0">
            <Share2 className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="truncate">
              &quot;{file.name || (Array.isArray(file.file) ? file.file[0] : file.file)?.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1')}&quot; 공유
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-colors", isShared ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400")}>
                {isShared ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-semibold text-slate-900">공개 액세스</p>
                <p className="text-xs text-slate-500">{isShared ? "링크가 있는 모든 사용자가 볼 수 있습니다" : "나만 볼 수 있습니다 (비공개)"}</p>
              </div>
            </div>
            <button
              onClick={handleToggleShare}
              className={cn("w-12 h-6 rounded-full relative transition-colors duration-300 focus:outline-none", isShared ? "bg-emerald-500" : "bg-slate-300")}
              aria-label="Toggle public access"
            >
              <div className={cn("w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-300", isShared ? "left-[26px]" : "left-0.5")} />
            </button>
          </div>

          <AnimatePresence>
            {isShared && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                {/* Custom Slug */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">커스텀 링크 주소</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center bg-slate-100/50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                      <span className="text-slate-400 text-sm whitespace-nowrap mr-1">cloud.monad.io.kr/share/</span>
                      <input
                        value={shortId}
                        onChange={(e) => setShortId(e.target.value)}
                        className="bg-transparent outline-none w-full text-slate-800 font-medium text-sm"
                        placeholder="custom-name"
                      />
                    </div>
                    {/* Inline Save Button */}
                    <AnimatePresence>
                      {shortId !== originalShortId && (
                        <motion.button
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          onClick={handleSaveSlug}
                          disabled={isSavingSlug}
                          className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 transition-colors disabled:opacity-50"
                          title="Save Slug"
                        >
                          {isSavingSlug ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <div className="w-5 h-5 font-bold">✓</div>
                          )}
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Copy Link */}
                <div className="flex gap-2">
                  <button onClick={copyLink} className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl font-bold transition-colors text-sm">
                    <Copy className="w-4 h-4" /> 링크 복사
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
