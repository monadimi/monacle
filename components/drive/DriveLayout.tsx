/**
 * @file components/drive/DriveLayout.tsx
 * @purpose Main structural layout for the Drive interface.
 * @scope Sidebar navigation, Storage usage display, Main content wrapper.
 * @out-of-scope Business logic, File rendering.
 */
import { ReactNode } from "react";
import { User, Users, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { DriveTab } from "./hooks/useDriveData";

interface DriveLayoutProps {
  tab: DriveTab;
  setTab: (t: DriveTab) => void;
  storageUsed: number;
  children: ReactNode;
  header: ReactNode;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export default function DriveLayout({
  tab,
  setTab,
  storageUsed,
  children,
  header,
  onDrop,
  onDragOver,
  onDragLeave,
  isDragging
}: DriveLayoutProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div
      className="flex h-screen w-full bg-slate-50 relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 hidden md:flex">
        <div className="p-6">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-indigo-600" />
            Monacle Drive
          </h2>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button
            onClick={() => setTab('personal')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              tab === 'personal' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <User className="w-4 h-4" />
            내 드라이브
          </button>

          <button
            onClick={() => setTab('team')}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 h-full relative">
        {header}
        {children}

        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-indigo-500/10 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-indigo-500 border-dashed m-4 rounded-3xl pointer-events-none">
            <div className="bg-white/90 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-bounce">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                <HardDrive className="w-8 h-8" />
              </div>
              <p className="text-xl font-bold text-indigo-700">여기에 놓아 업로드</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
