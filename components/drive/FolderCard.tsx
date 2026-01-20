/**
 * @file components/drive/FolderCard.tsx
 * @purpose Renders a single folder item in Grid or List view.
 * @scope Visual representation, context menu triggers.
 */
import { Folder as FolderIcon, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FolderRecord } from "./types";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"; // Adjust path if needed

interface FolderCardProps {
  folder: FolderRecord;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onDelete: () => void;
  onRename: () => void;
}

export default function FolderCard({ folder, viewMode, onClick, onDelete, onRename }: FolderCardProps) {
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
