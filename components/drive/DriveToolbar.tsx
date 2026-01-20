/**
 * @file components/drive/DriveToolbar.tsx
 * @purpose Toolbar containing Search, Filter, Sort, and Upload controls.
 * @scope managing view state inputs and triggering upload modal/input.
 * @out-of-scope File list rendering.
 */
import { Loader2, Upload, Grid, List as ListIcon, FolderInput, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterType, SortType } from "./hooks/useDriveData";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface DriveToolbarProps {
  search: string;
  setSearch: (s: string) => void;
  filterType: FilterType;
  setFilterType: (f: FilterType) => void;
  sort: SortType;
  setSort: (s: SortType) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (v: 'grid' | 'list') => void;
  setIsNewFolderOpen: (o: boolean) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUploadInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function DriveToolbar({
  filterType, setFilterType,
  sort, setSort,
  viewMode, setViewMode,
  setIsNewFolderOpen,
  uploading,
  fileInputRef,
  handleUploadInput
}: DriveToolbarProps) {
  return (
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
  );
}
