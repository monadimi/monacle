/**
 * @file components/cowork/Ideaboard.tsx
 * @purpose Infinite canvas whiteboard for visual collaboration.
 * @scope Vector Drawing, sticky notes, shapes, image uploads, real-time board sync.
 * @out-of-scope Document text editing, complex relational data (Sheet).
 * @failure-behavior Optimistic updates with rollback on conflict.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Minus,
  Hand,
  MousePointer2,
  StickyNote,
  Circle,
  Square,
  Trash2,
  RefreshCcw,
  Link2,
  Eraser,
  ChevronLeft,
  Share2,
  Pencil,
  Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import pb from "@/lib/pocketbase";
import { updateBoard, toggleSharing, uploadBoardImage } from "@/app/actions/cowork";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, CheckSquare } from "lucide-react";
import { usePresence } from "./hooks/usePresence";

interface BoardElement {
  id: string;
  type: 'sticky' | 'shape' | 'path' | 'connection' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  content: string;
  authorId: string;
  shapeType?: 'circle' | 'square';
  pathData?: string; // For path type
  points?: { x: number, y: number }[]; // For temporary drawing
  zIndex?: number;
  from?: string; // For connection type
  to?: string;   // For connection type
  imageUrl?: string; // For image type
}

interface BoardData {
  id: string;
  title: string;
  elements: BoardElement[];
  author: string;
  updated: string;
  is_shared: boolean;
  share_type: string;
  share_team?: boolean;
  tVersion: number;
  lastClientId: string;
  images?: string[]; // Files in the PB record
}

interface IdeaboardProps {
  initialData: BoardData;
  currentUser: { id: string; email: string; name: string; avatar?: string };
  readOnly?: boolean;
}

const COLORS = [
  "#fef08a", // yellow
  "#bfdbfe", // blue
  "#bbf7d0", // green
  "#fecaca", // red
  "#ddd6fe", // purple
  "#fed7aa", // orange
  "#ffffff"  // white
];

export default function Ideaboard({ initialData, currentUser, readOnly = false }: IdeaboardProps) {
  const router = useRouter();
  const boardId = initialData.id;
  const [clientId] = useState(() => Math.random().toString(36).substring(7));

  // Board State
  const [title, setTitle] = useState(initialData.title || "");
  const [elements, setElements] = useState<BoardElement[]>(initialData.elements || []);
  const [tVersion, setTVersion] = useState(initialData.tVersion || 0);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Viewport State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'select' | 'hand' | 'sticky' | 'circle' | 'square' | 'pen' | 'link' | 'eraser'>('select');
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Share State
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isShared, setIsShared] = useState(initialData.is_shared);
  const [shareType, setShareType] = useState<"view" | "edit">(initialData.share_type === "edit" ? "edit" : "view");
  const [shareTeam, setShareTeam] = useState(!!initialData.share_team);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [currentStrokeColor, setCurrentStrokeColor] = useState(COLORS[3]); // Red/Dark for pen by default

  const { activeEditors } = usePresence(boardId, currentUser, 'board');
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);

  // Refs for logic
  const elementsRef = useRef(elements);
  const versionRef = useRef(tVersion);
  const isApplyingRemoteRef = useRef(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { versionRef.current = tVersion; }, [tVersion]);

  // Save Protection (Data Loss Prevention)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  // --- Real-time Sync & Save ---

  // Use a ref to store the recursive save function to avoid circular dependency in useCallback
  const saveRef = useRef<(elements: BoardElement[]) => void>(() => { });

  const performSave = useCallback(async (updatedElements: BoardElement[]) => {
    const nextVersion = versionRef.current + 1;
    const res = await updateBoard(boardId, {
      elements: updatedElements,
      tVersion: nextVersion,
      lastClientId: clientId
    });

    if (res.success) {
      setSaveStatus("saved");
      setTVersion(nextVersion);
    } else if ((res as unknown as { conflict?: boolean, latestBoard?: BoardData }).conflict) {
      setSaveStatus("error");
      const latest = (res as unknown as { latestBoard: BoardData }).latestBoard;
      // Merge strategy: Local wins but remote elements added if missing? 
      const remoteElements = latest.elements || [];
      const merged = [...updatedElements];

      // Add remote elements that we don't have
      remoteElements.forEach((re: BoardElement) => {
        if (!merged.find(me => me.id === re.id)) {
          merged.push(re);
        }
      });

      isApplyingRemoteRef.current = true;
      setElements(merged);
      setTVersion(latest.tVersion);
      setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);

      // Retry save with merged using the ref
      saveRef.current(merged);
    } else {
      setSaveStatus("error");
    }
  }, [boardId, clientId]);

  const debouncedSave = useCallback((updatedElements: BoardElement[]) => {
    setSaveStatus("saving");

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      performSave(updatedElements);
      saveTimerRef.current = null;
    }, 2000);
  }, [performSave]);

  // Update the ref whenever debouncedSave changes
  useEffect(() => {
    saveRef.current = debouncedSave;
  }, [debouncedSave]);

  useEffect(() => {
    if (!boardId) return;

    pb.collection("boards").subscribe(boardId, (e) => {
      if (e.action === "update") {
        const remote = e.record;
        if (remote.lastClientId === clientId) return;

        if (remote.tVersion > versionRef.current) {
          isApplyingRemoteRef.current = true;
          const remoteElements = typeof remote.elements === 'string' ? JSON.parse(remote.elements) : remote.elements;
          setElements(remoteElements);
          setTVersion(remote.tVersion);
          setTimeout(() => { isApplyingRemoteRef.current = false; }, 0);
        }
      }
    });

    return () => { pb.collection("boards").unsubscribe(boardId); };
  }, [boardId, clientId]);

  // --- Presence Logic is handled by usePresence hook ---

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (readOnly) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image')) {
          const file = item.getAsFile();
          if (!file) continue;

          setIsUploading(true);
          const formData = new FormData();
          formData.append('images', file);

          const res = await uploadBoardImage(boardId, formData);
          if (res.success && res.url) {
            const newImg: BoardElement = {
              id: Math.random().toString(36).substring(7),
              type: 'image',
              x: mousePos.x - 150,
              y: mousePos.y - 150,
              w: 300,
              h: 300,
              color: "transparent",
              content: "",
              authorId: currentUser.id,
              imageUrl: res.url,
              zIndex: Math.max(0, ...elements.map(e => e.zIndex || 0)) + 1
            };
            const nextElements = [...elements, newImg];
            setElements(nextElements);
            debouncedSave(nextElements);
          }
          setIsUploading(false);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [boardId, readOnly, mousePos, elements, currentUser.id, debouncedSave]);

  // --- Canvas Interactions ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'hand' || e.button === 1) {
      setIsDraggingCanvas(true);
      dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      return;
    }

    if (!readOnly && tool === 'pen') {
      setIsDrawing(true);
      const canvasX = (e.clientX - offset.x) / scale;
      const canvasY = (e.clientY - offset.y) / scale;

      const newPath: BoardElement = {
        id: crypto.randomUUID(),
        type: 'path',
        x: 0, y: 0, w: 0, h: 0,
        color: currentStrokeColor,
        content: "",
        authorId: currentUser.id,
        points: [{ x: canvasX, y: canvasY }],
        zIndex: 50 // Keep on top while drawing
      };
      setElements(prev => [...prev, newPath]);
      return;
    }

    if (!readOnly && (tool === 'circle' || tool === 'square' || tool === 'sticky')) {
      const x = (e.clientX - offset.x) / scale - 100;
      const y = (e.clientY - offset.y) / scale - 100;

      if (tool === 'sticky') {
        addSticky(x, y);
      } else {
        addShape(tool as 'circle' | 'square', x, y);
      }
      if (e.shiftKey) {
        // Stay in tool
      } else {
        setTool('select');
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvasX = (e.clientX - offset.x) / scale;
    const canvasY = (e.clientY - offset.y) / scale;
    setMousePos({ x: canvasX, y: canvasY });

    if (isDraggingCanvas) {
      setOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
      return;
    }

    if (isDrawing && tool === 'pen') {
      setElements(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.type !== 'path') return prev;
        const newPoints = [...(last.points || []), { x: canvasX, y: canvasY }];
        return [...prev.slice(0, -1), { ...last, points: newPoints }];
      });
    }
  };

  const handleMouseUp = () => {
    if (isDraggingCanvas) {
      setIsDraggingCanvas(false);
    }

    if (isDrawing) {
      setIsDrawing(false);
      // Convert points to pathData for persistence
      setElements(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.type !== 'path' || !last.points) return prev;

        const pathData = `M ${last.points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
        const finalElement = { ...last, pathData, points: undefined };
        const nextElements = [...prev.slice(0, -1), finalElement];
        debouncedSave(nextElements);
        return nextElements;
      });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const zoomSpeed = 0.001;
      const newScale = Math.min(Math.max(scale - e.deltaY * zoomSpeed, 0.1), 3);
      setScale(newScale);
    } else {
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // --- Board Actions ---

  const addSticky = (x?: number, y?: number) => {
    if (readOnly) return;
    const newSticky: BoardElement = {
      id: Math.random().toString(36).substring(7),
      type: 'sticky',
      x: x !== undefined ? x : (window.innerWidth / 2 - offset.x) / scale - 100,
      y: y !== undefined ? y : (window.innerHeight / 2 - offset.y) / scale - 100,
      w: 200,
      h: 200,
      color: COLORS[0],
      content: "",
      authorId: currentUser.id,
      zIndex: Math.max(0, ...elements.map(e => e.zIndex || 0)) + 1
    };
    const nextElements = [...elements, newSticky];
    setElements(nextElements);
    debouncedSave(nextElements);
  };

  const addShape = (shapeType: 'circle' | 'square', x?: number, y?: number) => {
    if (readOnly) return;
    const newShape: BoardElement = {
      id: Math.random().toString(36).substring(7),
      type: 'shape',
      shapeType,
      x: x !== undefined ? x : (window.innerWidth / 2 - offset.x) / scale - 100,
      y: y !== undefined ? y : (window.innerHeight / 2 - offset.y) / scale - 100,
      w: 150,
      h: 150,
      color: COLORS[6], // Default white for shapes
      content: "",
      authorId: currentUser.id,
      zIndex: Math.max(0, ...elements.map(e => e.zIndex || 0)) + 1
    };
    const nextElements = [...elements, newShape];
    setElements(nextElements);
    debouncedSave(nextElements);
  };

  const bringToFront = (id: string) => {
    if (readOnly) return;
    const maxZ = Math.max(0, ...elements.map(e => e.zIndex || 0));
    updateElement(id, { zIndex: maxZ + 1 });
  };

  const updateElement = (id: string, updates: Partial<BoardElement>) => {
    if (readOnly) return;
    const nextElements = elements.map(el => el.id === id ? { ...el, ...updates } : el);
    setElements(nextElements);
    debouncedSave(nextElements);
  };

  const deleteElement = (id: string) => {
    if (readOnly) return;
    const nextElements = elements.filter(el => el.id !== id);
    setElements(nextElements);
    debouncedSave(nextElements);
  };

  const handleToggleShare = async (forceType?: "view" | "edit", forceTeam?: boolean) => {
    const nextShared = !isShared || forceType !== undefined || forceTeam !== undefined;
    const nextType = forceType || shareType;
    const nextTeam = forceTeam !== undefined ? forceTeam : shareTeam;

    const res = await toggleSharing("boards", boardId, nextShared, nextType, nextTeam);
    if (res.success) {
      setIsShared(nextShared);
      setShareType(nextType);
      setShareTeam(nextTeam);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/cowork/board/${boardId}` : '';

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="flex w-full h-[100dvh] bg-[#F1F5F9] overflow-hidden relative select-none">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => updateBoard(boardId, { title })}
              disabled={readOnly}
              className="bg-transparent border-none text-lg font-bold text-slate-800 focus:ring-0 p-0 w-64"
            />
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              <span>v{tVersion}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className={cn(
                saveStatus === "saving" ? "text-indigo-500" : saveStatus === "error" ? "text-red-500" : "text-green-500"
              )}>
                {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Error" : "Saved"}
              </span>
              {isUploading && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-indigo-500 animate-pulse">Uploading Image...</span>
                </>
              )}

            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Active Editors */}
          <div className="flex items-center -space-x-2">
            {activeEditors.map((editor) => (
              <div
                key={editor.userId}
                className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm"
                title={editor.name}
              >
                {editor.avatarUrl ? (
                  <img src={editor.avatarUrl} alt={editor.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {editor.name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-6 text-slate-500">
            <button
              onClick={() => setIsShareOpen(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                isShared ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Share2 className="w-3.5 h-3.5" />
              {isShared ? "공유 중" : "공유"}
            </button>
          </div>
        </div>
      </div>

      {/* Toolbox */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 p-2 bg-white rounded-2xl shadow-xl border border-slate-200">
        <button
          onClick={() => setTool('select')}
          className={cn("p-3 rounded-xl transition-all", tool === 'select' ? "bg-slate-900 text-white shadow-lg" : "hover:bg-slate-50 text-slate-400")}
        >
          <MousePointer2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('hand')}
          className={cn("p-3 rounded-xl transition-all", tool === 'hand' ? "bg-slate-900 text-white shadow-lg" : "hover:bg-slate-50 text-slate-400")}
        >
          <Hand className="w-5 h-5" />
        </button>
        <div className="w-full h-px bg-slate-100 my-1" />
        <button
          onClick={() => addSticky()}
          disabled={readOnly}
          className={cn("p-3 rounded-xl transition-all", tool === 'sticky' ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-indigo-50 text-indigo-500")}
          title="Add Sticky Note"
        >
          <StickyNote className="w-6 h-6" />
        </button>
        <button
          onClick={() => setTool('pen')}
          disabled={readOnly}
          className={cn("p-3 rounded-xl transition-all", tool === 'pen' ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-50 text-slate-400")}
          title="Pen Tool"
        >
          <Pencil className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('eraser')}
          disabled={readOnly}
          className={cn("p-3 rounded-xl transition-all", tool === 'eraser' ? "bg-red-600 text-white shadow-lg" : "hover:bg-red-50 text-red-400")}
          title="Eraser Tool"
        >
          <Eraser className="w-5 h-5" />
        </button>
        <div className="w-full h-px bg-slate-100 my-1" />
        <button
          onClick={() => {
            if (confirm("모든 드로잉과 연결을 지우시겠습니까?")) {
              const nextElements = elements.filter(el => el.type !== 'path' && el.type !== 'connection');
              setElements(nextElements);
              debouncedSave(nextElements);
            }
          }}
          disabled={readOnly}
          className="p-3 rounded-xl hover:bg-red-50 text-red-400 transition-all opacity-50 hover:opacity-100"
          title="Clear All Drawings"
        >
          <RefreshCcw className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('square')}
          disabled={readOnly}
          className={cn("p-3 rounded-xl transition-all", tool === 'square' ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-50 text-slate-400")}
          title="Square Tool"
        >
          <Square className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('circle')}
          disabled={readOnly}
          className={cn("p-3 rounded-xl transition-all", tool === 'circle' ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-50 text-slate-400")}
          title="Circle Tool"
        >
          <Circle className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('link')}
          disabled={readOnly}
          className={cn("p-3 rounded-xl transition-all", tool === 'link' ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-50 text-slate-400")}
          title="Connect Elements"
        >
          <div className="relative">
            <Link2 className={cn("w-5 h-5", linkingFromId && "text-indigo-400 animate-pulse")} />
            {linkingFromId && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </div>
        </button>

        {!readOnly && tool === 'pen' && (
          <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 flex flex-col gap-2">
            {COLORS.slice(3).concat(COLORS.slice(0, 3)).map(c => (
              <button
                key={c}
                onClick={() => setCurrentStrokeColor(c)}
                className={cn(
                  "w-6 h-6 rounded-full border border-black/10 transition-transform",
                  currentStrokeColor === c ? "scale-125 ring-2 ring-indigo-500 ring-offset-2" : "hover:scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="absolute right-6 bottom-6 z-50 flex items-center gap-2 p-1.5 bg-white rounded-xl shadow-lg border border-slate-200">
        <button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))} className="p-1.5 hover:bg-slate-50 rounded text-slate-400"><Minus className="w-4 h-4" /></button>
        <div className="text-[11px] font-bold text-slate-600 min-w-[40px] text-center">{Math.round(scale * 100)}%</div>
        <button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-1.5 hover:bg-slate-50 rounded text-slate-400"><Plus className="w-4 h-4" /></button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="p-1.5 hover:bg-slate-50 rounded text-slate-400"><RefreshCcw className="w-4 h-4" /></button>
      </div>

      {/* Canvas */}
      <div
        className={cn(
          "w-full h-full cursor-default overflow-hidden relative",
          tool === 'hand' && "cursor-grab",
          isDraggingCanvas && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#000 1px, transparent 0)`,
            backgroundSize: `${20 * scale}px ${20 * scale}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`
          }}
        />

        {/* Board Layer */}
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            minWidth: '5000px',
            minHeight: '5000px',
            touchAction: 'none'
          }}
          className="relative"
        >
          {[...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(el => {
            if (el.type === 'path') {
              const d = el.pathData || (el.points ? `M ${el.points.map(p => `${p.x} ${p.y}`).join(' L ')}` : '');
              return (
                <svg
                  key={el.id}
                  className={cn(
                    "absolute overflow-visible",
                    tool === 'eraser' ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
                  )}
                  style={{
                    left: 0,
                    top: 0,
                    zIndex: el.zIndex || 0
                  }}
                  onMouseDown={(e) => {
                    if (tool === 'eraser') {
                      e.stopPropagation();
                      deleteElement(el.id);
                    }
                  }}
                >
                  <path
                    d={d}
                    fill="none"
                    stroke={el.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn(tool === 'eraser' && "hover:stroke-red-500 hover:stroke-[6px] transition-all")}
                  />
                </svg>
              );
            }

            if (el.from && el.to && el.type === 'connection') {
              const startElem = elements.find(e => e.id === el.from);
              const endElem = elements.find(e => e.id === el.to);
              if (startElem && endElem) {
                const x1 = (startElem.x || 0) + (startElem.w || 200) / 2;
                const y1 = (startElem.y || 0) + (startElem.h || 200) / 2;
                const x2 = (endElem.x || 0) + (endElem.w || 200) / 2;
                const y2 = (endElem.y || 0) + (endElem.h || 200) / 2;

                return (
                  <svg
                    key={el.id}
                    className={cn(
                      "absolute overflow-visible",
                      tool === 'eraser' ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
                    )}
                    style={{
                      left: 0,
                      top: 0,
                      zIndex: 1 // Above paths, below stickies
                    }}
                    onMouseDown={(e) => {
                      if (tool === 'eraser') {
                        e.stopPropagation();
                        deleteElement(el.id);
                      }
                    }}
                  >
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="#475569"
                      strokeWidth="2.5"
                      strokeDasharray="6,4"
                      className={cn(tool === 'eraser' && "hover:stroke-red-500 hover:stroke-[5px] transition-all")}
                    />
                    <circle cx={x1} cy={y1} r="4" fill="#475569" />
                    <circle cx={x2} cy={y2} r="4" fill="#475569" />
                    <foreignObject x={(x1 + x2) / 2 - 10} y={(y1 + y2) / 2 - 10} width="20" height="20" style={{ pointerEvents: 'auto' }}>
                      <button
                        onClick={() => deleteElement(el.id)}
                        className="w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </foreignObject>
                  </svg>
                );
              }
              return null;
            }

            if (el.type === 'image') {
              return (
                <div
                  key={el.id}
                  style={{
                    position: 'absolute',
                    left: isNaN(el.x) ? 0 : el.x,
                    top: isNaN(el.y) ? 0 : el.y,
                    width: isNaN(el.w) ? 300 : el.w,
                    height: isNaN(el.h) ? 300 : el.h,
                    zIndex: el.zIndex || 10,
                    cursor: !readOnly && tool === 'select' ? 'grab' : 'default',
                    touchAction: 'none'
                  }}
                  className="group shadow-lg rounded-lg overflow-hidden border border-slate-200 bg-white"
                  onMouseDown={(e) => {
                    if (readOnly) return;

                    if (tool === 'link') {
                      e.stopPropagation();
                      if (!linkingFromId) {
                        setLinkingFromId(el.id);
                      } else if (linkingFromId === el.id) {
                        setLinkingFromId(null);
                      } else {
                        // Complete connection
                        const newConn: BoardElement = {
                          id: Math.random().toString(36).substring(7),
                          type: 'connection',
                          from: linkingFromId,
                          to: el.id,
                          x: 0, y: 0, w: 0, h: 0,
                          color: "#94a3b8", // grey-400
                          content: "",
                          authorId: currentUser.id,
                          zIndex: 0
                        };
                        const nextElements = [...elements, newConn];
                        setElements(nextElements);
                        debouncedSave(nextElements);
                        setLinkingFromId(null);
                        setTool('select');
                      }
                      return;
                    }

                    if (tool !== 'select') return;
                    e.stopPropagation();
                    bringToFront(el.id);

                    const startX = e.clientX;
                    const startY = e.clientY;
                    const origX = el.x || 0;
                    const origY = el.y || 0;

                    const onMouseMove = (moveE: MouseEvent) => {
                      moveE.preventDefault();
                      const dx = (moveE.clientX - startX) / scale;
                      const dy = (moveE.clientY - startY) / scale;
                      setElements(prev => prev.map(p => p.id === el.id ? { ...p, x: Math.round(origX + dx), y: Math.round(origY + dy) } : p));
                    };

                    const onMouseUp = (upE: MouseEvent) => {
                      upE.preventDefault();
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                      const dx = (upE.clientX - startX) / scale;
                      const dy = (upE.clientY - startY) / scale;
                      updateElement(el.id, { x: Math.round(origX + dx), y: Math.round(origY + dy) });
                    };

                    document.addEventListener('mousemove', onMouseMove, { passive: false });
                    document.addEventListener('mouseup', onMouseUp, { passive: false });
                  }}
                >
                  <img src={el.imageUrl} alt="Board Element" className="w-full h-full object-contain pointer-events-none" />

                  {!readOnly && (
                    <>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                          className="p-1.5 bg-white/90 backdrop-blur rounded-full shadow-md text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-indigo-500/30 opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const startW = el.w;
                          const startH = el.h;

                          let currentW = startW;
                          let currentH = startH;

                          const onResize = (moveE: MouseEvent) => {
                            const dw = (moveE.clientX - startX) / scale;
                            const nextW = Math.max(50, startW + dw);
                            const nextH = startH * (nextW / startW);
                            currentW = nextW;
                            currentH = nextH;
                            setElements(prev => prev.map(p => p.id === el.id ? { ...p, w: nextW, h: nextH } : p));
                          };

                          const onResizeUp = () => {
                            document.removeEventListener('mousemove', onResize);
                            document.removeEventListener('mouseup', onResizeUp);
                            updateElement(el.id, { w: currentW, h: currentH });
                          };

                          document.addEventListener('mousemove', onResize);
                          document.addEventListener('mouseup', onResizeUp);
                        }}
                      />
                    </>
                  )}
                </div>
              );
            }

            return (
              <div
                key={el.id}
                style={{
                  position: 'absolute',
                  left: isNaN(el.x) ? 0 : el.x,
                  top: isNaN(el.y) ? 0 : el.y,
                  width: isNaN(el.w) ? 200 : el.w,
                  height: isNaN(el.h) ? 200 : el.h,
                  backgroundColor: el.color,
                  zIndex: el.zIndex || 10,
                  cursor: !readOnly && tool === 'select' ? 'grab' : 'default',
                  borderRadius: el.shapeType === 'circle' ? '50%' : '12px',
                  touchAction: 'none'
                }}
                className={cn(
                  "shadow-md p-4 flex flex-col group hover:shadow-xl transition-shadow border border-black/5 overflow-hidden",
                  el.type === 'sticky' ? "rounded-xl" : ""
                )}
                onMouseDown={(e) => {
                  if (readOnly) return;

                  if (tool === 'link') {
                    e.stopPropagation();
                    if (!linkingFromId) {
                      setLinkingFromId(el.id);
                    } else if (linkingFromId === el.id) {
                      setLinkingFromId(null);
                    } else {
                      // Complete connection
                      const newConn: BoardElement = {
                        id: Math.random().toString(36).substring(7),
                        type: 'connection',
                        from: linkingFromId,
                        to: el.id,
                        x: 0, y: 0, w: 0, h: 0,
                        color: "#94a3b8", // grey-400
                        content: "",
                        authorId: currentUser.id,
                        zIndex: 0
                      };
                      const nextElements = [...elements, newConn];
                      setElements(nextElements);
                      debouncedSave(nextElements);
                      setLinkingFromId(null);
                      setTool('select');
                    }
                    return;
                  }

                  if (tool !== 'select') return;
                  e.stopPropagation();
                  bringToFront(el.id);

                  const startX = e.clientX;
                  const startY = e.clientY;
                  const origX = el.x || 0;
                  const origY = el.y || 0;

                  const onMouseMove = (moveE: MouseEvent) => {
                    moveE.preventDefault();
                    const dx = (moveE.clientX - startX) / scale;
                    const dy = (moveE.clientY - startY) / scale;
                    // Fix: explicit rounding or clamping if needed, but here simple math
                    const nextX = Math.round(origX + dx);
                    const nextY = Math.round(origY + dy);
                    setElements(prev => prev.map(p => p.id === el.id ? { ...p, x: nextX, y: nextY } : p));
                  };

                  const onMouseUp = (upE: MouseEvent) => {
                    upE.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    const dx = (upE.clientX - startX) / scale;
                    const dy = (upE.clientY - startY) / scale;
                    updateElement(el.id, { x: Math.round(origX + dx), y: Math.round(origY + dy) });
                  };

                  document.addEventListener('mousemove', onMouseMove, { passive: false });
                  document.addEventListener('mouseup', onMouseUp, { passive: false });
                }}
              >
                <textarea
                  value={el.content || ""}
                  onChange={(e) => updateElement(el.id, { content: e.target.value })}
                  placeholder={el.type === 'sticky' ? "아이디어를 입력하세요..." : ""}
                  readOnly={readOnly}
                  className={cn(
                    "flex-1 bg-transparent border-none resize-none p-0 focus:ring-0 text-slate-700 placeholder:text-slate-400 overflow-hidden w-full h-full",
                    el.type === 'shape' ? "text-center font-bold text-lg flex items-center justify-center pt-10" : "text-sm"
                  )}
                  style={el.type === 'shape' ? { display: 'flex', alignItems: 'center' } : {}}
                />

                {!readOnly && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between mt-2 pt-2 border-t border-black/5 bg-white/50 backdrop-blur-sm rounded-b-lg">
                    <div className="flex gap-1 flex-wrap max-w-[120px]">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => updateElement(el.id, { color: c })}
                          className={cn("w-3.5 h-3.5 rounded-full border border-black/10", el.color === c && "ring-2 ring-slate-400 ring-offset-1")}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); bringToFront(el.id); }}
                        className="p-1 hover:bg-black/5 rounded text-indigo-500 transition-colors"
                        title="Bring to Front"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                        className="p-1 hover:bg-black/5 rounded text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Temporary Link Line */}
          {linkingFromId && (
            <svg
              className="absolute pointer-events-none overflow-visible"
              style={{ left: 0, top: 0, zIndex: 100 }}
            >
              {(() => {
                const startElem = elements.find(e => e.id === linkingFromId);
                if (!startElem) return null;
                const x1 = (startElem.x || 0) + (startElem.w || 200) / 2;
                const y1 = (startElem.y || 0) + (startElem.h || 200) / 2;
                return (
                  <line
                    x1={x1} y1={y1} x2={mousePos.x} y2={mousePos.y}
                    stroke="#818cf8"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    className="opacity-50"
                  />
                );
              })()}
            </svg>
          )}
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="bg-[#F8FAFC]/95 backdrop-blur-xl border-none shadow-2xl rounded-[32px] w-[calc(100%-2rem)] sm:max-w-[480px] p-0 overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-4">
            <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              협업 및 공유
            </DialogTitle>
          </DialogHeader>

          <div className="px-8 pb-10 space-y-8">
            <div className="bg-white/50 rounded-[24px] p-6 border border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">링크 공유 활성화</h4>
                  <p className="text-[11px] text-slate-500 font-medium">링크가 있는 모든 사용자가 보드를 볼 수 있습니다.</p>
                </div>
                <button
                  onClick={() => handleToggleShare()}
                  className={cn(
                    "w-14 h-8 rounded-full relative transition-all duration-300",
                    isShared ? "bg-indigo-600" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm",
                    isShared ? "left-7" : "left-1"
                  )} />
                </button>
              </div>

              {isShared && (
                <div className="pt-6 border-t border-slate-100 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800">팀 대시보드 표시</h4>
                      <p className="text-[11px] text-slate-500 font-medium">팀원들의 대시보드 목록에 이 보드를 표시합니다.</p>
                    </div>
                    <button
                      onClick={() => handleToggleShare(undefined, !shareTeam)}
                      className={cn(
                        "w-14 h-8 rounded-full relative transition-all duration-300",
                        shareTeam ? "bg-indigo-600" : "bg-slate-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm",
                        shareTeam ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">보드 공유 링크</label>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-1 min-w-0 bg-white border border-slate-100 rounded-[20px] px-6 py-4 text-slate-800 truncate text-[10px] font-bold overflow-hidden">
                        {shareUrl}
                      </div>
                      <button
                        onClick={copyShareLink}
                        className={cn(
                          "w-14 h-14 rounded-[20px] flex items-center justify-center active:scale-95 transition-all shadow-lg",
                          copyFeedback ? "bg-green-500 text-white shadow-green-200" : "bg-indigo-600 text-white shadow-indigo-200"
                        )}
                      >
                        {copyFeedback ? <CheckSquare className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
