/**
 * @file components/drive/FileCard.tsx
 * @purpose Renders a single file item in Grid or List view.
 * @scope Visual representation, thumbnail display, context menu triggers.
 */
import { File as FileIcon, Search, MoreVertical, Share2, Edit2, FolderInput, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileRecord } from "./types";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface FileCardProps {
  file: FileRecord;
  viewMode: 'grid' | 'list';
  onDelete: () => void;
  onShare: () => void;
  onMove: () => void;
  onRename: () => void;
  onClick: () => void;
  onReload: () => void;
}

export default function FileCard({ file, viewMode, onDelete, onShare, onMove, onRename, onClick, onReload }: FileCardProps) {

  const rawFile = Array.isArray(file.file) ? file.file[0] : file.file;

  const timestamp = new Date(file.updated).getTime();
  const collectionKey = file.collectionName || file.collectionId || "cloud";
  const fileUrl = rawFile ? `/api/proxy/file/${collectionKey}/${file.id}/${rawFile}?thumb=400x500&v=${timestamp}` : null;
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
          </div>
        )}
      </div>
      <div className={cn("p-3", viewMode === 'list' && "flex-1 flex justify-between items-center")}>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-700 text-sm truncate" title={rawFile || ""}>{displayName}</h3>
          <p className="text-xs text-slate-400 mt-1">{new Date(file.created).toLocaleDateString()}</p>
        </div>
        <div className={cn("flex items-center gap-1", viewMode === 'grid' ? "mt-2 justify-end" : "")}>
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
      {file.share_type !== 'none' && <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold backdrop-blur-sm shadow-lg">{file.share_type?.toUpperCase()}</div>}
    </div>
  )
}
